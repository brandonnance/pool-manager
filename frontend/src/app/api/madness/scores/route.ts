import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateSpreadCover } from '@/lib/madness'

export async function POST(request: NextRequest) {
  try {
    const {
      gameId,
      higherSeedScore,
      lowerSeedScore,
      status,
    } = await request.json()

    if (!gameId) {
      return NextResponse.json(
        { error: 'Missing gameId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get game with pool info
    const { data: game, error: gameError } = await supabase
      .from('mm_games')
      .select(`
        *,
        mm_pools!inner(
          id,
          pool_id,
          push_rule,
          pools!inner(org_id)
        )
      `)
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    // Verify user is commissioner
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const isSuperAdmin = profile?.is_super_admin ?? false

    if (!isSuperAdmin) {
      const { data: poolMembership } = await supabase
        .from('pool_memberships')
        .select('role')
        .eq('pool_id', game.mm_pools.pool_id)
        .eq('user_id', user.id)
        .single()

      const { data: orgMembership } = await supabase
        .from('org_memberships')
        .select('role')
        .eq('org_id', game.mm_pools.pools.org_id)
        .eq('user_id', user.id)
        .single()

      const isOrgAdmin = orgMembership?.role === 'admin'
      const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin

      if (!isPoolCommissioner) {
        return NextResponse.json(
          { error: 'Only commissioners can enter scores' },
          { status: 403 }
        )
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {}

    if (higherSeedScore !== undefined) {
      updates.higher_seed_score = higherSeedScore
    }
    if (lowerSeedScore !== undefined) {
      updates.lower_seed_score = lowerSeedScore
    }
    if (status) {
      updates.status = status
    }

    // If marking as final, calculate winner and spread cover
    if (status === 'final' && game.spread !== null) {
      const hScore = higherSeedScore ?? game.higher_seed_score
      const lScore = lowerSeedScore ?? game.lower_seed_score

      if (hScore !== null && lScore !== null) {
        const result = calculateSpreadCover(
          hScore,
          lScore,
          game.spread,
          game.mm_pools.push_rule as 'favorite_advances' | 'underdog_advances' | 'coin_flip'
        )

        // Determine winning and covering teams
        updates.winning_team_id = result.winner === 'higher'
          ? game.higher_seed_team_id
          : game.lower_seed_team_id

        updates.spread_covering_team_id = result.spreadCover === 'push'
          ? (result.advancingTeam === 'higher' ? game.higher_seed_team_id : game.lower_seed_team_id)
          : (result.spreadCover === 'higher' ? game.higher_seed_team_id : game.lower_seed_team_id)

        // Determine advancing and eliminated entries
        const advancingEntryId = result.advancingTeam === 'higher'
          ? game.higher_seed_entry_id
          : game.lower_seed_entry_id

        const eliminatedEntryId = result.advancingTeam === 'higher'
          ? game.lower_seed_entry_id
          : game.higher_seed_entry_id

        updates.advancing_entry_id = advancingEntryId

        // Update eliminated entry - clear their current_team_id since they no longer own a team
        if (eliminatedEntryId) {
          await supabase
            .from('mm_entries')
            .update({
              eliminated: true,
              eliminated_round: game.round,
              current_team_id: null,
            })
            .eq('id', eliminatedEntryId)
        }

        // Transfer winning team to advancing entry
        if (advancingEntryId && updates.winning_team_id) {
          await supabase
            .from('mm_entries')
            .update({
              current_team_id: updates.winning_team_id as string,
            })
            .eq('id', advancingEntryId)
        }

        // Mark eliminated team
        const eliminatedTeamId = result.winner === 'higher'
          ? game.lower_seed_team_id
          : game.higher_seed_team_id

        if (eliminatedTeamId) {
          await supabase
            .from('mm_pool_teams')
            .update({
              eliminated: true,
              eliminated_round: game.round,
            })
            .eq('id', eliminatedTeamId)
        }
      }
    }

    // Update game
    const { error: updateError } = await supabase
      .from('mm_games')
      .update(updates)
      .eq('id', gameId)

    if (updateError) {
      console.error('Error updating game:', updateError)
      return NextResponse.json(
        { error: 'Failed to update game' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Score updated successfully',
      updates,
    })
  } catch (error) {
    console.error('Score update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
