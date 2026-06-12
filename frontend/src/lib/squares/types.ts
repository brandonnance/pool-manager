/**
 * Type definitions for the squares pool system
 */

/**
 * Round types for playoff and single game modes
 * Used for determining winner highlighting colors
 */
export type WinningRound =
  | 'wild_card'
  | 'divisional'
  | 'conference'
  | 'super_bowl'
  | 'super_bowl_halftime'
  | 'single_game'
  // March Madness rounds
  | 'mm_r64'
  | 'mm_r32'
  | 'mm_s16'
  | 'mm_e8'
  | 'mm_f4'
  | 'mm_final'
  | 'score_change_forward'
  | 'score_change_reverse'
  | 'score_change_both'
  | 'score_change_final'
  | 'score_change_final_reverse'
  | 'score_change_final_both'
  // Hybrid mode quarter winners
  | 'hybrid_q1'
  | 'hybrid_q1_reverse'
  | 'hybrid_q1_both'
  | 'hybrid_halftime'
  | 'hybrid_halftime_reverse'
  | 'hybrid_halftime_both'
  | 'hybrid_q3'
  | 'hybrid_q3_reverse'
  | 'hybrid_q3_both'
  | 'hybrid_final'
  | 'hybrid_final_reverse'
  | 'hybrid_final_both'
  | null

/**
 * A single square in the 10x10 grid
 */
export interface Square {
  id: string
  row_index: number
  col_index: number
  user_id?: string | null
  participant_name?: string | null
}

/**
 * A winner record from the database
 */
export interface Winner {
  id: string
  sq_game_id: string
  square_id: string | null
  win_type: string
  payout: number | null
  winner_name: string | null
}

/**
 * A game in the squares pool
 */
export interface Game {
  id: string
  round: string
  home_score: number | null
  away_score: number | null
  status: string | null
}

/**
 * A score change event (for score_change mode)
 */
export interface ScoreChange {
  id?: string
  sq_game_id?: string | null
  home_score: number
  away_score: number
  change_order: number
  created_at?: string | null
}

/**
 * Result of a score validation check
 */
export interface ScoreValidationResult {
  isValid: boolean
  error: string | null
}

/**
 * Win types for squares
 */
export type WinType =
  | 'normal'
  | 'reverse'
  | 'halftime'
  | 'halftime_reverse'
  | 'q1'
  | 'q1_reverse'
  | 'q3'
  | 'q3_reverse'
  | 'score_change'
  | 'score_change_reverse'
  | 'score_change_final'
  | 'score_change_final_reverse'

/**
 * Pool modes
 */
export type PoolMode = 'single_game' | 'full_playoff'

/**
 * Scoring modes for single game
 */
export type ScoringMode = 'quarter' | 'score_change'
