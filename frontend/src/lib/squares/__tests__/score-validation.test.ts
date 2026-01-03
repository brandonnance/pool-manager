import { describe, it, expect } from 'vitest'
import {
  validateScoreChange,
  validateFirstScoreChange,
  getLastScore,
  sortScoreChanges,
} from '../score-validation'
import type { ScoreChange } from '../types'

describe('validateScoreChange', () => {
  describe('score decrease rule', () => {
    it('should reject home score decrease', () => {
      const result = validateScoreChange(10, 7, 14, 7, 'Chiefs', 'Eagles')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Chiefs score cannot be less than 14')
    })

    it('should reject away score decrease', () => {
      const result = validateScoreChange(14, 3, 14, 7, 'Chiefs', 'Eagles')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Eagles score cannot be less than 7')
    })

    it('should allow scores to stay the same (checked by other rule)', () => {
      // Equal is handled by "at least one must change" rule
      const result = validateScoreChange(14, 7, 14, 7, 'Chiefs', 'Eagles')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Score must change from the previous entry')
    })
  })

  describe('one team at a time rule', () => {
    it('should reject both teams scoring at once', () => {
      const result = validateScoreChange(21, 14, 14, 7, 'Chiefs', 'Eagles')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Only one team can score at a time')
    })

    it('should allow only home team scoring', () => {
      const result = validateScoreChange(21, 7, 14, 7, 'Chiefs', 'Eagles')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeNull()
    })

    it('should allow only away team scoring', () => {
      const result = validateScoreChange(14, 10, 14, 7, 'Chiefs', 'Eagles')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeNull()
    })
  })

  describe('at least one change rule', () => {
    it('should reject no change', () => {
      const result = validateScoreChange(14, 7, 14, 7, 'Chiefs', 'Eagles')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Score must change from the previous entry')
    })
  })

  describe('valid score changes', () => {
    it('should accept touchdown by home team', () => {
      const result = validateScoreChange(21, 7, 14, 7)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeNull()
    })

    it('should accept field goal by away team', () => {
      const result = validateScoreChange(14, 10, 14, 7)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeNull()
    })

    it('should accept safety (2 points)', () => {
      const result = validateScoreChange(16, 7, 14, 7)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeNull()
    })

    it('should accept single point increase', () => {
      const result = validateScoreChange(15, 7, 14, 7)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeNull()
    })

    it('should accept large score increase', () => {
      const result = validateScoreChange(42, 7, 14, 7)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeNull()
    })
  })

  describe('default team names', () => {
    it('should use default team names if not provided', () => {
      const result = validateScoreChange(10, 7, 14, 7)
      expect(result.error).toBe('Home score cannot be less than 14')
    })

    it('should use Away for away team by default', () => {
      const result = validateScoreChange(14, 3, 14, 7)
      expect(result.error).toBe('Away score cannot be less than 7')
    })
  })

  describe('edge cases', () => {
    it('should handle 0-0 to first score', () => {
      const result = validateScoreChange(7, 0, 0, 0)
      expect(result.isValid).toBe(true)
    })

    it('should handle high scores', () => {
      const result = validateScoreChange(77, 42, 70, 42)
      expect(result.isValid).toBe(true)
    })
  })
})

describe('validateFirstScoreChange', () => {
  it('should accept 0-0 as first score', () => {
    const result = validateFirstScoreChange(0, 0)
    expect(result.isValid).toBe(true)
    expect(result.error).toBeNull()
  })

  it('should reject non-zero home score', () => {
    const result = validateFirstScoreChange(7, 0)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('First score must be 0-0')
  })

  it('should reject non-zero away score', () => {
    const result = validateFirstScoreChange(0, 7)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('First score must be 0-0')
  })

  it('should reject both non-zero scores', () => {
    const result = validateFirstScoreChange(7, 3)
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('First score must be 0-0')
  })
})

describe('getLastScore', () => {
  it('should return 0-0 for empty score changes', () => {
    const result = getLastScore([])
    expect(result).toEqual({ homeScore: 0, awayScore: 0 })
  })

  it('should return last score by change_order', () => {
    const scoreChanges: ScoreChange[] = [
      { home_score: 0, away_score: 0, change_order: 1 },
      { home_score: 7, away_score: 0, change_order: 2 },
      { home_score: 7, away_score: 3, change_order: 3 },
    ]
    const result = getLastScore(scoreChanges)
    expect(result).toEqual({ homeScore: 7, awayScore: 3 })
  })

  it('should handle unsorted input', () => {
    const scoreChanges: ScoreChange[] = [
      { home_score: 7, away_score: 3, change_order: 3 },
      { home_score: 0, away_score: 0, change_order: 1 },
      { home_score: 7, away_score: 0, change_order: 2 },
    ]
    const result = getLastScore(scoreChanges)
    expect(result).toEqual({ homeScore: 7, awayScore: 3 })
  })

  it('should handle single score change', () => {
    const scoreChanges: ScoreChange[] = [
      { home_score: 0, away_score: 0, change_order: 1 },
    ]
    const result = getLastScore(scoreChanges)
    expect(result).toEqual({ homeScore: 0, awayScore: 0 })
  })

  it('should not mutate input array', () => {
    const scoreChanges: ScoreChange[] = [
      { home_score: 7, away_score: 3, change_order: 3 },
      { home_score: 0, away_score: 0, change_order: 1 },
    ]
    const original = [...scoreChanges]
    getLastScore(scoreChanges)
    expect(scoreChanges).toEqual(original)
  })
})

describe('sortScoreChanges', () => {
  it('should sort by change_order ascending', () => {
    const scoreChanges: ScoreChange[] = [
      { home_score: 14, away_score: 7, change_order: 3 },
      { home_score: 0, away_score: 0, change_order: 1 },
      { home_score: 7, away_score: 0, change_order: 2 },
    ]
    const sorted = sortScoreChanges(scoreChanges)
    expect(sorted.map((sc) => sc.change_order)).toEqual([1, 2, 3])
  })

  it('should not mutate original array', () => {
    const scoreChanges: ScoreChange[] = [
      { home_score: 14, away_score: 7, change_order: 3 },
      { home_score: 0, away_score: 0, change_order: 1 },
    ]
    const originalOrder = scoreChanges[0].change_order
    sortScoreChanges(scoreChanges)
    expect(scoreChanges[0].change_order).toBe(originalOrder)
  })

  it('should handle empty array', () => {
    const sorted = sortScoreChanges([])
    expect(sorted).toEqual([])
  })

  it('should handle already sorted array', () => {
    const scoreChanges: ScoreChange[] = [
      { home_score: 0, away_score: 0, change_order: 1 },
      { home_score: 7, away_score: 0, change_order: 2 },
      { home_score: 14, away_score: 7, change_order: 3 },
    ]
    const sorted = sortScoreChanges(scoreChanges)
    expect(sorted.map((sc) => sc.change_order)).toEqual([1, 2, 3])
  })
})
