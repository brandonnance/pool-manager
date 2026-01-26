/**
 * @fileoverview Admin Scoring API Route
 * @route POST /api/admin/scoring
 * @auth Super Admin only
 *
 * @description
 * Handles live scoring actions for admin-controlled events.
 * Updates event_state and records winners for all linked pools.
 *
 * Actions:
 * - start_game: Initialize game with 0-0 score
 * - record_score: Record a score change and calculate winners
 * - end_period: Mark end of quarter/half and record quarter winners
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

interface ScoringRequest {
  eventId: string
  action: 'start_game' | 'record_score' | 'end_period'
  homeTeam?: string
  awayTeam?: string
  homeScore?: number
  awayScore?: number
  period?: number
}

interface SqPool {
  id: string
  scoring_mode: 'quarter' | 'score_change' | null
  reverse_scoring: boolean | null
  row_numbers: number[] | null
  col_numbers: number[] | null
  numbers_locked: boolean | null
  per_change_payout: number | null
  final_bonus_payout: number | null
  q1_payout: number | null
  halftime_payout: number | null
  q3_payout: number | null
  final_payout: number | null
}

interface SqGame {
  id: string
  sq_pool_id: string
  last_scored_period: number | null
  status: string | null
}

export async function POST(request: NextRequest) {
  // Verify user is authenticated and is super admin
  const userClient = await createClient()
  const { data: { user } } = await userClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await userClient
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  }

  // Parse request
  const body: ScoringRequest = await request.json()
  const { eventId, action } = body

  if (!eventId || !action) {
    return NextResponse.json({ error: 'Missing eventId or action' }, { status: 400 })
  }

  // Use admin client for database operations (bypasses RLS)
  const supabase = createAdminClient()

  try {
    // Verify event exists
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    let result: { success: boolean; winnersCreated?: number; message?: string }

    switch (action) {
      case 'start_game':
        result = await handleStartGame(supabase, eventId, body.homeTeam, body.awayTeam)
        break

      case 'record_score':
        if (body.homeScore === undefined || body.awayScore === undefined) {
          return NextResponse.json({ error: 'Missing homeScore or awayScore' }, { status: 400 })
        }
        result = await handleRecordScore(supabase, eventId, body.homeScore, body.awayScore)
        break

      case 'end_period':
        if (body.period === undefined || body.homeScore === undefined || body.awayScore === undefined) {
          return NextResponse.json({ error: 'Missing period, homeScore, or awayScore' }, { status: 400 })
        }
        result = await handleEndPeriod(supabase, eventId, body.period, body.homeScore, body.awayScore)
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('[admin-scoring] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Start a game - initialize event_state and record 0-0 kickoff
 */
async function handleStartGame(
  supabase: SupabaseClient<Database>,
  eventId: string,
  homeTeam?: string,
  awayTeam?: string
): Promise<{ success: boolean; winnersCreated: number; message: string }> {
  // Create or update event_state
  const payload = {
    home_score: 0,
    away_score: 0,
    period: 1,
    clock: '15:00',
    home_team: homeTeam,
    away_team: awayTeam,
  }

  const { error: upsertError } = await supabase
    .from('event_state')
    .upsert({
      event_id: eventId,
      status: 'in_progress',
      payload,
      updated_at: new Date().toISOString(),
    })

  if (upsertError) {
    throw new Error(`Failed to create event_state: ${upsertError.message}`)
  }

  // Update event status
  await supabase
    .from('events')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', eventId)

  // Record 0-0 kickoff winner for score_change mode pools
  const winnersCreated = await recordScoreChangeWinners(
    supabase,
    eventId,
    0,
    0,
    'score_change',
    true // isKickoff
  )

  return {
    success: true,
    winnersCreated,
    message: `Game started. Kickoff winner recorded for ${winnersCreated} pool(s).`
  }
}

/**
 * Record a score change
 */
async function handleRecordScore(
  supabase: SupabaseClient<Database>,
  eventId: string,
  homeScore: number,
  awayScore: number
): Promise<{ success: boolean; winnersCreated: number; message: string }> {
  // Get current event_state
  const { data: currentState } = await supabase
    .from('event_state')
    .select('*')
    .eq('event_id', eventId)
    .single()

  if (!currentState) {
    throw new Error('Game not started. Use start_game first.')
  }

  const currentPayload = currentState.payload as {
    home_score?: number
    away_score?: number
    period?: number
    clock?: string
    home_team?: string
    away_team?: string
    q1_home_score?: number
    q1_away_score?: number
    q2_home_score?: number
    q2_away_score?: number
    q3_home_score?: number
    q3_away_score?: number
  }

  // Check if score actually changed
  if (currentPayload.home_score === homeScore && currentPayload.away_score === awayScore) {
    return {
      success: true,
      winnersCreated: 0,
      message: 'Score unchanged'
    }
  }

  // Update event_state with new score
  const updatedPayload = {
    ...currentPayload,
    home_score: homeScore,
    away_score: awayScore,
  }

  const { error: updateError } = await supabase
    .from('event_state')
    .update({
      payload: updatedPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)

  if (updateError) {
    throw new Error(`Failed to update event_state: ${updateError.message}`)
  }

  // Record winners for score_change mode pools
  const winnersCreated = await recordScoreChangeWinners(
    supabase,
    eventId,
    homeScore,
    awayScore,
    'score_change',
    false
  )

  return {
    success: true,
    winnersCreated,
    message: `Score recorded: ${awayScore}-${homeScore}. Winners created for ${winnersCreated} pool(s).`
  }
}

/**
 * End a period (Q1, Halftime, Q3, or Final)
 */
async function handleEndPeriod(
  supabase: SupabaseClient<Database>,
  eventId: string,
  period: number,
  homeScore: number,
  awayScore: number
): Promise<{ success: boolean; winnersCreated: number; message: string }> {
  // Get current event_state
  const { data: currentState } = await supabase
    .from('event_state')
    .select('*')
    .eq('event_id', eventId)
    .single()

  if (!currentState) {
    throw new Error('Game not started. Use start_game first.')
  }

  const currentPayload = currentState.payload as {
    home_score?: number
    away_score?: number
    period?: number
    clock?: string
    home_team?: string
    away_team?: string
    q1_home_score?: number
    q1_away_score?: number
    q2_home_score?: number
    q2_away_score?: number
    q3_home_score?: number
    q3_away_score?: number
  }

  // Determine win type and update payload based on period
  let winType: string
  const updatedPayload = { ...currentPayload }

  switch (period) {
    case 1: // End of Q1
      winType = 'q1'
      updatedPayload.q1_home_score = homeScore
      updatedPayload.q1_away_score = awayScore
      updatedPayload.period = 2
      break
    case 2: // Halftime
      winType = 'halftime'
      updatedPayload.q2_home_score = homeScore
      updatedPayload.q2_away_score = awayScore
      updatedPayload.period = 3
      break
    case 3: // End of Q3
      winType = 'q3'
      updatedPayload.q3_home_score = homeScore
      updatedPayload.q3_away_score = awayScore
      updatedPayload.period = 4
      break
    case 4: // Final
      winType = 'normal'
      updatedPayload.home_score = homeScore
      updatedPayload.away_score = awayScore
      break
    default:
      throw new Error(`Invalid period: ${period}`)
  }

  // Update event_state
  const isFinal = period === 4
  const { error: updateError } = await supabase
    .from('event_state')
    .update({
      payload: updatedPayload,
      status: isFinal ? 'final' : 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)

  if (updateError) {
    throw new Error(`Failed to update event_state: ${updateError.message}`)
  }

  // Update event status if final
  if (isFinal) {
    await supabase
      .from('events')
      .update({ status: 'final', updated_at: new Date().toISOString() })
      .eq('id', eventId)
  }

  // Record winners for quarter mode pools
  const winnersCreated = await recordQuarterWinners(
    supabase,
    eventId,
    homeScore,
    awayScore,
    winType,
    period
  )

  // For final, also record score_change_final for score_change mode pools
  let finalWinnersCreated = 0
  if (isFinal) {
    finalWinnersCreated = await recordScoreChangeWinners(
      supabase,
      eventId,
      homeScore,
      awayScore,
      'score_change_final',
      false
    )
  }

  const periodName = period === 1 ? 'Q1' : period === 2 ? 'Halftime' : period === 3 ? 'Q3' : 'Final'

  return {
    success: true,
    winnersCreated: winnersCreated + finalWinnersCreated,
    message: `${periodName} recorded. Winners created for ${winnersCreated + finalWinnersCreated} pool(s).`
  }
}

/**
 * Record winners for score_change mode pools
 */
async function recordScoreChangeWinners(
  supabase: SupabaseClient<Database>,
  eventId: string,
  homeScore: number,
  awayScore: number,
  winType: string,
  isKickoff: boolean
): Promise<number> {
  // Get linked games with score_change mode pools
  const { data: games } = await supabase
    .from('sq_games')
    .select(`
      id,
      sq_pool_id,
      last_scored_period,
      status,
      sq_pools!inner (
        id,
        scoring_mode,
        reverse_scoring,
        row_numbers,
        col_numbers,
        numbers_locked,
        final_bonus_payout
      )
    `)
    .eq('event_id', eventId)
    .eq('sq_pools.scoring_mode', 'score_change')

  if (!games || games.length === 0) return 0

  let totalWinners = 0

  for (const gameRow of games) {
    const game: SqGame = {
      id: gameRow.id,
      sq_pool_id: gameRow.sq_pool_id,
      last_scored_period: gameRow.last_scored_period,
      status: gameRow.status,
    }

    const pool = gameRow.sq_pools as unknown as SqPool

    // Skip if numbers aren't locked
    if (!pool.numbers_locked || !pool.row_numbers || !pool.col_numbers) {
      continue
    }

    // Get last score change order
    const { data: lastChange } = await supabase
      .from('sq_score_changes')
      .select('change_order')
      .eq('sq_game_id', game.id)
      .order('change_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastOrder = lastChange?.change_order ?? -1
    const newOrder = isKickoff ? 0 : lastOrder + 1

    // Check if this exact score change already exists
    const { data: existingChange } = await supabase
      .from('sq_score_changes')
      .select('id')
      .eq('sq_game_id', game.id)
      .eq('home_score', homeScore)
      .eq('away_score', awayScore)
      .maybeSingle()

    if (!existingChange) {
      // Insert score change record
      const { error: insertError } = await supabase.from('sq_score_changes').insert({
        sq_game_id: game.id,
        home_score: homeScore,
        away_score: awayScore,
        change_order: newOrder,
      })

      if (insertError) {
        console.error(`[admin-scoring] Error inserting score change:`, insertError)
        continue
      }
    }

    // Record winner - use change_order for score_change, payout for final
    const payout = winType === 'score_change_final' ? pool.final_bonus_payout : newOrder

    const recorded = await recordWinnerForScore(
      supabase,
      game.id,
      pool,
      homeScore,
      awayScore,
      winType,
      payout
    )

    totalWinners += recorded

    // Sync game state
    await supabase
      .from('sq_games')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: winType === 'score_change_final' ? 'final' : 'in_progress',
      })
      .eq('id', game.id)
  }

  return totalWinners
}

/**
 * Record winners for quarter mode pools
 */
async function recordQuarterWinners(
  supabase: SupabaseClient<Database>,
  eventId: string,
  homeScore: number,
  awayScore: number,
  winType: string,
  period: number
): Promise<number> {
  // Get linked games with quarter mode pools
  const { data: games } = await supabase
    .from('sq_games')
    .select(`
      id,
      sq_pool_id,
      last_scored_period,
      status,
      sq_pools!inner (
        id,
        scoring_mode,
        reverse_scoring,
        row_numbers,
        col_numbers,
        numbers_locked,
        q1_payout,
        halftime_payout,
        q3_payout,
        final_payout
      )
    `)
    .eq('event_id', eventId)
    .eq('sq_pools.scoring_mode', 'quarter')

  if (!games || games.length === 0) return 0

  let totalWinners = 0

  for (const gameRow of games) {
    const game: SqGame = {
      id: gameRow.id,
      sq_pool_id: gameRow.sq_pool_id,
      last_scored_period: gameRow.last_scored_period,
      status: gameRow.status,
    }

    const pool = gameRow.sq_pools as unknown as SqPool

    // Skip if numbers aren't locked
    if (!pool.numbers_locked || !pool.row_numbers || !pool.col_numbers) {
      continue
    }

    // Skip if already scored this period
    const lastPeriod = game.last_scored_period ?? 0
    if (lastPeriod >= period) {
      continue
    }

    // Determine payout based on period
    let payout: number | null = null
    switch (period) {
      case 1:
        payout = pool.q1_payout
        break
      case 2:
        payout = pool.halftime_payout
        break
      case 3:
        payout = pool.q3_payout
        break
      case 4:
        payout = pool.final_payout
        break
    }

    const recorded = await recordWinnerForScore(
      supabase,
      game.id,
      pool,
      homeScore,
      awayScore,
      winType,
      payout
    )

    totalWinners += recorded

    // Update last_scored_period and quarter scores
    const updateData: Record<string, unknown> = {
      last_scored_period: period,
    }

    switch (period) {
      case 1:
        updateData.q1_home_score = homeScore
        updateData.q1_away_score = awayScore
        break
      case 2:
        updateData.halftime_home_score = homeScore
        updateData.halftime_away_score = awayScore
        break
      case 3:
        updateData.q3_home_score = homeScore
        updateData.q3_away_score = awayScore
        break
      case 4:
        updateData.home_score = homeScore
        updateData.away_score = awayScore
        updateData.status = 'final'
        break
    }

    await supabase.from('sq_games').update(updateData).eq('id', game.id)
  }

  return totalWinners
}

/**
 * Records a winner for a given score
 */
async function recordWinnerForScore(
  supabase: SupabaseClient<Database>,
  gameId: string,
  pool: SqPool,
  homeScore: number,
  awayScore: number,
  winType: string,
  payout: number | null
): Promise<number> {
  let recorded = 0

  const homeDigit = homeScore % 10
  const awayDigit = awayScore % 10

  // Find row/col indices for the winning numbers
  // row_numbers corresponds to HOME team, col_numbers corresponds to AWAY team
  const rowIndex = pool.row_numbers!.findIndex((n) => n === homeDigit)
  const colIndex = pool.col_numbers!.findIndex((n) => n === awayDigit)

  if (rowIndex === -1 || colIndex === -1) {
    console.error(`[admin-scoring] Could not find indices for ${homeDigit}-${awayDigit}`)
    return 0
  }

  // Get the winning square
  const { data: square } = await supabase
    .from('sq_squares')
    .select('id, user_id, participant_name')
    .eq('sq_pool_id', pool.id)
    .eq('row_index', rowIndex)
    .eq('col_index', colIndex)
    .maybeSingle()

  if (square) {
    const winnerName = await getWinnerName(supabase, square.user_id, square.participant_name)

    // Check if this exact winner already exists
    const { data: existingWinners } = await supabase
      .from('sq_winners')
      .select('id')
      .eq('sq_game_id', gameId)
      .eq('square_id', square.id)
      .eq('win_type', winType)

    const existing = existingWinners && existingWinners.length > 0

    if (!existing) {
      const { error } = await supabase.from('sq_winners').insert({
        sq_game_id: gameId,
        square_id: square.id,
        win_type: winType,
        payout: payout,
        winner_name: winnerName,
      })

      if (error) {
        console.error(`[admin-scoring] Error inserting winner:`, error)
      } else {
        recorded++
        console.log(`[admin-scoring] Recorded ${winType} winner: ${winnerName} (square ${awayDigit}-${homeDigit})`)
      }
    }
  }

  // Handle reverse scoring if enabled
  if (pool.reverse_scoring && homeDigit !== awayDigit) {
    const reverseWinType = winType === 'normal' ? 'reverse' : `${winType}_reverse`
    const reverseRowIndex = pool.row_numbers!.findIndex((n) => n === awayDigit)
    const reverseColIndex = pool.col_numbers!.findIndex((n) => n === homeDigit)

    if (reverseRowIndex !== -1 && reverseColIndex !== -1) {
      const { data: reverseSquare } = await supabase
        .from('sq_squares')
        .select('id, user_id, participant_name')
        .eq('sq_pool_id', pool.id)
        .eq('row_index', reverseRowIndex)
        .eq('col_index', reverseColIndex)
        .maybeSingle()

      if (reverseSquare) {
        const reverseWinnerName = await getWinnerName(
          supabase,
          reverseSquare.user_id,
          reverseSquare.participant_name
        )

        // Check if this exact reverse winner already exists
        const { data: existingReverseWinners } = await supabase
          .from('sq_winners')
          .select('id')
          .eq('sq_game_id', gameId)
          .eq('square_id', reverseSquare.id)
          .eq('win_type', reverseWinType)

        const existingReverse = existingReverseWinners && existingReverseWinners.length > 0

        if (!existingReverse) {
          const { error } = await supabase.from('sq_winners').insert({
            sq_game_id: gameId,
            square_id: reverseSquare.id,
            win_type: reverseWinType,
            payout: payout,
            winner_name: reverseWinnerName,
          })

          if (error) {
            console.error(`[admin-scoring] Error inserting reverse winner:`, error)
          } else {
            recorded++
            console.log(`[admin-scoring] Recorded ${reverseWinType} winner: ${reverseWinnerName}`)
          }
        }
      }
    }
  }

  return recorded
}

/**
 * Gets the display name for a winner
 */
async function getWinnerName(
  supabase: SupabaseClient<Database>,
  userId: string | null,
  participantName: string | null
): Promise<string> {
  // For no-account mode, use participant_name
  if (participantName) {
    return participantName
  }

  if (!userId) {
    return 'Abandoned'
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', userId)
    .single()

  return profile?.display_name || profile?.email || 'Unknown'
}
