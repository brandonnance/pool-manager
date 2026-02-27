import { describe, it, expect } from 'vitest'
import {
  getRoundConfig,
  getRoundLabel,
  formatRoundWins,
} from '../round-config'

describe('getRoundConfig', () => {
  describe('NFL Playoffs (default)', () => {
    it('should return NFL config for nfl_playoffs', () => {
      const config = getRoundConfig('nfl_playoffs')
      expect(config.roundOrder).toEqual([
        'wild_card',
        'divisional',
        'conference',
        'super_bowl',
      ])
    })

    it('should return NFL config for unknown event type', () => {
      const config = getRoundConfig('unknown_type')
      expect(config.roundOrder).toEqual([
        'wild_card',
        'divisional',
        'conference',
        'super_bowl',
      ])
    })

    it('should have labels for all NFL rounds', () => {
      const config = getRoundConfig('nfl_playoffs')
      expect(config.roundLabels).toEqual({
        wild_card: 'Wild Card',
        divisional: 'Divisional',
        conference: 'Conference',
        super_bowl: 'Super Bowl',
      })
    })

    it('should have abbreviations including super_bowl_halftime', () => {
      const config = getRoundConfig('nfl_playoffs')
      expect(config.roundAbbrevs.super_bowl_halftime).toBe('SBH')
      expect(config.roundAbbrevs.super_bowl).toBe('SB')
      expect(config.roundAbbrevs.wild_card).toBe('WC')
    })

    it('should have hierarchy with super_bowl_halftime', () => {
      const config = getRoundConfig('nfl_playoffs')
      expect(config.roundHierarchy.wild_card).toBe(1)
      expect(config.roundHierarchy.super_bowl_halftime).toBe(4)
      expect(config.roundHierarchy.super_bowl).toBe(5)
    })
  })

  describe('March Madness', () => {
    it('should return MM config for march_madness', () => {
      const config = getRoundConfig('march_madness')
      expect(config.roundOrder).toEqual([
        'mm_r64',
        'mm_r32',
        'mm_s16',
        'mm_e8',
        'mm_f4',
        'mm_final',
      ])
    })

    it('should have labels for all MM rounds', () => {
      const config = getRoundConfig('march_madness')
      expect(config.roundLabels).toEqual({
        mm_r64: 'Round of 64',
        mm_r32: 'Round of 32',
        mm_s16: 'Sweet 16',
        mm_e8: 'Elite 8',
        mm_f4: 'Final Four',
        mm_final: 'Championship',
      })
    })

    it('should have abbreviations for all MM rounds', () => {
      const config = getRoundConfig('march_madness')
      expect(config.roundAbbrevs).toEqual({
        mm_r64: 'R64',
        mm_r32: 'R32',
        mm_s16: 'S16',
        mm_e8: 'E8',
        mm_f4: 'F4',
        mm_final: 'F',
      })
    })

    it('should have ascending hierarchy from R64 to Final', () => {
      const config = getRoundConfig('march_madness')
      expect(config.roundHierarchy.mm_r64).toBe(1)
      expect(config.roundHierarchy.mm_r32).toBe(2)
      expect(config.roundHierarchy.mm_s16).toBe(3)
      expect(config.roundHierarchy.mm_e8).toBe(4)
      expect(config.roundHierarchy.mm_f4).toBe(5)
      expect(config.roundHierarchy.mm_final).toBe(6)
    })
  })
})

describe('getRoundLabel', () => {
  it('should return NFL round label', () => {
    expect(getRoundLabel('nfl_playoffs', 'wild_card')).toBe('Wild Card')
    expect(getRoundLabel('nfl_playoffs', 'super_bowl')).toBe('Super Bowl')
  })

  it('should return MM round label', () => {
    expect(getRoundLabel('march_madness', 'mm_s16')).toBe('Sweet 16')
    expect(getRoundLabel('march_madness', 'mm_final')).toBe('Championship')
  })

  it('should fall back to raw round key for unknown rounds', () => {
    expect(getRoundLabel('nfl_playoffs', 'unknown_round')).toBe('unknown_round')
  })

  it('should fall back for MM round used with NFL config', () => {
    expect(getRoundLabel('nfl_playoffs', 'mm_r64')).toBe('mm_r64')
  })
})

describe('formatRoundWins', () => {
  describe('NFL Playoffs', () => {
    it('should format NFL round wins in order', () => {
      const result = formatRoundWins('nfl_playoffs', {
        wild_card: 2,
        divisional: 1,
        super_bowl: 1,
      })
      expect(result).toBe('2WC, 1D, 1SB')
    })

    it('should include super_bowl_halftime in correct position', () => {
      const result = formatRoundWins('nfl_playoffs', {
        conference: 1,
        super_bowl_halftime: 1,
        super_bowl: 1,
      })
      expect(result).toBe('1C, 1SBH, 1SB')
    })

    it('should skip rounds with zero wins', () => {
      const result = formatRoundWins('nfl_playoffs', {
        wild_card: 0,
        divisional: 1,
      })
      expect(result).toBe('1D')
    })

    it('should return empty string for no wins', () => {
      expect(formatRoundWins('nfl_playoffs', {})).toBe('')
    })
  })

  describe('March Madness', () => {
    it('should format MM round wins in order', () => {
      const result = formatRoundWins('march_madness', {
        mm_r64: 3,
        mm_s16: 1,
        mm_final: 1,
      })
      expect(result).toBe('3R64, 1S16, 1F')
    })

    it('should handle all MM rounds', () => {
      const result = formatRoundWins('march_madness', {
        mm_r64: 1,
        mm_r32: 1,
        mm_s16: 1,
        mm_e8: 1,
        mm_f4: 1,
        mm_final: 1,
      })
      expect(result).toBe('1R64, 1R32, 1S16, 1E8, 1F4, 1F')
    })

    it('should skip rounds with zero wins', () => {
      const result = formatRoundWins('march_madness', {
        mm_r64: 0,
        mm_r32: 2,
      })
      expect(result).toBe('2R32')
    })
  })

  describe('edge cases', () => {
    it('should return empty string for empty input', () => {
      expect(formatRoundWins('march_madness', {})).toBe('')
      expect(formatRoundWins('nfl_playoffs', {})).toBe('')
    })

    it('should ignore unknown round keys', () => {
      const result = formatRoundWins('nfl_playoffs', {
        wild_card: 1,
        fake_round: 5,
      })
      expect(result).toBe('1WC')
    })
  })
})
