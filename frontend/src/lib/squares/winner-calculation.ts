/**
 * Winner calculation utilities for squares pools
 * Handles determining winning squares from scores
 */

import type { WinningRound, Square, Winner, Game } from './types'

/**
 * Round hierarchy for determining display priority.
 * Higher number = higher tier (takes precedence in display).
 * Canonical source — round-config.ts and the public view derive from this.
 */
export const ROUND_HIERARCHY: Record<string, number> = {
  // Playoff rounds
  wild_card: 1,
  divisional: 2,
  conference: 3,
  super_bowl_halftime: 4,
  super_bowl: 5,
  // March Madness rounds
  mm_r64: 1,
  mm_r32: 2,
  mm_s16: 3,
  mm_e8: 4,
  mm_f4: 5,
  mm_final: 6,
  // Single game
  single_game: 1,
  // Score change mode
  score_change_forward: 1,
  score_change_reverse: 1,
  score_change_both: 2,
  score_change_final: 3,
  score_change_final_reverse: 3,
  score_change_final_both: 4,
  // Hybrid mode quarters
  hybrid_q1: 5,
  hybrid_q1_reverse: 5,
  hybrid_q1_both: 6,
  hybrid_halftime: 7,
  hybrid_halftime_reverse: 7,
  hybrid_halftime_both: 8,
  hybrid_q3: 9,
  hybrid_q3_reverse: 9,
  hybrid_q3_both: 10,
  hybrid_final: 11,
  hybrid_final_reverse: 11,
  hybrid_final_both: 12,
}

/**
 * Calculate the winning square position based on scores.
 *
 * Uses "last digit" matching:
 * - Forward: row = home_score % 10, col = away_score % 10
 * - Reverse: row = away_score % 10, col = home_score % 10
 *
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @param rowNumbers - Array mapping row index to digit (0-9 shuffled)
 * @param colNumbers - Array mapping column index to digit (0-9 shuffled)
 * @param isReverse - Whether to use reverse scoring
 * @returns Object with rowIndex and colIndex of winning square
 */
export function calculateWinningSquarePosition(
  homeScore: number,
  awayScore: number,
  rowNumbers: number[],
  colNumbers: number[],
  isReverse: boolean = false
): { rowIndex: number; colIndex: number } {
  const homeDigit = homeScore % 10
  const awayDigit = awayScore % 10

  if (isReverse) {
    // Reverse: row = away digit, col = home digit
    return {
      rowIndex: rowNumbers.findIndex((n) => n === awayDigit),
      colIndex: colNumbers.findIndex((n) => n === homeDigit),
    }
  }

  // Forward: row = home digit, col = away digit
  return {
    rowIndex: rowNumbers.findIndex((n) => n === homeDigit),
    colIndex: colNumbers.findIndex((n) => n === awayDigit),
  }
}

/**
 * Find the winning square from a list of squares based on scores.
 *
 * @param squares - Array of all squares
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @param rowNumbers - Array mapping row index to digit (0-9 shuffled)
 * @param colNumbers - Array mapping column index to digit (0-9 shuffled)
 * @param isReverse - Whether to use reverse scoring
 * @returns The winning square, or undefined if not found
 */
export function findWinningSquare(
  squares: Square[],
  homeScore: number,
  awayScore: number,
  rowNumbers: number[],
  colNumbers: number[],
  isReverse: boolean = false
): Square | undefined {
  const { rowIndex, colIndex } = calculateWinningSquarePosition(
    homeScore,
    awayScore,
    rowNumbers,
    colNumbers,
    isReverse
  )
  return squares.find(
    (sq) => sq.row_index === rowIndex && sq.col_index === colIndex
  )
}

/**
 * Find both forward and reverse winning squares.
 *
 * @param squares - Array of all squares
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @param rowNumbers - Array mapping row index to digit
 * @param colNumbers - Array mapping column index to digit
 * @returns Object with forward and reverse winning squares
 */
export function findWinningSquares(
  squares: Square[],
  homeScore: number,
  awayScore: number,
  rowNumbers: number[],
  colNumbers: number[]
): { forward: Square | undefined; reverse: Square | undefined } {
  return {
    forward: findWinningSquare(
      squares,
      homeScore,
      awayScore,
      rowNumbers,
      colNumbers,
      false
    ),
    reverse: findWinningSquare(
      squares,
      homeScore,
      awayScore,
      rowNumbers,
      colNumbers,
      true
    ),
  }
}

/**
 * Build a map of square IDs to their winning round for display highlighting.
 * Handles score_change mode with forward/reverse/both tracking.
 *
 * @param winners - Array of winner records
 * @returns Map of square ID to winning round
 */
export function buildScoreChangeWinningRoundsMap(
  winners: Winner[]
): Map<string, WinningRound> {
  const winningSquareRounds = new Map<string, WinningRound>()

  // Track which squares have forward and/or reverse wins (regular score changes)
  const forwardWins = new Set<string>()
  const reverseWins = new Set<string>()
  // Track final score winners separately
  const finalForwardWins = new Set<string>()
  const finalReverseWins = new Set<string>()

  winners.forEach((w) => {
    if (w.square_id) {
      if (w.win_type === 'score_change') {
        forwardWins.add(w.square_id)
      } else if (w.win_type === 'score_change_reverse') {
        reverseWins.add(w.square_id)
      } else if (w.win_type === 'score_change_final') {
        finalForwardWins.add(w.square_id)
      } else if (w.win_type === 'score_change_final_reverse') {
        finalReverseWins.add(w.square_id)
      }
    }
  })

  // First, handle final score winners (purple) - these take precedence
  const allFinalSquares = new Set([...finalForwardWins, ...finalReverseWins])
  allFinalSquares.forEach((squareId) => {
    const hasFinalForward = finalForwardWins.has(squareId)
    const hasFinalReverse = finalReverseWins.has(squareId)

    if (hasFinalForward && hasFinalReverse) {
      winningSquareRounds.set(squareId, 'score_change_final_both')
    } else if (hasFinalForward) {
      winningSquareRounds.set(squareId, 'score_change_final')
    } else if (hasFinalReverse) {
      winningSquareRounds.set(squareId, 'score_change_final_reverse')
    }
  })

  // Then handle regular score change winners (only if not already a final winner)
  const allWinningSquares = new Set([...forwardWins, ...reverseWins])
  allWinningSquares.forEach((squareId) => {
    // Skip if already marked as final winner
    if (winningSquareRounds.has(squareId)) return

    const hasForward = forwardWins.has(squareId)
    const hasReverse = reverseWins.has(squareId)

    if (hasForward && hasReverse) {
      winningSquareRounds.set(squareId, 'score_change_both')
    } else if (hasForward) {
      winningSquareRounds.set(squareId, 'score_change_forward')
    } else if (hasReverse) {
      winningSquareRounds.set(squareId, 'score_change_reverse')
    }
  })

  return winningSquareRounds
}

/**
 * Build a map of square IDs to their winning round for playoff mode.
 * Uses round hierarchy to determine which round takes display precedence.
 *
 * @param winners - Array of winner records
 * @param games - Array of games (to look up round)
 * @returns Map of square ID to winning round
 */
export function buildPlayoffWinningRoundsMap(
  winners: Winner[],
  games: Game[]
): Map<string, WinningRound> {
  const winningSquareRounds = new Map<string, WinningRound>()
  const gameById = new Map(games.map((g) => [g.id, g]))

  for (const winner of winners) {
    if (!winner.square_id) continue

    const game = gameById.get(winner.sq_game_id)
    if (!game) continue

    // Determine the round for this winner
    const isHalftime =
      winner.win_type === 'halftime' || winner.win_type === 'halftime_reverse'
    const round: WinningRound =
      game.round === 'super_bowl' && isHalftime
        ? 'super_bowl_halftime'
        : (game.round as WinningRound)

    // Update map using hierarchy (higher rank wins)
    updateWinningRoundWithHierarchy(winningSquareRounds, winner.square_id, round)
  }

  return winningSquareRounds
}

/**
 * Build a map of square IDs to their winning round for quarter mode (single game).
 * All winners get the same 'single_game' round.
 *
 * @param winners - Array of winner records
 * @returns Map of square ID to winning round
 */
export function buildQuarterModeWinningRoundsMap(
  winners: Winner[]
): Map<string, WinningRound> {
  const winningSquareRounds = new Map<string, WinningRound>()

  winners.forEach((w) => {
    if (w.square_id) {
      winningSquareRounds.set(w.square_id, 'single_game')
    }
  })

  return winningSquareRounds
}

/**
 * Build a map of square IDs to their winning round across all pool modes
 * (playoff, single game quarter/score_change, hybrid, march madness).
 * Used by the public view where the pool mode isn't known up front.
 *
 * @param winners - Array of winner records
 * @param games - Array of games (to look up round for normal/reverse wins)
 * @returns Map of square ID to winning round
 */
export function buildWinningRoundsMap(
  winners: Winner[],
  games: Game[]
): Map<string, WinningRound> {
  const winningSquareRounds = new Map<string, WinningRound>()
  const gameById = new Map(games.map((g) => [g.id, g]))

  for (const winner of winners) {
    if (!winner.square_id) continue

    // Determine winning round based on win_type
    let round: WinningRound = null
    if (winner.win_type === 'normal' || winner.win_type === 'reverse') {
      const game = gameById.get(winner.sq_game_id)
      if (game) {
        round = game.round as WinningRound
      }
    } else if (winner.win_type.startsWith('score_change')) {
      // Score change mode winning types
      if (winner.win_type === 'score_change_final_both') {
        round = 'score_change_final_both'
      } else if (winner.win_type === 'score_change_final_reverse') {
        round = 'score_change_final_reverse'
      } else if (winner.win_type === 'score_change_final') {
        round = 'score_change_final'
      } else if (winner.win_type === 'score_change_reverse') {
        // Check if also forward winner for "both"
        const alsoForward = winners.some(
          (w) => w.square_id === winner.square_id && w.win_type === 'score_change'
        )
        round = alsoForward ? 'score_change_both' : 'score_change_reverse'
      } else if (winner.win_type === 'score_change') {
        const alsoReverse = winners.some(
          (w) => w.square_id === winner.square_id && w.win_type === 'score_change_reverse'
        )
        round = alsoReverse ? 'score_change_both' : 'score_change_forward'
      }
    }
    // Quarter mode - q1, halftime, q3 (forward)
    // Note: Quarter mode final scores use score_change_final types (handled above) due to DB constraint
    else if (winner.win_type === 'q1' || winner.win_type === 'halftime' || winner.win_type === 'q3') {
      const reverseType = `${winner.win_type}_reverse`
      const alsoReverse = winners.some(
        (w) => w.square_id === winner.square_id && w.win_type === reverseType
      )
      round = alsoReverse ? 'score_change_both' : 'score_change_forward'
    }
    // Quarter mode - q1_reverse, halftime_reverse, q3_reverse
    else if (winner.win_type === 'q1_reverse' || winner.win_type === 'halftime_reverse' || winner.win_type === 'q3_reverse') {
      const forwardType = winner.win_type.replace('_reverse', '')
      const alsoForward = winners.some(
        (w) => w.square_id === winner.square_id && w.win_type === forwardType
      )
      round = alsoForward ? 'score_change_both' : 'score_change_reverse'
    }
    // Hybrid mode - forward quarter winners
    else if (winner.win_type === 'hybrid_q1' || winner.win_type === 'hybrid_halftime' || winner.win_type === 'hybrid_q3' || winner.win_type === 'hybrid_final') {
      const reverseType = `${winner.win_type}_reverse`
      const alsoReverse = winners.some(
        (w) => w.square_id === winner.square_id && w.win_type === reverseType
      )
      round = alsoReverse ? `${winner.win_type}_both` as WinningRound : winner.win_type as WinningRound
    }
    // Hybrid mode - reverse quarter winners
    else if (winner.win_type === 'hybrid_q1_reverse' || winner.win_type === 'hybrid_halftime_reverse' || winner.win_type === 'hybrid_q3_reverse' || winner.win_type === 'hybrid_final_reverse') {
      const forwardType = winner.win_type.replace('_reverse', '')
      const alsoForward = winners.some(
        (w) => w.square_id === winner.square_id && w.win_type === forwardType
      )
      round = alsoForward ? `${forwardType}_both` as WinningRound : winner.win_type as WinningRound
    }

    updateWinningRoundWithHierarchy(winningSquareRounds, winner.square_id, round)
  }

  return winningSquareRounds
}

/**
 * Update winning round map respecting hierarchy.
 * Only updates if new round has higher rank.
 *
 * @param map - The map to update
 * @param squareId - The square ID
 * @param newRound - The new round to potentially set
 */
function updateWinningRoundWithHierarchy(
  map: Map<string, WinningRound>,
  squareId: string,
  newRound: WinningRound
): void {
  if (!newRound) return

  const existing = map.get(squareId)
  const existingRank = existing ? ROUND_HIERARCHY[existing] ?? 0 : 0
  const newRank = ROUND_HIERARCHY[newRound] ?? 0

  if (newRank > existingRank) {
    map.set(squareId, newRound)
  }
}
