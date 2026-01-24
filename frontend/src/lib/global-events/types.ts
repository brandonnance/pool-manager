/**
 * @fileoverview Global Events Type Definitions
 *
 * TypeScript types for the global events system, including events,
 * event state, milestones, and provider-specific payloads.
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
 * Core Event record - represents a game or tournament
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
 * Event State - current live state of an event
 */
export interface EventState {
  event_id: string
  status: string
  payload: EventStatePayload
  last_provider_update_at: string | null
  updated_at: string
}

/**
 * Team Game State Payload (NFL, NCAA FB, NCAA BB)
 * Used in event_state.payload for team sports
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
 * Used in event_state.payload for golf tournaments
 */
export interface GolfTournamentPayload {
  current_round: number
  round_status: string // 'not_started' | 'in_progress' | 'complete' | 'official'
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
 * Event Milestone - significant moments during an event
 */
export interface EventMilestone {
  id: string
  event_id: string
  milestone_type: string
  payload: Record<string, unknown>
  created_at: string
}

// Milestone types for team games
export type TeamGameMilestoneType =
  | 'quarter_end'
  | 'halftime'
  | 'score_change'
  | 'final'

// Milestone types for golf
export type GolfMilestoneType =
  | 'round_start'
  | 'round_complete'
  | 'cut_made'
  | 'leader_change'
  | 'tournament_complete'

/**
 * Worker Lease - ensures only one worker polls an event at a time
 */
export interface WorkerLease {
  event_id: string
  worker_id: string
  leased_at: string
  expires_at: string
  last_poll_at: string | null
}

/**
 * Golf Tournament Global - tournament-specific metadata
 */
export interface GolfTournamentGlobal {
  event_id: string
  field_status: 'unknown' | 'pending' | 'set' | 'locked'
  field_last_checked_at: string | null
  field_imported_at: string | null
}

/**
 * Golf Field Entry - player in a tournament field
 */
export interface GolfFieldEntry {
  id: string
  event_id: string
  golfer_id: string
  name: string
  metadata: Record<string, unknown>
  created_at: string
}

/**
 * Polling intervals based on event state (in seconds)
 */
export const POLLING_INTERVALS = {
  PRE_GAME_LONG: 15 * 60,    // 15 minutes - more than 1 hour before start
  PRE_GAME_SHORT: 5 * 60,    // 5 minutes - less than 1 hour before start
  IN_PROGRESS: 15,           // 15 seconds - active game
  HALFTIME: 30,              // 30 seconds - halftime or slow period
  FINAL: 0,                  // Stop polling
} as const

/**
 * Determines the appropriate polling interval for an event
 */
export function getPollingInterval(event: Event, state?: EventState): number {
  if (event.status === 'final' || event.status === 'cancelled') {
    return POLLING_INTERVALS.FINAL
  }

  if (event.status === 'in_progress') {
    // Check for halftime in team games
    if (event.event_type === 'team_game' && state?.payload) {
      const payload = state.payload as TeamGamePayload
      if (payload.is_halftime) {
        return POLLING_INTERVALS.HALFTIME
      }
    }
    return POLLING_INTERVALS.IN_PROGRESS
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
