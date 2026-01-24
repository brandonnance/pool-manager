/**
 * @fileoverview Shared types for Edge Functions
 */

// Sport types supported by the global events system
export type Sport = 'nfl' | 'ncaa_fb' | 'ncaa_bb' | 'pga'

// Event types
export type EventType = 'team_game' | 'golf_tournament'

// Data providers
export type Provider = 'espn' | 'slashgolf' | 'manual'

// Event status
export type EventStatus = 'scheduled' | 'in_progress' | 'final' | 'cancelled'

/**
 * Core Event record
 */
export interface Event {
  id: string
  sport: Sport
  event_type: EventType
  provider: Provider
  provider_event_id: string
  name: string
  start_time: string | null
  status: EventStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

/**
 * Team Game State Payload
 */
export interface TeamGamePayload {
  home_score: number
  away_score: number
  home_team: string
  away_team: string
  period: number
  clock: string
  is_halftime?: boolean
  quarter_scores?: {
    q1?: { home: number; away: number }
    q2?: { home: number; away: number }
    q3?: { home: number; away: number }
    q4?: { home: number; away: number }
    ot?: { home: number; away: number }
  }
}

/**
 * Golf Tournament State Payload
 */
export interface GolfTournamentPayload {
  current_round: number
  round_status: string
  cut_line?: number
  leaderboard: GolfLeaderboardEntry[]
}

export interface GolfLeaderboardEntry {
  player_id: string
  player_name: string
  position: string
  to_par: number
  thru: string | number
  total_strokes?: number
  status: 'active' | 'cut' | 'withdrawn' | 'disqualified'
  rounds: {
    round1?: number
    round2?: number
    round3?: number
    round4?: number
  }
}

// Union type for all possible payloads
export type EventStatePayload = TeamGamePayload | GolfTournamentPayload

/**
 * Polling intervals in seconds
 */
export const POLLING_INTERVALS = {
  PRE_GAME_LONG: 15 * 60,    // 15 minutes
  PRE_GAME_SHORT: 5 * 60,    // 5 minutes
  IN_PROGRESS: 15,           // 15 seconds
  HALFTIME: 30,              // 30 seconds
  FINAL: 0,                  // Stop polling
} as const

/**
 * Lease duration in seconds (how long a worker can hold a lock)
 */
export const LEASE_DURATION_SECONDS = 60

/**
 * Determines if an event needs polling
 */
export function eventNeedsPolling(event: Event): boolean {
  // Final or cancelled events don't need polling
  if (event.status === 'final' || event.status === 'cancelled') {
    return false
  }

  // Manual events don't get polled
  if (event.provider === 'manual') {
    return false
  }

  // In-progress events always need polling
  if (event.status === 'in_progress') {
    return true
  }

  // Scheduled events need polling if they start within 2 hours
  if (event.start_time) {
    const startTime = new Date(event.start_time).getTime()
    const now = Date.now()
    const hoursUntilStart = (startTime - now) / (1000 * 60 * 60)
    return hoursUntilStart <= 2
  }

  return false
}

/**
 * Determines the appropriate polling interval for an event
 */
export function getPollingInterval(event: Event, isHalftime: boolean = false): number {
  if (event.status === 'final' || event.status === 'cancelled') {
    return POLLING_INTERVALS.FINAL
  }

  if (event.status === 'in_progress') {
    return isHalftime ? POLLING_INTERVALS.HALFTIME : POLLING_INTERVALS.IN_PROGRESS
  }

  // Pre-game: check time until start
  if (event.start_time) {
    const startTime = new Date(event.start_time).getTime()
    const now = Date.now()
    const hoursUntilStart = (startTime - now) / (1000 * 60 * 60)

    if (hoursUntilStart <= 1) {
      return POLLING_INTERVALS.PRE_GAME_SHORT
    }
  }

  return POLLING_INTERVALS.PRE_GAME_LONG
}
