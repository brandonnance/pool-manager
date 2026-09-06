/**
 * Type definitions for NFL Desperation.
 * Mirrors nd_* tables but trimmed to what the app logic needs.
 */

export type GameStatus = 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'canceled'
export type Winner = 'home' | 'away' | 'tie'
export type Selection = 'home' | 'away'
export type WeekStatus = 'upcoming' | 'open' | 'locked' | 'in_progress' | 'final'

export interface NdGame {
  id: string
  season_year: number
  week_number: number
  espn_game_id: string
  home_team: string
  home_abbr: string
  home_logo: string | null
  away_team: string
  away_abbr: string
  away_logo: string | null
  kickoff_at: string
  venue: string | null
  neutral_site: boolean
  home_score: number | null
  away_score: number | null
  status: GameStatus
  period: number | null
  clock: string | null
  winner: Winner | null
  qualifies: boolean
  last_synced_at?: string | null
  /** Betting line from ESPN — display only, never affects scoring */
  spread?: number | null
  over_under?: number | null
  odds_details?: string | null
  odds_provider?: string | null
}

export interface NdWeek {
  id: string
  season_year: number
  week_number: number
  lock_at: string
  first_kickoff_at: string | null
  last_kickoff_at: string | null
  status: WeekStatus
  finalized_at: string | null
}

export interface NdPick {
  game_id: string
  selection: Selection
}

/** Result of scoring one entry's week. See scoring.ts. */
export interface WeekScore {
  picksMade: number
  correct: number
  wrong: number
  pending: number
  voided: number
  /** correct + wrong — games that count toward n */
  qualifying: number
  busted: boolean
  /** true once every picked game has reached a terminal state */
  complete: boolean
  /** Points if every remaining pick lands. 0 once busted. */
  potentialPoints: number
  /** Final points. null while games are still pending. */
  finalPoints: number | null
}

export type EntryWeekState = 'no_picks' | 'alive' | 'busted' | 'perfect'

/** One row of the week board, already visibility-gated for the viewer. */
export interface BoardEntry {
  id: string
  name: string
  isMe: boolean
  /** null when hidden (before week lock, not me) */
  pickCount: number | null
  /** game_id -> selection; only games whose picks are visible to the viewer */
  picks: Record<string, Selection>
  /** null when hidden (before week lock, not me) */
  score: WeekScore | null
  seasonPoints: number
}

export interface Board {
  week: NdWeek
  games: NdGame[]
  countsVisible: boolean
  entries: BoardEntry[]
  standingsIncludeProvisionalWeek: number | null
}

/** What GET /api/desperation/board returns. */
export interface BoardPayload extends Board {
  currentWeek: number | null
  /** Week after currentWeek, once currentWeek has hit its Sunday-noon lock; else null */
  nextOpenWeek: number | null
  weeks: Array<{ week_number: number; status: WeekStatus; lock_at: string }>
  serverNow: string
}
