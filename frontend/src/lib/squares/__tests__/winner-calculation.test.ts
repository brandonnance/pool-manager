import { describe, it, expect } from 'vitest'
import {
  calculateWinningSquarePosition,
  findWinningSquare,
  findWinningSquares,
  buildScoreChangeWinningRoundsMap,
  buildPlayoffWinningRoundsMap,
  buildQuarterModeWinningRoundsMap,
  ROUND_HIERARCHY,
} from '../winner-calculation'
import type { Square, Winner, Game } from '../types'

describe('calculateWinningSquarePosition', () => {
  // Standard 0-9 number assignments (sequential for easy testing)
  const rowNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const colNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  describe('forward scoring', () => {
    it('should return correct position for single-digit scores', () => {
      const result = calculateWinningSquarePosition(7, 3, rowNumbers, colNumbers, false)
      expect(result).toEqual({ rowIndex: 7, colIndex: 3 })
    })

    it('should use last digit for multi-digit scores', () => {
      const result = calculateWinningSquarePosition(21, 17, rowNumbers, colNumbers, false)
      expect(result).toEqual({ rowIndex: 1, colIndex: 7 })
    })

    it('should handle 0-0 score', () => {
      const result = calculateWinningSquarePosition(0, 0, rowNumbers, colNumbers, false)
      expect(result).toEqual({ rowIndex: 0, colIndex: 0 })
    })

    it('should handle scores ending in 0', () => {
      const result = calculateWinningSquarePosition(10, 20, rowNumbers, colNumbers, false)
      expect(result).toEqual({ rowIndex: 0, colIndex: 0 })
    })

    it('should handle typical NFL scores', () => {
      // 24-17: last digits 4 and 7
      const result = calculateWinningSquarePosition(24, 17, rowNumbers, colNumbers, false)
      expect(result).toEqual({ rowIndex: 4, colIndex: 7 })
    })

    it('should handle shuffled number assignments', () => {
      const shuffledRows = [5, 2, 8, 1, 9, 0, 4, 7, 3, 6]
      const shuffledCols = [3, 7, 0, 9, 1, 6, 2, 5, 8, 4]
      // Score: 17-14 -> last digits 7 and 4
      // row 7 is at index 7, col 4 is at index 9
      const result = calculateWinningSquarePosition(17, 14, shuffledRows, shuffledCols, false)
      expect(result.rowIndex).toBe(shuffledRows.indexOf(7))
      expect(result.colIndex).toBe(shuffledCols.indexOf(4))
    })
  })

  describe('reverse scoring', () => {
    it('should swap home/away for reverse scoring', () => {
      // Forward: row=home(7), col=away(3) -> row=7, col=3
      // Reverse: row=away(3), col=home(7) -> row=3, col=7
      const result = calculateWinningSquarePosition(7, 3, rowNumbers, colNumbers, true)
      expect(result).toEqual({ rowIndex: 3, colIndex: 7 })
    })

    it('should return same position for symmetric scores', () => {
      const forward = calculateWinningSquarePosition(5, 5, rowNumbers, colNumbers, false)
      const reverse = calculateWinningSquarePosition(5, 5, rowNumbers, colNumbers, true)
      expect(forward).toEqual(reverse)
    })

    it('should return same position for 0-0', () => {
      const forward = calculateWinningSquarePosition(0, 0, rowNumbers, colNumbers, false)
      const reverse = calculateWinningSquarePosition(0, 0, rowNumbers, colNumbers, true)
      expect(forward).toEqual(reverse)
    })

    it('should handle multi-digit reverse scores', () => {
      // Score 28-31: last digits 8 and 1
      // Forward: row=8, col=1
      // Reverse: row=1, col=8
      const forward = calculateWinningSquarePosition(28, 31, rowNumbers, colNumbers, false)
      const reverse = calculateWinningSquarePosition(28, 31, rowNumbers, colNumbers, true)
      expect(forward).toEqual({ rowIndex: 8, colIndex: 1 })
      expect(reverse).toEqual({ rowIndex: 1, colIndex: 8 })
    })
  })
})

describe('findWinningSquare', () => {
  const squares: Square[] = [
    { id: 'sq-0-0', row_index: 0, col_index: 0, user_id: 'user-1' },
    { id: 'sq-7-3', row_index: 7, col_index: 3, user_id: 'user-2' },
    { id: 'sq-3-7', row_index: 3, col_index: 7, user_id: 'user-3' },
    { id: 'sq-5-5', row_index: 5, col_index: 5, user_id: 'user-4' },
  ]
  const rowNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const colNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  it('should find the correct winning square', () => {
    const winner = findWinningSquare(squares, 7, 3, rowNumbers, colNumbers, false)
    expect(winner?.id).toBe('sq-7-3')
    expect(winner?.user_id).toBe('user-2')
  })

  it('should return undefined if no square at position', () => {
    const winner = findWinningSquare(squares, 9, 9, rowNumbers, colNumbers, false)
    expect(winner).toBeUndefined()
  })

  it('should find different squares for forward vs reverse', () => {
    const forward = findWinningSquare(squares, 7, 3, rowNumbers, colNumbers, false)
    const reverse = findWinningSquare(squares, 7, 3, rowNumbers, colNumbers, true)
    expect(forward?.id).toBe('sq-7-3')
    expect(reverse?.id).toBe('sq-3-7')
  })

  it('should find same square for symmetric scores', () => {
    const forward = findWinningSquare(squares, 5, 5, rowNumbers, colNumbers, false)
    const reverse = findWinningSquare(squares, 5, 5, rowNumbers, colNumbers, true)
    expect(forward?.id).toBe('sq-5-5')
    expect(reverse?.id).toBe('sq-5-5')
  })

  it('should find square at 0-0', () => {
    const winner = findWinningSquare(squares, 0, 0, rowNumbers, colNumbers, false)
    expect(winner?.id).toBe('sq-0-0')
  })
})

describe('findWinningSquares', () => {
  const squares: Square[] = [
    { id: 'sq-7-3', row_index: 7, col_index: 3, user_id: 'user-1' },
    { id: 'sq-3-7', row_index: 3, col_index: 7, user_id: 'user-2' },
  ]
  const rowNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const colNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

  it('should return both forward and reverse winners', () => {
    const result = findWinningSquares(squares, 7, 3, rowNumbers, colNumbers)
    expect(result.forward?.id).toBe('sq-7-3')
    expect(result.reverse?.id).toBe('sq-3-7')
  })

  it('should return undefined for missing squares', () => {
    const result = findWinningSquares(squares, 0, 0, rowNumbers, colNumbers)
    expect(result.forward).toBeUndefined()
    expect(result.reverse).toBeUndefined()
  })
})

describe('buildScoreChangeWinningRoundsMap', () => {
  it('should identify score_change_forward winners', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change', payout: 1, winner_name: 'User 1' },
    ]
    const result = buildScoreChangeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('score_change_forward')
  })

  it('should identify score_change_reverse winners', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change_reverse', payout: 1, winner_name: 'User 1' },
    ]
    const result = buildScoreChangeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('score_change_reverse')
  })

  it('should identify score_change_both when square has forward and reverse', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change', payout: 1, winner_name: 'User 1' },
      { id: 'w2', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change_reverse', payout: 1, winner_name: 'User 1' },
    ]
    const result = buildScoreChangeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('score_change_both')
  })

  it('should identify final forward winners', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change_final', payout: null, winner_name: 'User 1' },
    ]
    const result = buildScoreChangeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('score_change_final')
  })

  it('should identify final reverse winners', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change_final_reverse', payout: null, winner_name: 'User 1' },
    ]
    const result = buildScoreChangeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('score_change_final_reverse')
  })

  it('should identify score_change_final_both when square has both final wins', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change_final', payout: null, winner_name: 'User 1' },
      { id: 'w2', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change_final_reverse', payout: null, winner_name: 'User 1' },
    ]
    const result = buildScoreChangeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('score_change_final_both')
  })

  it('should prioritize final winners over regular score_change', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change', payout: 1, winner_name: 'User 1' },
      { id: 'w2', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change_final', payout: null, winner_name: 'User 1' },
    ]
    const result = buildScoreChangeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('score_change_final')
  })

  it('should handle multiple squares with different win types', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'score_change', payout: 1, winner_name: 'User 1' },
      { id: 'w2', sq_game_id: 'g1', square_id: 'sq-2', win_type: 'score_change_reverse', payout: 1, winner_name: 'User 2' },
      { id: 'w3', sq_game_id: 'g1', square_id: 'sq-3', win_type: 'score_change_final', payout: null, winner_name: 'User 3' },
    ]
    const result = buildScoreChangeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('score_change_forward')
    expect(result.get('sq-2')).toBe('score_change_reverse')
    expect(result.get('sq-3')).toBe('score_change_final')
  })

  it('should skip winners with null square_id', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: null, win_type: 'score_change', payout: 1, winner_name: 'Unclaimed' },
    ]
    const result = buildScoreChangeWinningRoundsMap(winners)
    expect(result.size).toBe(0)
  })
})

describe('buildPlayoffWinningRoundsMap', () => {
  const games: Game[] = [
    { id: 'wc1', round: 'wild_card', home_score: 24, away_score: 17, status: 'final' },
    { id: 'div1', round: 'divisional', home_score: 28, away_score: 21, status: 'final' },
    { id: 'conf1', round: 'conference', home_score: 31, away_score: 24, status: 'final' },
    { id: 'sb', round: 'super_bowl', home_score: 28, away_score: 24, status: 'final' },
  ]

  it('should map winners to their game rounds', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'wc1', square_id: 'sq-1', win_type: 'normal', payout: null, winner_name: 'User 1' },
    ]
    const result = buildPlayoffWinningRoundsMap(winners, games)
    expect(result.get('sq-1')).toBe('wild_card')
  })

  it('should identify super bowl halftime as special round', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'sb', square_id: 'sq-1', win_type: 'halftime', payout: null, winner_name: 'User 1' },
    ]
    const result = buildPlayoffWinningRoundsMap(winners, games)
    expect(result.get('sq-1')).toBe('super_bowl_halftime')
  })

  it('should identify super bowl halftime_reverse as special round', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'sb', square_id: 'sq-1', win_type: 'halftime_reverse', payout: null, winner_name: 'User 1' },
    ]
    const result = buildPlayoffWinningRoundsMap(winners, games)
    expect(result.get('sq-1')).toBe('super_bowl_halftime')
  })

  it('should use hierarchy when same square wins multiple rounds', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'wc1', square_id: 'sq-1', win_type: 'normal', payout: null, winner_name: 'User 1' },
      { id: 'w2', sq_game_id: 'sb', square_id: 'sq-1', win_type: 'normal', payout: null, winner_name: 'User 1' },
    ]
    const result = buildPlayoffWinningRoundsMap(winners, games)
    // Super bowl (5) > wild_card (1)
    expect(result.get('sq-1')).toBe('super_bowl')
  })

  it('should track multiple squares across different rounds', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'wc1', square_id: 'sq-1', win_type: 'normal', payout: null, winner_name: 'User 1' },
      { id: 'w2', sq_game_id: 'div1', square_id: 'sq-2', win_type: 'normal', payout: null, winner_name: 'User 2' },
      { id: 'w3', sq_game_id: 'conf1', square_id: 'sq-3', win_type: 'normal', payout: null, winner_name: 'User 3' },
    ]
    const result = buildPlayoffWinningRoundsMap(winners, games)
    expect(result.get('sq-1')).toBe('wild_card')
    expect(result.get('sq-2')).toBe('divisional')
    expect(result.get('sq-3')).toBe('conference')
  })

  it('should skip winners with null square_id', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'wc1', square_id: null, win_type: 'normal', payout: null, winner_name: 'Unclaimed' },
    ]
    const result = buildPlayoffWinningRoundsMap(winners, games)
    expect(result.size).toBe(0)
  })

  it('should skip winners for unknown games', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'unknown', square_id: 'sq-1', win_type: 'normal', payout: null, winner_name: 'User 1' },
    ]
    const result = buildPlayoffWinningRoundsMap(winners, games)
    expect(result.size).toBe(0)
  })
})

describe('buildQuarterModeWinningRoundsMap', () => {
  it('should mark all winners as single_game', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'q1', payout: null, winner_name: 'User 1' },
      { id: 'w2', sq_game_id: 'g1', square_id: 'sq-2', win_type: 'halftime', payout: null, winner_name: 'User 2' },
      { id: 'w3', sq_game_id: 'g1', square_id: 'sq-3', win_type: 'q3', payout: null, winner_name: 'User 3' },
      { id: 'w4', sq_game_id: 'g1', square_id: 'sq-4', win_type: 'normal', payout: null, winner_name: 'User 4' },
    ]
    const result = buildQuarterModeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('single_game')
    expect(result.get('sq-2')).toBe('single_game')
    expect(result.get('sq-3')).toBe('single_game')
    expect(result.get('sq-4')).toBe('single_game')
  })

  it('should skip winners with null square_id', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: null, win_type: 'q1', payout: null, winner_name: 'Unclaimed' },
    ]
    const result = buildQuarterModeWinningRoundsMap(winners)
    expect(result.size).toBe(0)
  })

  it('should handle same square winning multiple quarters', () => {
    const winners: Winner[] = [
      { id: 'w1', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'q1', payout: null, winner_name: 'User 1' },
      { id: 'w2', sq_game_id: 'g1', square_id: 'sq-1', win_type: 'halftime', payout: null, winner_name: 'User 1' },
    ]
    const result = buildQuarterModeWinningRoundsMap(winners)
    expect(result.get('sq-1')).toBe('single_game')
    expect(result.size).toBe(1)
  })
})

describe('ROUND_HIERARCHY', () => {
  it('should have super_bowl as highest playoff tier', () => {
    expect(ROUND_HIERARCHY.super_bowl).toBeGreaterThan(ROUND_HIERARCHY.conference)
    expect(ROUND_HIERARCHY.super_bowl).toBeGreaterThan(ROUND_HIERARCHY.divisional)
    expect(ROUND_HIERARCHY.super_bowl).toBeGreaterThan(ROUND_HIERARCHY.wild_card)
  })

  it('should have super_bowl_halftime between conference and super_bowl', () => {
    expect(ROUND_HIERARCHY.super_bowl_halftime).toBeGreaterThan(ROUND_HIERARCHY.conference)
    expect(ROUND_HIERARCHY.super_bowl_halftime).toBeLessThan(ROUND_HIERARCHY.super_bowl)
  })

  it('should have correct playoff round ordering', () => {
    expect(ROUND_HIERARCHY.wild_card).toBeLessThan(ROUND_HIERARCHY.divisional)
    expect(ROUND_HIERARCHY.divisional).toBeLessThan(ROUND_HIERARCHY.conference)
    expect(ROUND_HIERARCHY.conference).toBeLessThan(ROUND_HIERARCHY.super_bowl)
  })

  it('should have score_change_final_both as highest score_change tier', () => {
    expect(ROUND_HIERARCHY.score_change_final_both).toBeGreaterThan(ROUND_HIERARCHY.score_change_final)
    expect(ROUND_HIERARCHY.score_change_final_both).toBeGreaterThan(ROUND_HIERARCHY.score_change_final_reverse)
  })

  it('should have score_change_final higher than score_change_both', () => {
    expect(ROUND_HIERARCHY.score_change_final).toBeGreaterThan(ROUND_HIERARCHY.score_change_both)
  })

  it('should have score_change_both higher than individual score_change', () => {
    expect(ROUND_HIERARCHY.score_change_both).toBeGreaterThan(ROUND_HIERARCHY.score_change_forward)
    expect(ROUND_HIERARCHY.score_change_both).toBeGreaterThan(ROUND_HIERARCHY.score_change_reverse)
  })

  it('should have equal rank for forward and reverse score_change', () => {
    expect(ROUND_HIERARCHY.score_change_forward).toBe(ROUND_HIERARCHY.score_change_reverse)
  })

  it('should have equal rank for final and final_reverse', () => {
    expect(ROUND_HIERARCHY.score_change_final).toBe(ROUND_HIERARCHY.score_change_final_reverse)
  })
})
