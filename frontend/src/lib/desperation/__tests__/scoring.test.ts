import { describe, it, expect } from 'vitest'
import { triangular, deriveWinner, scoreWeek, entryWeekState, rankByPoints } from '../scoring'
import type { NdGame, NdPick } from '../types'

function game(id: string, over: Partial<NdGame> = {}): NdGame {
  return {
    id,
    season_year: 2026,
    week_number: 1,
    espn_game_id: id,
    home_team: 'Home', home_abbr: 'HM', home_logo: null,
    away_team: 'Away', away_abbr: 'AW', away_logo: null,
    kickoff_at: '2026-09-13T17:00:00Z',
    venue: null, neutral_site: false,
    home_score: null, away_score: null,
    status: 'scheduled', period: null, clock: null,
    winner: null, qualifies: false,
    ...over,
  }
}
const finalHome = (id: string) => game(id, { status: 'final', home_score: 24, away_score: 17, winner: 'home', qualifies: true })
const finalAway = (id: string) => game(id, { status: 'final', home_score: 10, away_score: 27, winner: 'away', qualifies: true })
const tie = (id: string) => game(id, { status: 'final', home_score: 20, away_score: 20, winner: 'tie', qualifies: false })
const canceled = (id: string) => game(id, { status: 'canceled' })
const live = (id: string) => game(id, { status: 'in_progress', home_score: 7, away_score: 3 })

describe('triangular', () => {
  it('matches the rules table', () => {
    const table = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105, 120, 136]
    table.forEach((pts, n) => expect(triangular(n)).toBe(pts))
  })
  it('is 0 for negatives', () => expect(triangular(-3)).toBe(0))
})

describe('deriveWinner', () => {
  it('returns null unless final', () => {
    expect(deriveWinner({ status: 'in_progress', home_score: 7, away_score: 3 })).toBeNull()
  })
  it('detects home, away, tie', () => {
    expect(deriveWinner({ status: 'final', home_score: 24, away_score: 17 })).toBe('home')
    expect(deriveWinner({ status: 'final', home_score: 10, away_score: 27 })).toBe('away')
    expect(deriveWinner({ status: 'final', home_score: 20, away_score: 20 })).toBe('tie')
  })
})

describe('scoreWeek', () => {
  it('perfect 5-pick week scores 15', () => {
    const games = ['a', 'b', 'c', 'd', 'e'].map(finalHome)
    const picks: NdPick[] = games.map((g) => ({ game_id: g.id, selection: 'home' }))
    const s = scoreWeek(picks, games)
    expect(s).toMatchObject({ picksMade: 5, correct: 5, wrong: 0, qualifying: 5, busted: false, complete: true, finalPoints: 15 })
    expect(entryWeekState(s)).toBe('perfect')
  })

  it('one wrong pick zeroes the week (rules §6 example)', () => {
    const games = [finalHome('a'), finalHome('b'), finalHome('c'), finalHome('d'), finalAway('e')]
    const picks: NdPick[] = games.map((g) => ({ game_id: g.id, selection: 'home' }))
    const s = scoreWeek(picks, games)
    expect(s.correct).toBe(4)
    expect(s.wrong).toBe(1)
    expect(s.busted).toBe(true)
    expect(s.finalPoints).toBe(0)
    expect(s.potentialPoints).toBe(0)
    expect(entryWeekState(s)).toBe('busted')
  })

  it('a tie disappears: 6 picks, 1 tie, 5 correct → 15 (rules §7 example)', () => {
    const games = [finalHome('a'), finalHome('b'), finalHome('c'), finalHome('d'), finalHome('e'), tie('f')]
    const picks: NdPick[] = games.map((g) => ({ game_id: g.id, selection: 'home' }))
    const s = scoreWeek(picks, games)
    expect(s.voided).toBe(1)
    expect(s.qualifying).toBe(5)
    expect(s.finalPoints).toBe(15)
  })

  it('a canceled game disappears the same way', () => {
    const games = [finalHome('a'), finalHome('b'), canceled('c')]
    const picks: NdPick[] = games.map((g) => ({ game_id: g.id, selection: 'home' }))
    expect(scoreWeek(picks, games).finalPoints).toBe(3)
  })

  it('is provisional while games are pending, and potential reflects remaining picks', () => {
    const games = [finalHome('a'), finalHome('b'), live('c'), game('d')]
    const picks: NdPick[] = games.map((g) => ({ game_id: g.id, selection: 'home' }))
    const s = scoreWeek(picks, games)
    expect(s.complete).toBe(false)
    expect(s.finalPoints).toBeNull()
    expect(s.pending).toBe(2)
    expect(s.potentialPoints).toBe(triangular(4))
    expect(entryWeekState(s)).toBe('alive')
  })

  it('busted stays busted even with games pending', () => {
    const games = [finalAway('a'), live('b'), game('c')]
    const picks: NdPick[] = games.map((g) => ({ game_id: g.id, selection: 'home' }))
    const s = scoreWeek(picks, games)
    expect(s.busted).toBe(true)
    expect(s.potentialPoints).toBe(0)
    expect(s.finalPoints).toBeNull()
  })

  it('zero picks is 0 points and no_picks state', () => {
    const s = scoreWeek([], [finalHome('a')])
    expect(s.finalPoints).toBe(0)
    expect(entryWeekState(s)).toBe('no_picks')
  })

  it('all picks tied → 0 points but not busted', () => {
    const games = [tie('a'), tie('b')]
    const picks: NdPick[] = games.map((g) => ({ game_id: g.id, selection: 'home' }))
    const s = scoreWeek(picks, games)
    expect(s.busted).toBe(false)
    expect(s.qualifying).toBe(0)
    expect(s.finalPoints).toBe(0)
  })

  it('ignores picks on unknown games', () => {
    const s = scoreWeek([{ game_id: 'zzz', selection: 'home' }], [finalHome('a')])
    expect(s.picksMade).toBe(0)
  })
})

describe('rankByPoints', () => {
  it('shares ranks on ties with no tiebreaker (1, 2, 2, 4)', () => {
    const r = rankByPoints([
      { entryId: 'a', points: 50 },
      { entryId: 'b', points: 30 },
      { entryId: 'c', points: 30 },
      { entryId: 'd', points: 10 },
    ])
    expect(r.map((x) => [x.entryId, x.rank, x.tied])).toEqual([
      ['a', 1, false], ['b', 2, true], ['c', 2, true], ['d', 4, false],
    ])
  })
})
