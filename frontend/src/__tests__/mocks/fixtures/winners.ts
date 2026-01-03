/**
 * Test fixtures for winners
 */

import type { Winner } from '@/lib/squares/types'

/**
 * Sample playoff winners
 */
export const playoffWinners: Winner[] = [
  // Wild Card winners
  { id: 'w1', sq_game_id: 'wc1', square_id: 'sq-4-7', win_type: 'normal', payout: null, winner_name: 'Player 1' },
  { id: 'w2', sq_game_id: 'wc1', square_id: 'sq-7-4', win_type: 'reverse', payout: null, winner_name: 'Player 2' },
  // Divisional winners
  { id: 'w3', sq_game_id: 'div1', square_id: 'sq-8-4', win_type: 'normal', payout: null, winner_name: 'Player 3' },
  { id: 'w4', sq_game_id: 'div1', square_id: 'sq-4-8', win_type: 'reverse', payout: null, winner_name: 'Player 4' },
  // Conference winners
  { id: 'w5', sq_game_id: 'conf1', square_id: 'sq-5-4', win_type: 'normal', payout: null, winner_name: 'Player 5' },
]

/**
 * Score change mode winners
 */
export const scoreChangeWinners: Winner[] = [
  // 0-0 start
  { id: 'w1', sq_game_id: 'game-1', square_id: 'sq-0-0', win_type: 'score_change', payout: 1, winner_name: 'Player 1' },
  { id: 'w2', sq_game_id: 'game-1', square_id: 'sq-0-0', win_type: 'score_change_reverse', payout: 1, winner_name: 'Player 1' },
  // 7-0
  { id: 'w3', sq_game_id: 'game-1', square_id: 'sq-7-0', win_type: 'score_change', payout: 2, winner_name: 'Player 2' },
  { id: 'w4', sq_game_id: 'game-1', square_id: 'sq-0-7', win_type: 'score_change_reverse', payout: 2, winner_name: 'Player 3' },
  // 7-3
  { id: 'w5', sq_game_id: 'game-1', square_id: 'sq-7-3', win_type: 'score_change', payout: 3, winner_name: 'Player 4' },
  { id: 'w6', sq_game_id: 'game-1', square_id: 'sq-3-7', win_type: 'score_change_reverse', payout: 3, winner_name: 'Player 5' },
]

/**
 * Score change winners with final
 */
export const scoreChangeWinnersWithFinal: Winner[] = [
  ...scoreChangeWinners,
  // Final score winners
  { id: 'w7', sq_game_id: 'game-1', square_id: 'sq-7-3', win_type: 'score_change_final', payout: null, winner_name: 'Player 4' },
  { id: 'w8', sq_game_id: 'game-1', square_id: 'sq-3-7', win_type: 'score_change_final_reverse', payout: null, winner_name: 'Player 5' },
]

/**
 * Quarter mode winners
 */
export const quarterModeWinners: Winner[] = [
  // Q1
  { id: 'w1', sq_game_id: 'game-1', square_id: 'sq-7-0', win_type: 'q1', payout: null, winner_name: 'Player 1' },
  { id: 'w2', sq_game_id: 'game-1', square_id: 'sq-0-7', win_type: 'q1_reverse', payout: null, winner_name: 'Player 2' },
  // Halftime
  { id: 'w3', sq_game_id: 'game-1', square_id: 'sq-4-0', win_type: 'halftime', payout: null, winner_name: 'Player 3' },
  { id: 'w4', sq_game_id: 'game-1', square_id: 'sq-0-4', win_type: 'halftime_reverse', payout: null, winner_name: 'Player 4' },
  // Q3
  { id: 'w5', sq_game_id: 'game-1', square_id: 'sq-1-7', win_type: 'q3', payout: null, winner_name: 'Player 5' },
  { id: 'w6', sq_game_id: 'game-1', square_id: 'sq-7-1', win_type: 'q3_reverse', payout: null, winner_name: 'Player 6' },
  // Final
  { id: 'w7', sq_game_id: 'game-1', square_id: 'sq-8-4', win_type: 'normal', payout: null, winner_name: 'Player 7' },
  { id: 'w8', sq_game_id: 'game-1', square_id: 'sq-4-8', win_type: 'reverse', payout: null, winner_name: 'Player 8' },
]

/**
 * Super Bowl winners with halftime
 */
export const superBowlWinners: Winner[] = [
  { id: 'w1', sq_game_id: 'sb', square_id: 'sq-4-4', win_type: 'halftime', payout: null, winner_name: 'Player 1' },
  { id: 'w2', sq_game_id: 'sb', square_id: 'sq-4-4', win_type: 'halftime_reverse', payout: null, winner_name: 'Player 1' },
  { id: 'w3', sq_game_id: 'sb', square_id: 'sq-1-8', win_type: 'normal', payout: null, winner_name: 'Player 2' },
  { id: 'w4', sq_game_id: 'sb', square_id: 'sq-8-1', win_type: 'reverse', payout: null, winner_name: 'Player 3' },
]

/**
 * Create a winner for a specific position
 */
export function createWinner(options: {
  id?: string
  gameId: string
  squareId: string | null
  winType: string
  payout?: number | null
  winnerName?: string
}): Winner {
  return {
    id: options.id ?? `winner-${Date.now()}`,
    sq_game_id: options.gameId,
    square_id: options.squareId,
    win_type: options.winType,
    payout: options.payout ?? null,
    winner_name: options.winnerName ?? null,
  }
}
