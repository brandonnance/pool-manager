/**
 * @fileoverview Event State Mappers
 *
 * Functions to transform event_state.payload data to legacy table formats.
 * These allow components to work with a consistent interface regardless
 * of whether data comes from legacy tables or global event_state.
 */

import type { TeamGamePayload, GolfTournamentPayload, GolfLeaderboardEntry } from './types'

/**
 * Legacy sq_games format for display
 */
export interface LegacyGameScores {
  home_score: number | null
  away_score: number | null
  home_team: string
  away_team: string
  status: string
  current_period: number | null
  current_clock: string | null
  halftime_home_score: number | null
  halftime_away_score: number | null
  q1_home_score: number | null
  q1_away_score: number | null
  q3_home_score: number | null
  q3_away_score: number | null
}

/**
 * Legacy gp_golfer_results format for display
 */
export interface LegacyGolferResult {
  golfer_id: string
  position: string
  to_par: number
  thru: number | null
  round_1: number | null
  round_2: number | null
  round_3: number | null
  round_4: number | null
  made_cut: boolean
  total_score: number
}

/**
 * Maps TeamGamePayload from event_state to legacy sq_games format.
 * Used for squares pools that need score data.
 */
export function mapTeamGameToLegacy(
  payload: TeamGamePayload,
  eventStatus: string
): LegacyGameScores {
  // Map event status to game status
  let status: string
  switch (eventStatus) {
    case 'in_progress':
      status = 'in_progress'
      break
    case 'final':
      status = 'final'
      break
    default:
      status = 'scheduled'
  }

  // Extract quarter scores
  const q1 = payload.quarter_scores?.q1
  const q2 = payload.quarter_scores?.q2
  const q3 = payload.quarter_scores?.q3

  // Calculate halftime scores (Q1 + Q2)
  let halftimeHome: number | null = null
  let halftimeAway: number | null = null
  if (q1 && q2) {
    halftimeHome = q1.home + q2.home
    halftimeAway = q1.away + q2.away
  } else if (payload.is_halftime && q1) {
    // If at halftime but q2 not recorded yet, use current scores
    halftimeHome = payload.home_score
    halftimeAway = payload.away_score
  }

  // Q3 end scores (halftime + Q3)
  let q3EndHome: number | null = null
  let q3EndAway: number | null = null
  if (halftimeHome !== null && halftimeAway !== null && q3) {
    q3EndHome = halftimeHome + q3.home
    q3EndAway = halftimeAway + q3.away
  }

  return {
    home_score: payload.home_score,
    away_score: payload.away_score,
    home_team: payload.home_team,
    away_team: payload.away_team,
    status,
    current_period: payload.period,
    current_clock: payload.clock,
    halftime_home_score: halftimeHome,
    halftime_away_score: halftimeAway,
    q1_home_score: q1?.home ?? null,
    q1_away_score: q1?.away ?? null,
    q3_home_score: q3EndHome,
    q3_away_score: q3EndAway,
  }
}

/**
 * Maps a single GolfLeaderboardEntry to legacy gp_golfer_results format.
 * Requires a mapping from external player IDs to internal golfer IDs.
 *
 * @param entry - Leaderboard entry from event_state
 * @param golferIdMap - Map of external_player_id -> internal golfer_id
 * @returns Legacy format or null if golfer not found in map
 */
export function mapGolfEntryToLegacy(
  entry: GolfLeaderboardEntry,
  golferIdMap: Map<string, string>
): LegacyGolferResult | null {
  const golferId = golferIdMap.get(entry.player_id)
  if (!golferId) {
    return null
  }

  const madeCut = entry.status !== 'cut'

  // Calculate total strokes
  let totalStrokes = 0
  let roundsPlayed = 0

  if (entry.total_strokes !== undefined && !isNaN(entry.total_strokes)) {
    totalStrokes = entry.total_strokes
    if (entry.rounds.round1 !== undefined) roundsPlayed++
    if (entry.rounds.round2 !== undefined) roundsPlayed++
    if (entry.rounds.round3 !== undefined) roundsPlayed++
    if (entry.rounds.round4 !== undefined) roundsPlayed++
  } else {
    // Calculate from individual rounds
    if (entry.rounds.round1 !== undefined) {
      totalStrokes += entry.rounds.round1
      roundsPlayed++
    }
    if (entry.rounds.round2 !== undefined) {
      totalStrokes += entry.rounds.round2
      roundsPlayed++
    }
    if (entry.rounds.round3 !== undefined) {
      totalStrokes += entry.rounds.round3
      roundsPlayed++
    }
    if (entry.rounds.round4 !== undefined) {
      totalStrokes += entry.rounds.round4
      roundsPlayed++
    }
  }

  // Add penalty for missed cut (80 each for R3 and R4)
  if (!madeCut && roundsPlayed === 2) {
    totalStrokes += 80 + 80
  }

  // Convert thru to number
  let thruHoles: number | null = null
  if (entry.thru !== undefined && entry.thru !== null) {
    if (typeof entry.thru === 'number') {
      thruHoles = entry.thru
    } else if (entry.thru === 'F' || entry.thru === 'f') {
      thruHoles = 18
    } else {
      const parsed = parseInt(String(entry.thru))
      if (!isNaN(parsed)) {
        thruHoles = parsed
      }
    }
  }

  return {
    golfer_id: golferId,
    position: entry.position || '-',
    to_par: entry.to_par,
    thru: thruHoles,
    round_1: entry.rounds.round1 ?? null,
    round_2: entry.rounds.round2 ?? null,
    round_3: entry.rounds.round3 ?? null,
    round_4: entry.rounds.round4 ?? null,
    made_cut: madeCut,
    total_score: totalStrokes,
  }
}

/**
 * Maps an entire golf leaderboard to legacy format.
 * Only includes golfers that exist in the provided ID map.
 *
 * @param payload - Golf tournament payload from event_state
 * @param golferIdMap - Map of external_player_id -> internal golfer_id
 * @returns Array of legacy format results
 */
export function mapGolfLeaderboardToLegacy(
  payload: GolfTournamentPayload,
  golferIdMap: Map<string, string>
): LegacyGolferResult[] {
  const results: LegacyGolferResult[] = []

  for (const entry of payload.leaderboard) {
    const mapped = mapGolfEntryToLegacy(entry, golferIdMap)
    if (mapped) {
      results.push(mapped)
    }
  }

  return results
}

/**
 * Type guard to check if payload is TeamGamePayload
 */
export function isTeamGamePayload(payload: unknown): payload is TeamGamePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'home_score' in payload &&
    'away_score' in payload &&
    'home_team' in payload &&
    'away_team' in payload
  )
}

/**
 * Type guard to check if payload is GolfTournamentPayload
 */
export function isGolfTournamentPayload(payload: unknown): payload is GolfTournamentPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'leaderboard' in payload &&
    Array.isArray((payload as GolfTournamentPayload).leaderboard)
  )
}
