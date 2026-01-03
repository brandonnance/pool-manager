/**
 * Test fixtures for games
 */

import type { Game } from '@/lib/squares/types'

/**
 * Sample playoff games
 */
export const playoffGames: Game[] = [
  // Wild Card Round
  { id: 'wc1', round: 'wild_card', home_score: 24, away_score: 17, status: 'final' },
  { id: 'wc2', round: 'wild_card', home_score: 31, away_score: 28, status: 'final' },
  { id: 'wc3', round: 'wild_card', home_score: 21, away_score: 20, status: 'final' },
  { id: 'wc4', round: 'wild_card', home_score: 27, away_score: 24, status: 'final' },
  { id: 'wc5', round: 'wild_card', home_score: 35, away_score: 28, status: 'final' },
  { id: 'wc6', round: 'wild_card', home_score: 28, away_score: 21, status: 'final' },
  // Divisional Round
  { id: 'div1', round: 'divisional', home_score: 28, away_score: 14, status: 'final' },
  { id: 'div2', round: 'divisional', home_score: 24, away_score: 21, status: 'final' },
  { id: 'div3', round: 'divisional', home_score: 31, away_score: 17, status: 'final' },
  { id: 'div4', round: 'divisional', home_score: 38, away_score: 35, status: 'final' },
  // Conference Championships
  { id: 'conf1', round: 'conference', home_score: 35, away_score: 24, status: 'final' },
  { id: 'conf2', round: 'conference', home_score: 28, away_score: 24, status: 'final' },
  // Super Bowl
  { id: 'sb', round: 'super_bowl', home_score: 31, away_score: 28, status: 'final' },
]

/**
 * Playoff games with some in progress
 */
export const playoffGamesInProgress: Game[] = [
  { id: 'wc1', round: 'wild_card', home_score: 24, away_score: 17, status: 'final' },
  { id: 'wc2', round: 'wild_card', home_score: 31, away_score: 28, status: 'final' },
  { id: 'div1', round: 'divisional', home_score: 14, away_score: 7, status: 'in_progress' },
  { id: 'div2', round: 'divisional', home_score: null, away_score: null, status: 'scheduled' },
]

/**
 * Single game fixture
 */
export const singleGame: Game = {
  id: 'game-1',
  round: 'single_game',
  home_score: 21,
  away_score: 17,
  status: 'in_progress',
}

/**
 * Single game - scheduled
 */
export const scheduledGame: Game = {
  id: 'game-1',
  round: 'single_game',
  home_score: null,
  away_score: null,
  status: 'scheduled',
}

/**
 * Single game - final
 */
export const finalGame: Game = {
  id: 'game-1',
  round: 'single_game',
  home_score: 28,
  away_score: 24,
  status: 'final',
}

/**
 * Super Bowl with halftime scores
 */
export const superBowlGame: Game = {
  id: 'sb',
  round: 'super_bowl',
  home_score: 31,
  away_score: 28,
  status: 'final',
}
