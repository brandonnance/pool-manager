// Shared types for the single-game squares pool components

export interface SqGame {
  id: string
  game_name: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  halftime_home_score: number | null
  halftime_away_score: number | null
  q1_home_score: number | null
  q1_away_score: number | null
  q3_home_score: number | null
  q3_away_score: number | null
  status: string | null
  round: string
  espn_game_id: string | null
  current_period: number | null
  current_clock: string | null
}

export interface SqWinner {
  id: string
  square_id: string | null
  win_type: string
  payout: number | null
  winner_name: string | null
  sq_game_id: string
}

export interface ScoreChange {
  id: string
  home_score: number
  away_score: number
  change_order: number
  sq_game_id: string | null
  quarter_marker?: string[] | null
}
