/**
 * @fileoverview Score Squares Pools Edge Function
 *
 * Called after poll-event updates event_state. Processes all squares pools
 * linked to the event and records winners based on scoring mode.
 *
 * Supports two scoring modes:
 * - 'score_change': Every score change creates a winner
 * - 'quarter': Winners at Q1, halftime, Q3, and final
 *
 * @route POST /functions/v1/score-squares-pools
 * @body { event_id: string, payload: TeamGamePayload, status: EventStatus }
 */

import { createServiceClient } from '../_shared/supabase-client.ts'
import type { TeamGamePayload, EventStatus } from '../_shared/types.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ScoreRequest {
  event_id: string
  payload: TeamGamePayload
  status: EventStatus
  previous_status?: EventStatus
}

interface SqPool {
  id: string
  scoring_mode: 'quarter' | 'score_change'
  reverse_scoring: boolean
  row_numbers: number[]
  col_numbers: number[]
  numbers_locked: boolean
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
  last_scored_period: number
  status: string | null
}

interface WinnerRecord {
  sq_game_id: string
  square_id: string
  win_type: string
  payout: number | null
  winner_name: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createServiceClient()

  try {
    const body: ScoreRequest = await req.json()
    const { event_id, payload, status, previous_status } = body

    if (!event_id || !payload) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing event_id or payload' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[score-squares] Processing event ${event_id}, status=${status}, period=${payload.period}`)

    // Find all sq_games linked to this event where pool has scoring_source='global'
    const { data: games, error: gamesError } = await supabase
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
          per_change_payout,
          final_bonus_payout,
          q1_payout,
          halftime_payout,
          q3_payout,
          final_payout,
          scoring_source
        )
      `)
      .eq('event_id', event_id)
      .eq('sq_pools.scoring_source', 'global')

    if (gamesError) {
      console.error('[score-squares] Error fetching games:', gamesError)
      return new Response(
        JSON.stringify({ success: false, error: gamesError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!games || games.length === 0) {
      console.log(`[score-squares] No global-scoring games found for event ${event_id}`)
      return new Response(
        JSON.stringify({ success: true, games_processed: 0 }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[score-squares] Found ${games.length} game(s) to process`)

    let winnersRecorded = 0
    let gamesProcessed = 0

    for (const gameRow of games) {
      const game: SqGame = {
        id: gameRow.id,
        sq_pool_id: gameRow.sq_pool_id,
        last_scored_period: gameRow.last_scored_period || 0,
        status: gameRow.status,
      }

      const pool = gameRow.sq_pools as unknown as SqPool

      // Skip if numbers aren't locked (can't determine winners without grid)
      if (!pool.numbers_locked || !pool.row_numbers || !pool.col_numbers) {
        console.log(`[score-squares] Skipping game ${game.id} - numbers not locked`)
        continue
      }

      gamesProcessed++

      // Sync sq_games fields with current state
      await syncGameState(supabase, game.id, payload, status)

      // Process based on scoring mode
      if (pool.scoring_mode === 'score_change') {
        const recorded = await processScoreChangeMode(
          supabase,
          game,
          pool,
          payload,
          status,
          previous_status
        )
        winnersRecorded += recorded
      } else {
        // quarter mode
        const recorded = await processQuarterMode(
          supabase,
          game,
          pool,
          payload,
          status
        )
        winnersRecorded += recorded
      }
    }

    console.log(`[score-squares] Processed ${gamesProcessed} games, recorded ${winnersRecorded} winners`)

    return new Response(
      JSON.stringify({
        success: true,
        games_processed: gamesProcessed,
        winners_recorded: winnersRecorded,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[score-squares] Error:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Syncs sq_games table with current event state
 */
async function syncGameState(
  supabase: SupabaseClient,
  gameId: string,
  payload: TeamGamePayload,
  status: EventStatus
): Promise<void> {
  const updates: Record<string, unknown> = {
    home_score: payload.home_score,
    away_score: payload.away_score,
    current_period: payload.period,
    current_clock: payload.clock,
    status: status,
  }

  // Sync quarter scores if available
  if (payload.quarter_scores) {
    if (payload.quarter_scores.q1) {
      updates.q1_home_score = payload.quarter_scores.q1.home
      updates.q1_away_score = payload.quarter_scores.q1.away
    }
    if (payload.quarter_scores.q2) {
      updates.halftime_home_score = payload.quarter_scores.q2.home
      updates.halftime_away_score = payload.quarter_scores.q2.away
    }
    if (payload.quarter_scores.q3) {
      updates.q3_home_score = payload.quarter_scores.q3.home
      updates.q3_away_score = payload.quarter_scores.q3.away
    }
  }

  const { error } = await supabase
    .from('sq_games')
    .update(updates)
    .eq('id', gameId)

  if (error) {
    console.error(`[score-squares] Error syncing game ${gameId}:`, error)
  }
}

/**
 * Process score_change mode - winner on every score change
 */
async function processScoreChangeMode(
  supabase: SupabaseClient,
  game: SqGame,
  pool: SqPool,
  payload: TeamGamePayload,
  status: EventStatus,
  previousStatus?: EventStatus
): Promise<number> {
  let winnersRecorded = 0

  const homeScore = payload.home_score
  const awayScore = payload.away_score

  // Get last recorded score change
  const { data: lastChange } = await supabase
    .from('sq_score_changes')
    .select('home_score, away_score, change_order')
    .eq('sq_game_id', game.id)
    .order('change_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastHomeScore = lastChange?.home_score ?? null
  const lastAwayScore = lastChange?.away_score ?? null
  let lastChangeOrder = lastChange?.change_order ?? -1

  // Check if this is a new score compared to last recorded
  const isNewScore = lastHomeScore !== homeScore || lastAwayScore !== awayScore

  // Handle game start (0-0 kickoff)
  // We need kickoff if: game is now in_progress AND no score changes recorded yet
  const isGameStart = previousStatus === 'scheduled' && status === 'in_progress'
  const needsKickoffWinner = isGameStart && lastChange === null

  if (needsKickoffWinner) {
    // Record 0-0 as the kickoff winner (change_order = 0)
    console.log(`[score-squares] Recording kickoff winner (0-0) for game ${game.id}`)

    const { error: kickoffError } = await supabase.from('sq_score_changes').insert({
      sq_game_id: game.id,
      home_score: 0,
      away_score: 0,
      change_order: 0,
    })

    if (kickoffError) {
      console.error(`[score-squares] Error inserting 0-0 kickoff:`, kickoffError)
    } else {
      // Record winner for 0-0 with change_order=0
      const recorded = await recordWinnerForScore(
        supabase,
        game.id,
        pool,
        0,
        0,
        'score_change',
        0 // change_order for kickoff
      )
      winnersRecorded += recorded
      lastChangeOrder = 0
    }

    // If the current score is NOT 0-0, also record the current score
    // This handles cases where the game already has points when we first detect kickoff
    if (homeScore !== 0 || awayScore !== 0) {
      console.log(`[score-squares] Also recording current score ${homeScore}-${awayScore} after kickoff`)

      const newOrder = lastChangeOrder + 1
      const { error: scoreError } = await supabase.from('sq_score_changes').insert({
        sq_game_id: game.id,
        home_score: homeScore,
        away_score: awayScore,
        change_order: newOrder,
      })

      if (scoreError) {
        console.error(`[score-squares] Error inserting current score after kickoff:`, scoreError)
      } else {
        const recorded = await recordWinnerForScore(
          supabase,
          game.id,
          pool,
          homeScore,
          awayScore,
          'score_change',
          newOrder
        )
        winnersRecorded += recorded
      }
    }
  }
  // Handle score changes during game (not kickoff scenario)
  else if (isNewScore && status === 'in_progress') {
    console.log(`[score-squares] Score changed: ${lastHomeScore}-${lastAwayScore} -> ${homeScore}-${awayScore}`)

    const newOrder = lastChangeOrder + 1
    const { error: insertError } = await supabase.from('sq_score_changes').insert({
      sq_game_id: game.id,
      home_score: homeScore,
      away_score: awayScore,
      change_order: newOrder,
    })

    if (insertError) {
      console.error(`[score-squares] Error inserting score change:`, insertError)
    } else {
      // Record winner with change_order stored in payout field
      const recorded = await recordWinnerForScore(
        supabase,
        game.id,
        pool,
        homeScore,
        awayScore,
        'score_change',
        newOrder
      )
      winnersRecorded += recorded
    }
  }

  // Handle final score
  if (status === 'final' && game.status !== 'final') {
    console.log(`[score-squares] Game final: ${homeScore}-${awayScore}`)

    // Ensure final score is recorded if it's different from last change
    if (isNewScore) {
      const newOrder = lastChangeOrder + 1
      const { error: finalScoreError } = await supabase.from('sq_score_changes').insert({
        sq_game_id: game.id,
        home_score: homeScore,
        away_score: awayScore,
        change_order: newOrder,
      })
      if (finalScoreError) {
        console.error(`[score-squares] Error inserting final score change:`, finalScoreError)
      }
    }

    // Record final winner - use actual bonus payout amount (not change_order)
    const recorded = await recordWinnerForScore(
      supabase,
      game.id,
      pool,
      homeScore,
      awayScore,
      'score_change_final',
      pool.final_bonus_payout
    )
    winnersRecorded += recorded
  }

  return winnersRecorded
}

/**
 * Process quarter mode - winners at Q1, halftime, Q3, and final
 */
async function processQuarterMode(
  supabase: SupabaseClient,
  game: SqGame,
  pool: SqPool,
  payload: TeamGamePayload,
  status: EventStatus
): Promise<number> {
  let winnersRecorded = 0
  const currentPeriod = payload.period
  const lastScoredPeriod = game.last_scored_period || 0
  const quarterScores = payload.quarter_scores

  // Period transitions we care about:
  // Period 2 starting (Q1 ended) -> record Q1 winner
  // Period 3 starting (Halftime ended) -> record Halftime winner
  // Period 4 starting (Q3 ended) -> record Q3 winner
  // Status = final -> record Final winner

  // Q1 winner (when period >= 2 and we haven't scored Q1 yet)
  if (currentPeriod >= 2 && lastScoredPeriod < 1 && quarterScores?.q1) {
    console.log(`[score-squares] Recording Q1 winner: ${quarterScores.q1.home}-${quarterScores.q1.away}`)

    const recorded = await recordWinnerForScore(
      supabase,
      game.id,
      pool,
      quarterScores.q1.home,
      quarterScores.q1.away,
      'q1',
      pool.q1_payout
    )
    winnersRecorded += recorded

    await supabase
      .from('sq_games')
      .update({ last_scored_period: 1 })
      .eq('id', game.id)
  }

  // Halftime winner (when period >= 3 and we haven't scored halftime yet)
  if (currentPeriod >= 3 && lastScoredPeriod < 2 && quarterScores?.q2) {
    console.log(`[score-squares] Recording halftime winner: ${quarterScores.q2.home}-${quarterScores.q2.away}`)

    const recorded = await recordWinnerForScore(
      supabase,
      game.id,
      pool,
      quarterScores.q2.home,
      quarterScores.q2.away,
      'halftime',
      pool.halftime_payout
    )
    winnersRecorded += recorded

    await supabase
      .from('sq_games')
      .update({ last_scored_period: 2 })
      .eq('id', game.id)
  }

  // Q3 winner (when period >= 4 and we haven't scored Q3 yet)
  if (currentPeriod >= 4 && lastScoredPeriod < 3 && quarterScores?.q3) {
    console.log(`[score-squares] Recording Q3 winner: ${quarterScores.q3.home}-${quarterScores.q3.away}`)

    const recorded = await recordWinnerForScore(
      supabase,
      game.id,
      pool,
      quarterScores.q3.home,
      quarterScores.q3.away,
      'q3',
      pool.q3_payout
    )
    winnersRecorded += recorded

    await supabase
      .from('sq_games')
      .update({ last_scored_period: 3 })
      .eq('id', game.id)
  }

  // Final winner (when game is final and we haven't scored final yet)
  if (status === 'final' && lastScoredPeriod < 4) {
    console.log(`[score-squares] Recording final winner: ${payload.home_score}-${payload.away_score}`)

    const recorded = await recordWinnerForScore(
      supabase,
      game.id,
      pool,
      payload.home_score,
      payload.away_score,
      'normal',
      pool.final_payout
    )
    winnersRecorded += recorded

    await supabase
      .from('sq_games')
      .update({ last_scored_period: 4 })
      .eq('id', game.id)
  }

  return winnersRecorded
}

/**
 * Records a winner for a given score
 *
 * @param changeOrder - For score_change mode, this is the order number (stored in payout field for UI grouping)
 *                      For quarter mode, this is the actual payout amount
 */
async function recordWinnerForScore(
  supabase: SupabaseClient,
  gameId: string,
  pool: SqPool,
  homeScore: number,
  awayScore: number,
  winType: string,
  changeOrder: number | null
): Promise<number> {
  let recorded = 0

  const homeDigit = homeScore % 10
  const awayDigit = awayScore % 10

  // Find row/col indices for the winning numbers
  // row_numbers corresponds to HOME team, col_numbers corresponds to AWAY team
  const rowIndex = pool.row_numbers.findIndex((n) => n === homeDigit)
  const colIndex = pool.col_numbers.findIndex((n) => n === awayDigit)

  if (rowIndex === -1 || colIndex === -1) {
    console.error(`[score-squares] Could not find indices for ${homeDigit}-${awayDigit}`)
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

    // Check if this exact winner already exists (prevent duplicates)
    // For score_change mode, check by square_id since each score maps to one square
    // For other modes, check by win_type
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
        payout: changeOrder,
        winner_name: winnerName,
      })

      if (error) {
        console.error(`[score-squares] Error inserting winner:`, error)
      } else {
        recorded++
        console.log(`[score-squares] Recorded ${winType} winner: ${winnerName} (square ${awayDigit}-${homeDigit}, order=${changeOrder})`)
      }
    } else {
      console.log(`[score-squares] Winner already exists for ${winType} at square ${awayDigit}-${homeDigit}`)
    }
  }

  // Handle reverse scoring if enabled
  if (pool.reverse_scoring && homeDigit !== awayDigit) {
    const reverseWinType = winType === 'normal' ? 'reverse' : `${winType}_reverse`
    const reverseRowIndex = pool.row_numbers.findIndex((n) => n === awayDigit)
    const reverseColIndex = pool.col_numbers.findIndex((n) => n === homeDigit)

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
            payout: changeOrder,
            winner_name: reverseWinnerName,
          })

          if (error) {
            console.error(`[score-squares] Error inserting reverse winner:`, error)
          } else {
            recorded++
            console.log(`[score-squares] Recorded ${reverseWinType} winner: ${reverseWinnerName} (square ${homeDigit}-${awayDigit}, order=${changeOrder})`)
          }
        } else {
          console.log(`[score-squares] Reverse winner already exists for ${reverseWinType} at square ${homeDigit}-${awayDigit}`)
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
  supabase: SupabaseClient,
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
