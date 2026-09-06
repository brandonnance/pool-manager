import { describe, it, expect } from 'vitest'
import { computeWeekLockAt, zonedTimeToUtc, zonedParts, mapEspnStatus, mapEspnEvent, type EspnEvent } from '../schedule'

describe('zonedTimeToUtc', () => {
  it('noon CDT in September is 17:00Z', () => {
    expect(zonedTimeToUtc(2026, 9, 13, 12, 0, 'America/Chicago').toISOString()).toBe('2026-09-13T17:00:00.000Z')
  })
  it('noon CST in January is 18:00Z', () => {
    expect(zonedTimeToUtc(2027, 1, 10, 12, 0, 'America/Chicago').toISOString()).toBe('2027-01-10T18:00:00.000Z')
  })
  it('round-trips through zonedParts', () => {
    const d = zonedTimeToUtc(2026, 11, 1, 12, 0, 'America/Chicago') // DST ends this day
    const p = zonedParts(d, 'America/Chicago')
    expect([p.month, p.day, p.hour, p.minute]).toEqual([11, 1, 12, 0])
  })
})

describe('computeWeekLockAt', () => {
  it('Week 1 2026 (Wed opener) locks Sun Sep 13 12:00 CDT', () => {
    const lock = computeWeekLockAt(['2026-09-10T00:20:00Z', '2026-09-11T00:35:00Z', '2026-09-13T17:00:00Z', '2026-09-15T00:15:00Z'])
    expect(lock.toISOString()).toBe('2026-09-13T17:00:00.000Z')
  })
  it('a normal Thursday-start week locks the following Sunday', () => {
    // Thu Sep 17 2026 7:15 PM CDT = 00:15Z Sep 18
    const lock = computeWeekLockAt(['2026-09-18T00:15:00Z', '2026-09-20T17:00:00Z'])
    expect(lock.toISOString()).toBe('2026-09-20T17:00:00.000Z')
  })
  it('a Saturday-start week (late season, CST) locks the next day at 18:00Z', () => {
    // Sat Jan 9 2027 3:30 PM CST = 21:30Z
    const lock = computeWeekLockAt(['2027-01-09T21:30:00Z', '2027-01-10T18:00:00Z'])
    expect(lock.toISOString()).toBe('2027-01-10T18:00:00.000Z')
  })
  it('uses the earliest kickoff regardless of array order', () => {
    const lock = computeWeekLockAt(['2026-09-15T00:15:00Z', '2026-09-10T00:20:00Z'])
    expect(lock.toISOString()).toBe('2026-09-13T17:00:00.000Z')
  })
  it('Sunday-morning London game does not push the lock a week', () => {
    // Sun 8:30 AM CDT = 13:30Z, before noon lock the same day
    const lock = computeWeekLockAt(['2026-10-04T13:30:00Z', '2026-10-04T17:00:00Z'])
    expect(lock.toISOString()).toBe('2026-10-04T17:00:00.000Z')
  })
})

describe('mapEspnStatus', () => {
  it('maps the statuses we care about', () => {
    expect(mapEspnStatus('STATUS_SCHEDULED')).toBe('scheduled')
    expect(mapEspnStatus('STATUS_IN_PROGRESS')).toBe('in_progress')
    expect(mapEspnStatus('STATUS_HALFTIME')).toBe('in_progress')
    expect(mapEspnStatus('STATUS_FINAL')).toBe('final')
    expect(mapEspnStatus('STATUS_FINAL_OVERTIME')).toBe('final')
    expect(mapEspnStatus('STATUS_POSTPONED')).toBe('postponed')
    expect(mapEspnStatus('STATUS_CANCELED')).toBe('canceled')
    expect(mapEspnStatus('SOMETHING_NEW')).toBe('scheduled')
  })
})

describe('mapEspnEvent', () => {
  const base: EspnEvent = {
    id: '401772510',
    date: '2026-09-10T00:20Z',
    name: 'New England Patriots at Seattle Seahawks',
    shortName: 'NE @ SEA',
    competitions: [{
      id: '401772510',
      date: '2026-09-10T00:20Z',
      neutralSite: false,
      venue: { fullName: 'Lumen Field', address: { city: 'Seattle', state: 'WA', country: 'USA' } },
      status: { clock: 0, displayClock: '0:00', period: 0, type: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false } },
      competitors: [
        { homeAway: 'home', team: { id: '26', abbreviation: 'SEA', displayName: 'Seattle Seahawks', logo: 'sea.png' }, score: '0' },
        { homeAway: 'away', team: { id: '17', abbreviation: 'NE', displayName: 'New England Patriots', logo: 'ne.png' }, score: '0' },
      ],
    }],
  }

  it('maps the DraftKings line when present', () => {
    const ev: EspnEvent = { ...base, competitions: [{ ...base.competitions[0],
      odds: [{ provider: { id: '58', name: 'DraftKings' }, details: 'SEA -3.5', overUnder: 44.5, spread: -3.5 }] }] }
    const g = mapEspnEvent(ev, 2026, 1)!
    expect(g).toMatchObject({ spread: -3.5, over_under: 44.5, odds_details: 'SEA -3.5', odds_provider: 'DraftKings' })
  })

  it('nulls the line when ESPN omits odds', () => {
    const g = mapEspnEvent(base, 2026, 1)!
    expect(g).toMatchObject({ spread: null, over_under: null, odds_details: null, odds_provider: null })
  })

  it('maps a scheduled game with null scores', () => {
    const g = mapEspnEvent(base, 2026, 1)!
    expect(g).toMatchObject({
      espn_game_id: '401772510', season_year: 2026, week_number: 1,
      home_abbr: 'SEA', away_abbr: 'NE', status: 'scheduled',
      home_score: null, away_score: null, winner: null, qualifies: false, neutral_site: false,
      venue: 'Lumen Field, Seattle, WA',
    })
    expect(g.kickoff_at).toBe('2026-09-10T00:20:00.000Z')
  })

  it('maps a final game with winner and qualifies', () => {
    const ev: EspnEvent = JSON.parse(JSON.stringify(base))
    ev.competitions[0].status.type = { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true }
    ev.competitions[0].competitors[0].score = '27'
    ev.competitions[0].competitors[1].score = '20'
    const g = mapEspnEvent(ev, 2026, 1)!
    expect(g).toMatchObject({ status: 'final', home_score: 27, away_score: 20, winner: 'home', qualifies: true })
  })

  it('a tie is final but does not qualify', () => {
    const ev: EspnEvent = JSON.parse(JSON.stringify(base))
    ev.competitions[0].status.type = { id: '3', name: 'STATUS_FINAL_OVERTIME', state: 'post', completed: true }
    ev.competitions[0].competitors[0].score = '20'
    ev.competitions[0].competitors[1].score = '20'
    const g = mapEspnEvent(ev, 2026, 1)!
    expect(g).toMatchObject({ status: 'final', winner: 'tie', qualifies: false })
  })

  it('flags neutral-site games and uses country when state is absent', () => {
    const ev: EspnEvent = JSON.parse(JSON.stringify(base))
    ev.competitions[0].neutralSite = true
    ev.competitions[0].venue = { fullName: 'MCG', address: { city: 'Melbourne', country: 'Australia' } }
    const g = mapEspnEvent(ev, 2026, 1)!
    expect(g.neutral_site).toBe(true)
    expect(g.venue).toBe('MCG, Melbourne, Australia')
  })
})

describe('pickCurrentWeek', () => {
  const weeks = [
    { id: '1', season_year: 2026, week_number: 1, lock_at: '2026-09-13T17:00:00Z', first_kickoff_at: '2026-09-10T00:20:00Z', last_kickoff_at: '2026-09-15T00:15:00Z', status: 'open' as const, finalized_at: null },
    { id: '2', season_year: 2026, week_number: 2, lock_at: '2026-09-20T17:00:00Z', first_kickoff_at: '2026-09-18T00:15:00Z', last_kickoff_at: '2026-09-22T00:15:00Z', status: 'upcoming' as const, finalized_at: null },
  ]
  it('is week 1 before the season and during week 1', async () => {
    const { pickCurrentWeek } = await import('../schedule')
    expect(pickCurrentWeek(weeks, new Date('2026-09-01T00:00:00Z'))?.week_number).toBe(1)
    expect(pickCurrentWeek(weeks, new Date('2026-09-14T00:00:00Z'))?.week_number).toBe(1)
  })
  it('stays week 1 during MNF and its overtime, flips to week 2 after the 5h tail', async () => {
    const { pickCurrentWeek } = await import('../schedule')
    expect(pickCurrentWeek(weeks, new Date('2026-09-15T03:00:00Z'))?.week_number).toBe(1)
    expect(pickCurrentWeek(weeks, new Date('2026-09-15T05:16:00Z'))?.week_number).toBe(2)
  })
  it('falls back to the last week after the season', async () => {
    const { pickCurrentWeek } = await import('../schedule')
    expect(pickCurrentWeek(weeks, new Date('2027-03-01T00:00:00Z'))?.week_number).toBe(2)
  })
  it('returns null with no weeks', async () => {
    const { pickCurrentWeek } = await import('../schedule')
    expect(pickCurrentWeek([], new Date())).toBeNull()
  })

  describe('joinWeekFor', () => {
    const threeWeeks = [
      ...weeks,
      { id: '3', season_year: 2026, week_number: 3, lock_at: '2026-09-27T17:00:00Z', first_kickoff_at: '2026-09-25T00:15:00Z', last_kickoff_at: '2026-09-29T00:15:00Z', status: 'upcoming' as const, finalized_at: null },
    ]
    it('is week 1 before the season and all the way through week 1 until the noon lock', async () => {
      const { joinWeekFor } = await import('../schedule')
      expect(joinWeekFor(weeks, new Date('2026-09-01T00:00:00Z'))).toBe(1)
      // Thursday of week 1: opener already played, still joinable for the rest of the week
      expect(joinWeekFor(weeks, new Date('2026-09-11T12:00:00Z'))).toBe(1)
      expect(joinWeekFor(weeks, new Date('2026-09-13T16:59:59Z'))).toBe(1)
    })
    it('moves to week 2 at the week 1 lock, and stays there through MNF', async () => {
      const { joinWeekFor } = await import('../schedule')
      expect(joinWeekFor(weeks, new Date('2026-09-13T17:00:00Z'))).toBe(2)
      expect(joinWeekFor(weeks, new Date('2026-09-15T03:00:00Z'))).toBe(2)
    })
    it('after week 1, a week that has kicked off is closed to joiners (Rule 18)', async () => {
      const { joinWeekFor } = await import('../schedule')
      // Tuesday of week 2, before Thursday night
      expect(joinWeekFor(threeWeeks, new Date('2026-09-16T12:00:00Z'))).toBe(2)
      // Friday of week 2, TNF already played: wait for week 3
      expect(joinWeekFor(threeWeeks, new Date('2026-09-18T12:00:00Z'))).toBe(3)
    })
    it('is null when there is no later week to join, or no schedule', async () => {
      const { joinWeekFor } = await import('../schedule')
      expect(joinWeekFor(weeks, new Date('2026-09-18T12:00:00Z'))).toBeNull()
      expect(joinWeekFor([], new Date('2026-09-01T00:00:00Z'))).toBeNull()
    })
  })

  describe('nextOpenWeek / maxPickableWeek', () => {
    it('is closed while the current week is still open (Saturday night)', async () => {
      const { nextOpenWeek, maxPickableWeek } = await import('../schedule')
      const now = new Date('2026-09-13T16:59:00Z')
      expect(nextOpenWeek(weeks, weeks[0], now)).toBeNull()
      expect(maxPickableWeek(weeks, now)).toBe(1)
    })
    it('opens week 2 at the Sunday-noon lock while week 1 is still being played', async () => {
      const { nextOpenWeek, maxPickableWeek } = await import('../schedule')
      const now = new Date('2026-09-13T17:00:00Z')
      expect(nextOpenWeek(weeks, weeks[0], now)?.week_number).toBe(2)
      expect(maxPickableWeek(weeks, now)).toBe(2)
      // MNF still in progress: current is 1, next is 2
      expect(maxPickableWeek(weeks, new Date('2026-09-15T03:00:00Z'))).toBe(2)
    })
    it('closes again once week 2 becomes current (it is not yet locked)', async () => {
      const { nextOpenWeek, maxPickableWeek } = await import('../schedule')
      const now = new Date('2026-09-15T06:00:00Z')
      expect(nextOpenWeek(weeks, weeks[1], now)).toBeNull()
      expect(maxPickableWeek(weeks, now)).toBe(2)
    })
    it('has nothing to open after the last week', async () => {
      const { nextOpenWeek } = await import('../schedule')
      expect(nextOpenWeek(weeks, weeks[1], new Date('2027-03-01T00:00:00Z'))).toBeNull()
      expect(nextOpenWeek(weeks, null, new Date())).toBeNull()
    })
  })
})
