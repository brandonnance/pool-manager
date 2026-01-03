/**
 * Squares pool utilities
 *
 * This module exports pure functions for squares pool logic,
 * enabling easy unit testing without React component overhead.
 */

// Types
export type {
  WinningRound,
  Square,
  Winner,
  Game,
  ScoreChange,
  ScoreValidationResult,
  WinType,
  PoolMode,
  ScoringMode,
} from './types'

// Grid generation
export {
  shuffleArray,
  generateGridNumbers,
  isValidGridNumbers,
} from './grid-generation'

// Score validation
export {
  validateScoreChange,
  validateFirstScoreChange,
  getLastScore,
  sortScoreChanges,
} from './score-validation'

// Winner calculation
export {
  ROUND_HIERARCHY,
  calculateWinningSquarePosition,
  findWinningSquare,
  findWinningSquares,
  buildScoreChangeWinningRoundsMap,
  buildPlayoffWinningRoundsMap,
  buildQuarterModeWinningRoundsMap,
} from './winner-calculation'
