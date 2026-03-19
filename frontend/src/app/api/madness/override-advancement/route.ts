/**
 * @fileoverview Override Entry Advancement API Route
 * @route POST /api/madness/override-advancement
 * @auth Requires commissioner role or super admin
 *
 * @description
 * Allows commissioners to manually override which entry advances from a game.
 * Cascades the change through all downstream games in the bracket.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPoolPermissions } from '@/lib/permissions'

interface CascadeStep {
  round: string
  gameId: string
  action: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { gameId, newAdvancingEntryId, poolId } = body

    if (!gameId || !newAdvancingEntryId || !poolId) {
      return NextResponse.json(
        { error: 'Missing required fields: gameId, newAdvancingEntryId, poolId' },
        { status: 400 }
      )
    }

    // Get the pool to find org_id for permission check
    const { data: pool } = await supabase
      .from('pools')
      .select('org_id')
      .eq('id', poolId)
      .single()

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    const { isPoolCommissioner } = await getPoolPermissions(supabase, user.id, poolId, pool.org_id)
    if (!isPoolCommissioner) {
      return NextResponse.json({ error: 'Must be a commissioner' }, { status: 403 })
    }

    // Get the game
    const { data: game, error: gameError } = await supabase
      .from('mm_games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    if (game.status !== 'final') {
      return NextResponse.json({ error: 'Can only override final games' }, { status: 400 })
    }

    // Validate the new advancing entry is one of the two entries in this game
    if (newAdvancingEntryId !== game.higher_seed_entry_id && newAdvancingEntryId !== game.lower_seed_entry_id) {
      return NextResponse.json(
        { error: 'New advancing entry must be one of the two entries in this game' },
        { status: 400 }
      )
    }

    // If already the advancing entry, nothing to do
    if (newAdvancingEntryId === game.advancing_entry_id) {
      return NextResponse.json({ success: true, message: 'Entry already advancing', cascade: [] })
    }

    const oldAdvancingEntryId = game.advancing_entry_id
    const oldLosingEntryId = newAdvancingEntryId // The new winner was previously the loser
    const newLosingEntryId = oldAdvancingEntryId // The old winner is now the loser

    const cascade: CascadeStep[] = []

    // 1. Update the game's advancing_entry_id and spread_covering_team_id
    const newCoveringTeamId = newAdvancingEntryId === game.higher_seed_entry_id
      ? game.higher_seed_team_id
      : game.lower_seed_team_id

    const { error: updateGameError } = await supabase
      .from('mm_games')
      .update({
        advancing_entry_id: newAdvancingEntryId,
        spread_covering_team_id: newCoveringTeamId,
      })
      .eq('id', gameId)

    if (updateGameError) {
      return NextResponse.json({ error: `Failed to update game: ${updateGameError.message}` }, { status: 500 })
    }
    cascade.push({ round: game.round, gameId, action: 'Swapped advancing entry' })

    // 2. Fix entry elimination status
    // Un-eliminate the new advancing entry
    if (oldLosingEntryId) {
      await supabase
        .from('mm_entries')
        .update({
          eliminated: false,
          eliminated_round: null,
          current_team_id: game.winning_team_id, // They now ride the winning team
          updated_at: new Date().toISOString(),
        })
        .eq('id', oldLosingEntryId)
    }

    // Eliminate the old advancing entry
    if (newLosingEntryId) {
      await supabase
        .from('mm_entries')
        .update({
          eliminated: true,
          eliminated_round: game.round,
          current_team_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', newLosingEntryId)
    }

    // 3. Cascade through downstream games
    if (game.game_number !== null) {
      await cascadeEntryChange(
        supabase,
        game.mm_pool_id,
        game.round,
        game.game_number,
        oldAdvancingEntryId,
        newAdvancingEntryId,
        cascade
      )
    }

    return NextResponse.json({
      success: true,
      message: `Override applied with ${cascade.length} game(s) updated`,
      cascade,
    })
  } catch (error) {
    console.error('Override advancement error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Cascade an entry change through downstream games.
 * Follows the same game_number progression logic as mm_process_game_result().
 */
async function cascadeEntryChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mmPoolId: string,
  currentRound: string,
  currentGameNumber: number,
  oldEntryId: string | null,
  newEntryId: string,
  cascade: CascadeStep[]
) {
  // Determine next round
  const nextRound = getNextRound(currentRound)
  if (!nextRound) return // Championship game, no further cascade

  // Determine which next-round game and slot
  const { nextGameNumber, isHigherSeedSlot } = getNextGameSlot(currentRound, currentGameNumber)

  // Find the next-round game
  const { data: nextGame } = await supabase
    .from('mm_games')
    .select('*')
    .eq('mm_pool_id', mmPoolId)
    .eq('round', nextRound)
    .eq('game_number', nextGameNumber)
    .single()

  if (!nextGame) return

  // Update the entry in the correct slot
  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (isHigherSeedSlot) {
    updateFields.higher_seed_entry_id = newEntryId
  } else {
    updateFields.lower_seed_entry_id = newEntryId
  }

  // If this next game is also final and the old entry was the one that advanced,
  // we need to swap the advancing entry here too and continue cascading
  if (nextGame.status === 'final' && nextGame.advancing_entry_id === oldEntryId) {
    updateFields.advancing_entry_id = newEntryId

    // Fix elimination: un-eliminate new entry, re-eliminate old
    const otherEntryId = isHigherSeedSlot
      ? nextGame.lower_seed_entry_id
      : nextGame.higher_seed_entry_id

    // The new advancing entry should not be eliminated
    await supabase
      .from('mm_entries')
      .update({
        eliminated: false,
        eliminated_round: null,
        current_team_id: nextGame.winning_team_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', newEntryId)

    // If the old entry isn't the other entry in this game (which would mean they're
    // also in this game independently), eliminate them at this round
    if (oldEntryId && oldEntryId !== otherEntryId) {
      // Check if the old entry is eliminated somewhere else downstream
      // For now, mark them eliminated at the game they originally lost
      // (they were already eliminated in step 2, so this is a no-op for R64 overrides)
    }

    cascade.push({
      round: nextRound,
      gameId: nextGame.id,
      action: `Cascaded: swapped advancing entry in ${isHigherSeedSlot ? 'higher' : 'lower'} seed slot`,
    })

    // Continue cascading
    await cascadeEntryChange(
      supabase,
      mmPoolId,
      nextRound,
      nextGameNumber,
      oldEntryId,
      newEntryId,
      cascade
    )
  } else {
    // Next game not final or different entry advanced — just update the slot
    cascade.push({
      round: nextRound,
      gameId: nextGame.id,
      action: `Updated ${isHigherSeedSlot ? 'higher' : 'lower'} seed entry slot`,
    })
  }

  await supabase
    .from('mm_games')
    .update(updateFields)
    .eq('id', nextGame.id)
}

function getNextRound(round: string): string | null {
  switch (round) {
    case 'R64': return 'R32'
    case 'R32': return 'S16'
    case 'S16': return 'E8'
    case 'E8': return 'F4'
    case 'F4': return 'Final'
    default: return null
  }
}

function getNextGameSlot(round: string, gameNumber: number): { nextGameNumber: number; isHigherSeedSlot: boolean } {
  // Mirror the logic from mm_process_game_result() trigger
  if (round === 'R64') {
    const regionGameOffset = Math.floor((gameNumber - 1) / 8) * 8
    const gamePosition = gameNumber - regionGameOffset
    const nextGameNumber = Math.floor(regionGameOffset / 8) * 4 + Math.ceil(gamePosition / 2)
    const isHigherSeedSlot = gamePosition % 2 === 1
    return { nextGameNumber, isHigherSeedSlot }
  }

  if (round === 'R32') {
    const regionGameOffset = Math.floor((gameNumber - 1) / 4) * 4
    const gamePosition = gameNumber - regionGameOffset
    const nextGameNumber = Math.floor(regionGameOffset / 4) * 2 + Math.ceil(gamePosition / 2)
    const isHigherSeedSlot = gamePosition % 2 === 1
    return { nextGameNumber, isHigherSeedSlot }
  }

  if (round === 'S16') {
    const regionGameOffset = Math.floor((gameNumber - 1) / 2) * 2
    const gamePosition = gameNumber - regionGameOffset
    const nextGameNumber = Math.floor(regionGameOffset / 2) + 1
    const isHigherSeedSlot = gamePosition % 2 === 1
    return { nextGameNumber, isHigherSeedSlot }
  }

  if (round === 'E8') {
    if (gameNumber <= 2) {
      return { nextGameNumber: 1, isHigherSeedSlot: gameNumber === 1 }
    }
    return { nextGameNumber: 2, isHigherSeedSlot: gameNumber === 3 }
  }

  if (round === 'F4') {
    return { nextGameNumber: 1, isHigherSeedSlot: gameNumber === 1 }
  }

  return { nextGameNumber: 1, isHigherSeedSlot: true }
}
