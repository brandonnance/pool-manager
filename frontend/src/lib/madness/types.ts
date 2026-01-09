// March Madness Blind Draw Types

export type Round = 'R64' | 'R32' | 'S16' | 'E8' | 'F4' | 'Final'
export type Region = 'East' | 'West' | 'South' | 'Midwest'
export type GameStatus = 'scheduled' | 'in_progress' | 'final'
export type PushRule = 'favorite_advances' | 'underdog_advances' | 'coin_flip'

export interface MmPool {
  id: string
  pool_id: string
  tournament_year: number
  draw_completed: boolean
  draw_completed_at: string | null
  sweet16_payout_pct: number
  elite8_payout_pct: number
  final4_payout_pct: number
  runnerup_payout_pct: number
  champion_payout_pct: number
  push_rule: PushRule
  auto_sync_enabled: boolean
  last_bracket_sync: string | null
  last_odds_sync: string | null
}

export interface MmPoolTeam {
  id: string
  mm_pool_id: string
  team_id: string
  seed: number
  region: Region
  eliminated: boolean
  eliminated_round: Round | null
  external_team_id: string | null
}

export interface MmEntry {
  id: string
  mm_pool_id: string
  user_id: string
  current_team_id: string | null
  original_team_id: string | null
  eliminated: boolean
  eliminated_round: Round | null
  display_name: string | null
  total_payout: number
  created_at: string
}

export interface MmGame {
  id: string
  mm_pool_id: string
  round: Round
  region: Region | null
  game_number: number | null
  higher_seed_team_id: string | null
  lower_seed_team_id: string | null
  spread: number | null
  higher_seed_score: number | null
  lower_seed_score: number | null
  status: GameStatus
  winning_team_id: string | null
  spread_covering_team_id: string | null
  higher_seed_entry_id: string | null
  lower_seed_entry_id: string | null
  advancing_entry_id: string | null
  scheduled_time: string | null
  external_game_id: string | null
  last_synced_at: string | null
}

export interface MmEntryPayout {
  id: string
  mm_pool_id: string
  entry_id: string
  round: Round
  payout_amount: number
  created_at: string
}

// API response types
export interface DrawResult {
  success: boolean
  message: string
  assignments?: Array<{
    entry_id: string
    team_id: string
    display_name: string | null
    team_name: string
    seed: number
    region: string
  }>
}

export interface GameResult {
  game_id: string
  higher_seed_score: number
  lower_seed_score: number
  winner: 'higher' | 'lower'
  spread_cover: 'higher' | 'lower'
  advancing_entry_id: string
  eliminated_entry_id: string
}

// Demo data types
export interface DemoTeam {
  name: string
  abbrev: string
  seed: number
  region: Region
}

export interface DemoGame {
  round: Round
  region: Region | null
  game_number: number
  higher_seed: number
  lower_seed: number
}
