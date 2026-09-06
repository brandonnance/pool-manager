/**
 * NFL Desperation schedule helpers — pure functions.
 *
 * - Time-zone math for the Sunday 12:00 PM Central week lock (no date library).
 * - Mapping ESPN scoreboard events onto nd_games rows.
 */
import type { GameStatus, Winner, NdWeek } from './types'

export const POOL_TIMEZONE = 'America/Chicago'
export const LOCK_HOUR_LOCAL = 12
export const REGULAR_SEASON_WEEKS = 18
/** How long after the last kickoff a week is still "current" (covers OT + delays). */
export const WEEK_TAIL_MS = 5 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Time zone helpers
// ---------------------------------------------------------------------------

interface ZonedParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  weekday: number // 0=Sun..6=Sat
}

/** Calendar fields of `date` as seen in `tz`. */
export function zonedParts(date: Date, tz: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday] ?? 0,
  }
}

/** Offset (minutes) of `tz` relative to UTC at the instant `date`. CDT = -300, CST = -360. */
function tzOffsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0)
  // drop seconds/ms from `date` so the comparison is minute-aligned
  const truncated = Math.floor(date.getTime() / 60000) * 60000
  return Math.round((asUtc - truncated) / 60000)
}

/** Build the UTC instant for a wall-clock time in `tz`. Handles DST. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute))
  const offset = tzOffsetMinutes(guess, tz)
  const first = new Date(guess.getTime() - offset * 60000)
  const offset2 = tzOffsetMinutes(first, tz)
  return offset2 === offset ? first : new Date(guess.getTime() - offset2 * 60000)
}

/**
 * Week lock: 12:00 PM Central on the first Sunday on or after the earliest kickoff.
 * Week 1 2026: earliest kickoff Wed Sep 9 → Sun Sep 13 12:00 CDT = 17:00Z.
 */
export function computeWeekLockAt(kickoffs: Array<string | Date>, tz: string = POOL_TIMEZONE): Date {
  if (kickoffs.length === 0) throw new Error('computeWeekLockAt: no kickoffs')
  const earliest = kickoffs
    .map((k) => (k instanceof Date ? k : new Date(k)))
    .reduce((a, b) => (a < b ? a : b))

  const p = zonedParts(earliest, tz)
  const daysUntilSunday = (7 - p.weekday) % 7 // 0 if already Sunday
  // advance calendar date in the zone by daysUntilSunday
  const local = new Date(Date.UTC(p.year, p.month - 1, p.day + daysUntilSunday))
  return zonedTimeToUtc(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
    LOCK_HOUR_LOCAL,
    0,
    tz
  )
}

// ---------------------------------------------------------------------------
// ESPN mapping
// ---------------------------------------------------------------------------

export interface EspnTeam {
  id: string
  abbreviation: string
  displayName: string
  shortDisplayName?: string
  logo?: string
}
export interface EspnCompetitor {
  homeAway: 'home' | 'away'
  team: EspnTeam
  score?: string
}
export interface EspnStatus {
  clock: number
  displayClock: string
  period: number
  type: { id: string; name: string; state: 'pre' | 'in' | 'post'; completed: boolean }
}
export interface EspnOdds {
  provider?: { id?: string; name?: string }
  details?: string      // display string, e.g. "SEA -3.5" or "EVEN"
  overUnder?: number
  spread?: number       // home-relative: negative = home favored
}
export interface EspnCompetition {
  id: string
  date: string
  neutralSite?: boolean
  venue?: { fullName?: string; address?: { city?: string; state?: string; country?: string } }
  competitors: EspnCompetitor[]
  status: EspnStatus
  odds?: EspnOdds[]
}
export interface EspnEvent {
  id: string
  date: string
  name: string
  shortName: string
  competitions: EspnCompetition[]
}
export interface EspnScoreboard {
  season?: { type: number; year: number }
  week?: { number: number }
  events: EspnEvent[]
}

export function mapEspnStatus(name: string): GameStatus {
  switch (name) {
    case 'STATUS_FINAL':
    case 'STATUS_FINAL_OVERTIME':
      return 'final'
    case 'STATUS_IN_PROGRESS':
    case 'STATUS_HALFTIME':
    case 'STATUS_END_PERIOD':
    case 'STATUS_DELAYED':
    case 'STATUS_SUSPENDED':
      return 'in_progress'
    case 'STATUS_POSTPONED':
      return 'postponed'
    case 'STATUS_CANCELED':
    case 'STATUS_CANCELLED':
    case 'STATUS_FORFEIT':
      return 'canceled'
    case 'STATUS_SCHEDULED':
    default:
      return 'scheduled'
  }
}

export interface MappedGame {
  season_year: number
  week_number: number
  espn_game_id: string
  home_team: string
  home_abbr: string
  home_logo: string | null
  away_team: string
  away_abbr: string
  away_logo: string | null
  kickoff_at: string
  venue: string | null
  neutral_site: boolean
  home_score: number | null
  away_score: number | null
  status: GameStatus
  period: number | null
  clock: string | null
  winner: Winner | null
  qualifies: boolean
  /** Betting line — informational only, never used in scoring */
  spread: number | null
  over_under: number | null
  odds_details: string | null
  odds_provider: string | null
}

function parseScore(s: string | undefined, status: GameStatus): number | null {
  if (status === 'scheduled' || status === 'postponed') return null
  if (s === undefined || s === '') return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

/** Map one ESPN event to an nd_games row. Returns null if home/away can't be identified. */
export function mapEspnEvent(event: EspnEvent, seasonYear: number, weekNumber: number): MappedGame | null {
  const comp = event.competitions?.[0]
  if (!comp) return null
  const home = comp.competitors.find((c) => c.homeAway === 'home')
  const away = comp.competitors.find((c) => c.homeAway === 'away')
  if (!home || !away) return null

  const status = mapEspnStatus(comp.status?.type?.name ?? 'STATUS_SCHEDULED')
  const homeScore = parseScore(home.score, status)
  const awayScore = parseScore(away.score, status)

  let winner: Winner | null = null
  if (status === 'final' && homeScore !== null && awayScore !== null) {
    winner = homeScore === awayScore ? 'tie' : homeScore > awayScore ? 'home' : 'away'
  }

  const addr = comp.venue?.address
  const venueBits = [comp.venue?.fullName, addr?.city, addr?.state ?? addr?.country].filter(Boolean)

  const odds = comp.odds?.[0]
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  return {
    season_year: seasonYear,
    week_number: weekNumber,
    espn_game_id: event.id,
    home_team: home.team.displayName,
    home_abbr: home.team.abbreviation,
    home_logo: home.team.logo ?? null,
    away_team: away.team.displayName,
    away_abbr: away.team.abbreviation,
    away_logo: away.team.logo ?? null,
    kickoff_at: new Date(comp.date ?? event.date).toISOString(),
    venue: venueBits.length ? venueBits.join(', ') : null,
    neutral_site: !!comp.neutralSite,
    home_score: homeScore,
    away_score: awayScore,
    status,
    period: comp.status?.period ?? null,
    clock: comp.status?.displayClock ?? null,
    winner,
    qualifies: status === 'final' && winner !== null && winner !== 'tie',
    spread: num(odds?.spread),
    over_under: num(odds?.overUnder),
    odds_details: odds?.details?.trim() || null,
    odds_provider: odds?.provider?.name ?? null,
  }
}

// ---------------------------------------------------------------------------
// Current week
// ---------------------------------------------------------------------------

/**
 * The week players should be looking at right now:
 * the first week whose last game hasn't wrapped up yet (last kickoff + 5h), else the final week.
 * Deterministic — does not depend on anyone having finalized anything.
 */
export function pickCurrentWeek(weeks: NdWeek[], now: Date = new Date()): NdWeek | null {
  if (weeks.length === 0) return null
  for (const w of weeks) {
    const last = w.last_kickoff_at ? new Date(w.last_kickoff_at).getTime() : 0
    if (last + WEEK_TAIL_MS > now.getTime()) return w
  }
  return weeks[weeks.length - 1]
}

/**
 * The week after `current` opens for picks the moment `current` hits its
 * Sunday-noon lock (its games may still be in progress through Monday night).
 * Returns that week, or null if `current` is still open or is the last week.
 */
export function nextOpenWeek(weeks: NdWeek[], current: NdWeek | null, now: Date = new Date()): NdWeek | null {
  if (!current) return null
  if (now.getTime() < new Date(current.lock_at).getTime()) return null
  return weeks.find((w) => w.week_number === current.week_number + 1) ?? null
}

/** Highest week number a player may currently edit picks for. 0 if no schedule. */
export function maxPickableWeek(weeks: NdWeek[], now: Date = new Date()): number {
  const current = pickCurrentWeek(weeks, now)
  const next = nextOpenWeek(weeks, current, now)
  return next?.week_number ?? current?.week_number ?? 0
}

/**
 * First week someone joining right now can compete in, or null when the schedule
 * isn't loaded or the season is over.
 *
 * Week 1 stays joinable right up to its Sunday-noon lock (late signups just miss
 * the games already played). After that, Rule 18 applies: nobody joins a week
 * that has already kicked off — they start with the next one.
 */
export function joinWeekFor(weeks: NdWeek[], now: Date = new Date()): number | null {
  const current = pickCurrentWeek(weeks, now)
  if (!current) return null
  const t = now.getTime()
  const locked = t >= new Date(current.lock_at).getTime()
  const started = current.first_kickoff_at ? t >= new Date(current.first_kickoff_at).getTime() : false
  if (!locked && !(started && current.week_number > 1)) return current.week_number
  return weeks.find((w) => w.week_number === current.week_number + 1)?.week_number ?? null
}

