import { describe, it, expect } from 'vitest'
import { getGamesTemplateForEventType } from '../site-settings'

describe('getGamesTemplateForEventType', () => {
  describe('NFL Playoffs', () => {
    it('should return 13 games for nfl_playoffs', () => {
      const games = getGamesTemplateForEventType('nfl_playoffs')
      expect(games).toHaveLength(13)
    })

    it('should have correct round distribution', () => {
      const games = getGamesTemplateForEventType('nfl_playoffs')
      const byRound = Object.groupBy(games, (g) => g.round)
      expect(byRound.wild_card).toHaveLength(6)
      expect(byRound.divisional).toHaveLength(4)
      expect(byRound.conference).toHaveLength(2)
      expect(byRound.super_bowl).toHaveLength(1)
    })

    it('should have sequential display_order starting at 1', () => {
      const games = getGamesTemplateForEventType('nfl_playoffs')
      const orders = games.map((g) => g.display_order)
      expect(orders).toEqual(Array.from({ length: 13 }, (_, i) => i + 1))
    })

    it('should be the default for unknown event types', () => {
      const games = getGamesTemplateForEventType('unknown')
      expect(games).toHaveLength(13)
    })
  })

  describe('March Madness', () => {
    it('should return 63 games for march_madness', () => {
      const games = getGamesTemplateForEventType('march_madness')
      expect(games).toHaveLength(63)
    })

    it('should have correct round distribution (32+16+8+4+2+1)', () => {
      const games = getGamesTemplateForEventType('march_madness')
      const byRound = Object.groupBy(games, (g) => g.round)
      expect(byRound.mm_r64).toHaveLength(32)
      expect(byRound.mm_r32).toHaveLength(16)
      expect(byRound.mm_s16).toHaveLength(8)
      expect(byRound.mm_e8).toHaveLength(4)
      expect(byRound.mm_f4).toHaveLength(2)
      expect(byRound.mm_final).toHaveLength(1)
    })

    it('should have sequential display_order starting at 1', () => {
      const games = getGamesTemplateForEventType('march_madness')
      const orders = games.map((g) => g.display_order)
      expect(orders).toEqual(Array.from({ length: 63 }, (_, i) => i + 1))
    })

    it('should have games ordered by round progression', () => {
      const games = getGamesTemplateForEventType('march_madness')
      const roundOrder = ['mm_r64', 'mm_r32', 'mm_s16', 'mm_e8', 'mm_f4', 'mm_final']
      let lastRoundIndex = 0
      for (const game of games) {
        const idx = roundOrder.indexOf(game.round)
        expect(idx).toBeGreaterThanOrEqual(lastRoundIndex)
        lastRoundIndex = idx
      }
    })

    it('should have the Championship as the last game', () => {
      const games = getGamesTemplateForEventType('march_madness')
      const last = games[games.length - 1]
      expect(last.name).toBe('Championship')
      expect(last.round).toBe('mm_final')
    })

    it('should have unique display_orders', () => {
      const games = getGamesTemplateForEventType('march_madness')
      const orders = games.map((g) => g.display_order)
      const unique = new Set(orders)
      expect(unique.size).toBe(63)
    })
  })

  describe('all templates', () => {
    it('every game should have name, round, and display_order', () => {
      for (const eventType of ['nfl_playoffs', 'march_madness']) {
        const games = getGamesTemplateForEventType(eventType)
        for (const game of games) {
          expect(game.name).toBeTruthy()
          expect(game.round).toBeTruthy()
          expect(game.display_order).toBeGreaterThan(0)
        }
      }
    })
  })
})
