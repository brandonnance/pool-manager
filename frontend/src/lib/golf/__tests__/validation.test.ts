import { describe, it, expect } from 'vitest'
import {
  validateRoster,
  canAddGolfer,
  getTierPointsSummary,
} from '../validation'
import type { EntryPick } from '../types'

// Helper to create picks for testing
function createPick(id: string, name: string, tier: number): EntryPick {
  return { golferId: id, golferName: name, tier }
}

describe('validateRoster', () => {
  describe('pick count validation', () => {
    it('should be invalid when no picks are selected', () => {
      const result = validateRoster([])
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Need 6 more golfers')
      expect(result.picksCount).toBe(0)
    })

    it('should be invalid with fewer than 6 picks', () => {
      const picks = [
        createPick('1', 'Golfer A', 1),
        createPick('2', 'Golfer B', 2),
        createPick('3', 'Golfer C', 3),
      ]
      const result = validateRoster(picks)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Need 3 more golfers')
      expect(result.picksCount).toBe(3)
    })

    it('should be invalid with more than 6 picks', () => {
      const picks = [
        createPick('1', 'Golfer A', 1),
        createPick('2', 'Golfer B', 2),
        createPick('3', 'Golfer C', 3),
        createPick('4', 'Golfer D', 4),
        createPick('5', 'Golfer E', 5),
        createPick('6', 'Golfer F', 6),
        createPick('7', 'Golfer G', 5),
      ]
      const result = validateRoster(picks)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Too many golfers selected (7/6)')
    })

    it('should use singular form when needing 1 more golfer', () => {
      const picks = [
        createPick('1', 'Golfer A', 3),
        createPick('2', 'Golfer B', 4),
        createPick('3', 'Golfer C', 4),
        createPick('4', 'Golfer D', 5),
        createPick('5', 'Golfer E', 5),
      ]
      const result = validateRoster(picks)
      expect(result.errors).toContain('Need 1 more golfer')
    })
  })

  describe('duplicate validation', () => {
    it('should detect duplicate golfers', () => {
      const picks = [
        createPick('1', 'Golfer A', 1),
        createPick('1', 'Golfer A', 1), // duplicate
        createPick('2', 'Golfer B', 2),
        createPick('3', 'Golfer C', 3),
        createPick('4', 'Golfer D', 4),
        createPick('5', 'Golfer E', 5),
      ]
      const result = validateRoster(picks)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate golfer: Golfer A')
    })

    it('should detect multiple duplicate golfers', () => {
      const picks = [
        createPick('1', 'Golfer A', 1),
        createPick('1', 'Golfer A', 1),
        createPick('2', 'Golfer B', 2),
        createPick('2', 'Golfer B', 2),
        createPick('3', 'Golfer C', 3),
        createPick('4', 'Golfer D', 4),
      ]
      const result = validateRoster(picks)
      expect(result.errors).toContain('Duplicate golfer: Golfer A')
      expect(result.errors).toContain('Duplicate golfer: Golfer B')
    })
  })

  describe('tier points validation', () => {
    it('should be invalid when tier points are below minimum', () => {
      // 6 tier-1 golfers = 6 points (below default 21)
      const picks = [
        createPick('1', 'Golfer A', 1),
        createPick('2', 'Golfer B', 1),
        createPick('3', 'Golfer C', 1),
        createPick('4', 'Golfer D', 1),
        createPick('5', 'Golfer E', 1),
        createPick('6', 'Golfer F', 1),
      ]
      const result = validateRoster(picks)
      expect(result.valid).toBe(false)
      expect(result.totalTierPoints).toBe(6)
      expect(result.errors).toContain('Need 15 more tier points (6/21)')
    })

    it('should be valid when tier points meet minimum', () => {
      // 1+2+3+4+5+6 = 21 points (exactly minimum)
      const picks = [
        createPick('1', 'Golfer A', 1),
        createPick('2', 'Golfer B', 2),
        createPick('3', 'Golfer C', 3),
        createPick('4', 'Golfer D', 4),
        createPick('5', 'Golfer E', 5),
        createPick('6', 'Golfer F', 6),
      ]
      const result = validateRoster(picks)
      expect(result.valid).toBe(true)
      expect(result.totalTierPoints).toBe(21)
      expect(result.errors).toHaveLength(0)
    })

    it('should be valid when tier points exceed minimum', () => {
      // 6 tier-6 golfers = 36 points
      const picks = [
        createPick('1', 'Golfer A', 6),
        createPick('2', 'Golfer B', 6),
        createPick('3', 'Golfer C', 6),
        createPick('4', 'Golfer D', 6),
        createPick('5', 'Golfer E', 6),
        createPick('6', 'Golfer F', 6),
      ]
      const result = validateRoster(picks)
      expect(result.valid).toBe(true)
      expect(result.totalTierPoints).toBe(36)
    })

    it('should use custom minimum tier points', () => {
      const picks = [
        createPick('1', 'Golfer A', 1),
        createPick('2', 'Golfer B', 1),
        createPick('3', 'Golfer C', 1),
        createPick('4', 'Golfer D', 1),
        createPick('5', 'Golfer E', 1),
        createPick('6', 'Golfer F', 1),
      ]
      // With minimum of 6, this roster should be valid
      const result = validateRoster(picks, 6)
      expect(result.valid).toBe(true)
      expect(result.minTierPoints).toBe(6)
    })

    it('should use singular form when needing 1 more point', () => {
      // 2+3+4+5+5+1 = 20 points (need 1 more)
      const picks = [
        createPick('1', 'Golfer A', 2),
        createPick('2', 'Golfer B', 3),
        createPick('3', 'Golfer C', 4),
        createPick('4', 'Golfer D', 5),
        createPick('5', 'Golfer E', 5),
        createPick('6', 'Golfer F', 1),
      ]
      const result = validateRoster(picks)
      expect(result.errors).toContain('Need 1 more tier point (20/21)')
    })

    it('should handle elite tier (tier 0) correctly', () => {
      // 0+0+5+5+6+6 = 22 points (elite golfers cost 0 points)
      const picks = [
        createPick('1', 'Elite A', 0),
        createPick('2', 'Elite B', 0),
        createPick('3', 'Golfer C', 5),
        createPick('4', 'Golfer D', 5),
        createPick('5', 'Golfer E', 6),
        createPick('6', 'Golfer F', 6),
      ]
      const result = validateRoster(picks)
      expect(result.valid).toBe(true)
      expect(result.totalTierPoints).toBe(22)
    })
  })

  describe('warnings', () => {
    it('should warn when significantly over minimum tier points', () => {
      // 36 points is 15 over minimum 21 (> 3 over)
      const picks = [
        createPick('1', 'Golfer A', 6),
        createPick('2', 'Golfer B', 6),
        createPick('3', 'Golfer C', 6),
        createPick('4', 'Golfer D', 6),
        createPick('5', 'Golfer E', 6),
        createPick('6', 'Golfer F', 6),
      ]
      const result = validateRoster(picks)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain("You're at 36 points")
    })

    it('should not warn when close to minimum', () => {
      // 23 points is only 2 over minimum (not > 3)
      const picks = [
        createPick('1', 'Golfer A', 1),
        createPick('2', 'Golfer B', 2),
        createPick('3', 'Golfer C', 4),
        createPick('4', 'Golfer D', 4),
        createPick('5', 'Golfer E', 6),
        createPick('6', 'Golfer F', 6),
      ]
      const result = validateRoster(picks)
      expect(result.warnings).toHaveLength(0)
    })
  })
})

describe('canAddGolfer', () => {
  it('should allow adding golfer to empty roster', () => {
    const result = canAddGolfer([], 'golfer-1')
    expect(result.canAdd).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('should allow adding golfer to partial roster', () => {
    const picks = [
      createPick('1', 'Golfer A', 1),
      createPick('2', 'Golfer B', 2),
    ]
    const result = canAddGolfer(picks, 'golfer-3')
    expect(result.canAdd).toBe(true)
  })

  it('should not allow adding golfer when roster is full', () => {
    const picks = [
      createPick('1', 'Golfer A', 1),
      createPick('2', 'Golfer B', 2),
      createPick('3', 'Golfer C', 3),
      createPick('4', 'Golfer D', 4),
      createPick('5', 'Golfer E', 5),
      createPick('6', 'Golfer F', 6),
    ]
    const result = canAddGolfer(picks, 'golfer-7')
    expect(result.canAdd).toBe(false)
    expect(result.reason).toBe('Roster is full (6 golfers)')
  })

  it('should not allow adding duplicate golfer', () => {
    const picks = [
      createPick('1', 'Golfer A', 1),
      createPick('2', 'Golfer B', 2),
    ]
    const result = canAddGolfer(picks, '1')
    expect(result.canAdd).toBe(false)
    expect(result.reason).toBe('Golfer already selected')
  })

  it('should prioritize full roster over duplicate check', () => {
    const picks = [
      createPick('1', 'Golfer A', 1),
      createPick('2', 'Golfer B', 2),
      createPick('3', 'Golfer C', 3),
      createPick('4', 'Golfer D', 4),
      createPick('5', 'Golfer E', 5),
      createPick('6', 'Golfer F', 6),
    ]
    // Trying to add a golfer that's already in the full roster
    const result = canAddGolfer(picks, '1')
    expect(result.canAdd).toBe(false)
    expect(result.reason).toBe('Roster is full (6 golfers)')
  })
})

describe('getTierPointsSummary', () => {
  it('should return below status when under minimum', () => {
    const picks = [
      createPick('1', 'Golfer A', 1),
      createPick('2', 'Golfer B', 2),
      createPick('3', 'Golfer C', 3),
    ]
    const result = getTierPointsSummary(picks)
    expect(result.current).toBe(6)
    expect(result.minimum).toBe(21)
    expect(result.status).toBe('below')
    expect(result.message).toBe('Need 15 more points')
  })

  it('should return at status when exactly at minimum', () => {
    const picks = [
      createPick('1', 'Golfer A', 1),
      createPick('2', 'Golfer B', 2),
      createPick('3', 'Golfer C', 3),
      createPick('4', 'Golfer D', 4),
      createPick('5', 'Golfer E', 5),
      createPick('6', 'Golfer F', 6),
    ]
    const result = getTierPointsSummary(picks)
    expect(result.current).toBe(21)
    expect(result.status).toBe('at')
    expect(result.message).toBe('Minimum tier points met')
  })

  it('should return above status when over minimum', () => {
    const picks = [
      createPick('1', 'Golfer A', 4),
      createPick('2', 'Golfer B', 4),
      createPick('3', 'Golfer C', 4),
      createPick('4', 'Golfer D', 4),
      createPick('5', 'Golfer E', 4),
      createPick('6', 'Golfer F', 4),
    ]
    const result = getTierPointsSummary(picks)
    expect(result.current).toBe(24)
    expect(result.status).toBe('above')
    expect(result.message).toBe('3 points over minimum')
  })

  it('should use singular form when 1 point over minimum', () => {
    const picks = [
      createPick('1', 'Golfer A', 1),
      createPick('2', 'Golfer B', 2),
      createPick('3', 'Golfer C', 3),
      createPick('4', 'Golfer D', 5),
      createPick('5', 'Golfer E', 5),
      createPick('6', 'Golfer F', 6),
    ]
    const result = getTierPointsSummary(picks)
    expect(result.current).toBe(22)
    expect(result.message).toBe('1 point over minimum')
  })

  it('should use singular form when needing 1 more point', () => {
    const picks = [
      createPick('1', 'Golfer A', 2),
      createPick('2', 'Golfer B', 3),
      createPick('3', 'Golfer C', 4),
      createPick('4', 'Golfer D', 5),
      createPick('5', 'Golfer E', 5),
      createPick('6', 'Golfer F', 1),
    ]
    const result = getTierPointsSummary(picks)
    expect(result.current).toBe(20)
    expect(result.message).toBe('Need 1 more point')
  })

  it('should use custom minimum tier points', () => {
    const picks = [createPick('1', 'Golfer A', 3)]
    const result = getTierPointsSummary(picks, 10)
    expect(result.minimum).toBe(10)
    expect(result.current).toBe(3)
    expect(result.status).toBe('below')
    expect(result.message).toBe('Need 7 more points')
  })

  it('should handle empty picks', () => {
    const result = getTierPointsSummary([])
    expect(result.current).toBe(0)
    expect(result.status).toBe('below')
    expect(result.message).toBe('Need 21 more points')
  })

  it('should handle elite tier (0 points)', () => {
    const picks = [
      createPick('1', 'Elite A', 0),
      createPick('2', 'Elite B', 0),
    ]
    const result = getTierPointsSummary(picks)
    expect(result.current).toBe(0)
    expect(result.status).toBe('below')
  })
})
