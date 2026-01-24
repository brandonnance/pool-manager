/**
 * @fileoverview Event State Fetch Helpers
 *
 * Server-side helpers to fetch event_state data from the database.
 * These are used when a pool has scoring_source = 'global'.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { EventState, GolfTournamentPayload, TeamGamePayload } from './types'
import {
  mapTeamGameToLegacy,
  mapGolfLeaderboardToLegacy,
  isTeamGamePayload,
  isGolfTournamentPayload,
  type LegacyGameScores,
  type LegacyGolferResult,
} from './mappers'

type SupabaseClientType = SupabaseClient<Database>

/**
 * Fetches event_state for a specific event ID.
 *
 * @param supabase - Supabase client
 * @param eventId - The event UUID
 * @returns EventState or null if not found
 */
export async function getEventState(
  supabase: SupabaseClientType,
  eventId: string
): Promise<EventState | null> {
  const { data, error } = await supabase
    .from('event_state')
    .select('*')
    .eq('event_id', eventId)
    .single()

  if (error || !data) {
    console.error('[fetch-event-state] Error fetching event_state:', error)
    return null
  }

  return data as unknown as EventState
}

/**
 * Fetches game scores from event_state in legacy format.
 * Used for squares pools with scoring_source = 'global'.
 *
 * @param supabase - Supabase client
 * @param eventId - The event UUID
 * @returns Legacy format game scores or null
 */
export async function getGameScoresFromEventState(
  supabase: SupabaseClientType,
  eventId: string
): Promise<LegacyGameScores | null> {
  const eventState = await getEventState(supabase, eventId)
  if (!eventState) {
    return null
  }

  if (!isTeamGamePayload(eventState.payload)) {
    console.error('[fetch-event-state] Payload is not a team game:', eventState.event_id)
    return null
  }

  return mapTeamGameToLegacy(eventState.payload, eventState.status)
}

/**
 * Fetches golf leaderboard from event_state in legacy format.
 * Used for golf pools with scoring_source = 'global'.
 *
 * @param supabase - Supabase client
 * @param eventId - The event UUID
 * @param tournamentId - The legacy gp_tournaments ID (for golfer mapping)
 * @returns Array of legacy format golfer results
 */
export async function getGolfLeaderboardFromEventState(
  supabase: SupabaseClientType,
  eventId: string,
  tournamentId: string
): Promise<{ results: LegacyGolferResult[]; currentRound: number; roundStatus: string } | null> {
  // 1. Fetch event_state
  const eventState = await getEventState(supabase, eventId)
  if (!eventState) {
    return null
  }

  if (!isGolfTournamentPayload(eventState.payload)) {
    console.error('[fetch-event-state] Payload is not a golf tournament:', eventState.event_id)
    return null
  }

  const payload = eventState.payload as GolfTournamentPayload

  // 2. Build golfer ID mapping (external_player_id -> golfer_id)
  const { data: fieldGolfers, error: fieldError } = await supabase
    .from('gp_tournament_field')
    .select(`
      golfer_id,
      gp_golfers!inner (
        id,
        external_player_id
      )
    `)
    .eq('tournament_id', tournamentId)

  if (fieldError || !fieldGolfers) {
    console.error('[fetch-event-state] Error fetching tournament field:', fieldError)
    return null
  }

  const golferMap = new Map<string, string>()
  for (const f of fieldGolfers) {
    const golfer = f.gp_golfers as unknown as { id: string; external_player_id: string | null }
    if (golfer.external_player_id) {
      golferMap.set(golfer.external_player_id, golfer.id)
    }
  }

  // 3. Map leaderboard to legacy format
  const results = mapGolfLeaderboardToLegacy(payload, golferMap)

  return {
    results,
    currentRound: payload.current_round,
    roundStatus: payload.round_status,
  }
}

/**
 * Fetches multiple game scores from event_state for multi-game pools.
 * Used for playoff squares pools with multiple games.
 *
 * @param supabase - Supabase client
 * @param eventIds - Array of event UUIDs
 * @returns Map of eventId -> legacy scores
 */
export async function getMultipleGameScoresFromEventState(
  supabase: SupabaseClientType,
  eventIds: string[]
): Promise<Map<string, LegacyGameScores>> {
  const results = new Map<string, LegacyGameScores>()

  if (eventIds.length === 0) {
    return results
  }

  const { data, error } = await supabase
    .from('event_state')
    .select('*')
    .in('event_id', eventIds)

  if (error || !data) {
    console.error('[fetch-event-state] Error fetching multiple event_states:', error)
    return results
  }

  for (const eventState of data) {
    if (isTeamGamePayload(eventState.payload)) {
      const mapped = mapTeamGameToLegacy(
        eventState.payload as TeamGamePayload,
        eventState.status
      )
      results.set(eventState.event_id, mapped)
    }
  }

  return results
}

/**
 * Checks if a pool should use global scoring.
 * Helper to determine which data source to use.
 *
 * @param scoringSource - The pool's scoring_source value
 * @param eventId - The pool's event_id value
 * @returns True if should use global scoring
 */
export function shouldUseGlobalScoring(
  scoringSource: string | null,
  eventId: string | null
): boolean {
  return scoringSource === 'global' && eventId !== null
}
