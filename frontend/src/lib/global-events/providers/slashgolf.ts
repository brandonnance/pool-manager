/**
 * @fileoverview SlashGolf Provider for Global Events
 *
 * Handles fetching and normalizing data from the SlashGolf API
 * (via RapidAPI) for PGA tournaments.
 *
 * Reuses logic from lib/slashgolf/client.ts for the worker system.
 */

import type { GolfTournamentPayload, GolfLeaderboardEntry, EventStatus } from '../types'

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com'

// MongoDB Extended JSON types (used by SlashGolf API)
interface MongoNumber {
  $numberInt?: string
  $numberLong?: string
}

interface MongoDate {
  $date: {
    $numberLong: string
  }
}

// SlashGolf API response types
interface SlashGolfLeaderboardResponse {
  orgId: string
  year: string
  tournId: string
  status: string
  roundId: MongoNumber
  roundStatus: string
  cutLines?: Array<{ cutCount: MongoNumber; cutScore: string }>
  leaderboardRows: SlashGolfLeaderboardEntry[]
}

interface SlashGolfLeaderboardEntry {
  playerId: string
  firstName: string
  lastName: string
  isAmateur?: boolean
  courseId?: string
  status: string
  position: string
  total: string
  totalStrokesFromCompletedRounds?: string
  currentRoundScore?: string
  currentHole?: MongoNumber
  roundComplete?: boolean
  thru: string | number
  currentRound?: MongoNumber
  rounds: SlashGolfRound[]
}

interface SlashGolfRound {
  roundId: MongoNumber
  strokes: MongoNumber
  scoreToPar: string
  courseId?: string
  courseName?: string
}

interface SlashGolfScheduleResponse {
  orgId: string
  year: string
  schedule: SlashGolfTournamentRaw[]
}

interface SlashGolfTournamentRaw {
  tournId: string
  name: string
  date: {
    start: MongoDate
    end: MongoDate
    weekNumber: string
  }
  format: string
  purse: MongoNumber
  winnersShare: MongoNumber
  fedexCupPoints: MongoNumber
  courses?: Array<{
    courseId: string
    courseName: string
    location?: {
      city: string
      state: string
      country: string
    }
    par?: number
  }>
}

interface SlashGolfTournamentFieldResponse {
  tournId: string
  name: string
  date: {
    start: string
    end: string
    year: number
  }
  courses: Array<{
    courseId: string
    courseName: string
  }>
  players: Array<{
    playerId: string
    firstName: string
    lastName: string
    isAmateur?: boolean
    status?: string
  }>
}

// Helper functions
function parseMongoNumber(val: MongoNumber | number | undefined): number | undefined {
  if (val === undefined) return undefined
  if (typeof val === 'number') return val
  if (val.$numberInt) return parseInt(val.$numberInt)
  if (val.$numberLong) return parseInt(val.$numberLong)
  return undefined
}

function parseMongoDate(val: MongoDate | string | undefined): string | undefined {
  if (val === undefined) return undefined
  if (typeof val === 'string') return val
  if (val.$date?.$numberLong) {
    return new Date(parseInt(val.$date.$numberLong)).toISOString().split('T')[0]
  }
  return undefined
}

function parseToPar(val: string): number {
  if (val === 'E') return 0
  return parseInt(val) || 0
}

function mapPlayerStatus(status?: string): 'active' | 'cut' | 'withdrawn' | 'disqualified' {
  switch (status) {
    case 'cut':
      return 'cut'
    case 'wd':
      return 'withdrawn'
    case 'dq':
      return 'disqualified'
    default:
      return 'active'
  }
}

/**
 * SlashGolf API client for worker use
 */
export class SlashGolfWorkerClient {
  private apiKey: string
  private host: string

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('RapidAPI key is required')
    }
    this.apiKey = apiKey
    this.host = RAPIDAPI_HOST
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`https://${this.host}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.host,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 429) {
        throw new Error('Rate limit exceeded')
      }
      if (response.status === 403) {
        throw new Error('API key invalid or subscription required')
      }
      throw new Error(`SlashGolf API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  /**
   * Fetches the leaderboard for a tournament
   */
  async getLeaderboard(tournId: string, year: number): Promise<SlashGolfLeaderboardResponse> {
    return this.fetch<SlashGolfLeaderboardResponse>('/leaderboard', {
      tournId,
      year: String(year),
    })
  }

  /**
   * Fetches the tournament schedule for a year
   */
  async getSchedule(year: number, orgId: string = '1'): Promise<SlashGolfScheduleResponse> {
    return this.fetch<SlashGolfScheduleResponse>('/schedule', {
      orgId,
      year: String(year),
    })
  }

  /**
   * Fetches the field (entry list) for a tournament
   */
  async getTournamentField(tournId: string, year: number): Promise<SlashGolfTournamentFieldResponse> {
    return this.fetch<SlashGolfTournamentFieldResponse>('/tournament', {
      tournId,
      year: String(year),
    })
  }
}

/**
 * Normalizes SlashGolf leaderboard data to our GolfTournamentPayload format
 */
export function normalizeLeaderboard(response: SlashGolfLeaderboardResponse): GolfTournamentPayload {
  const currentRound = parseMongoNumber(response.roundId) ?? 1

  // Map round status
  let roundStatus = 'not_started'
  if (response.roundStatus === 'Complete' || response.roundStatus === 'Official') {
    roundStatus = 'complete'
  } else if (response.status === 'Official') {
    roundStatus = 'official'
  } else if (response.leaderboardRows?.length > 0) {
    roundStatus = 'in_progress'
  }

  // Parse cut line
  let cutLine: number | undefined
  if (response.cutLines?.[0]?.cutScore) {
    cutLine = parseToPar(response.cutLines[0].cutScore)
  }

  // Normalize leaderboard entries
  const leaderboard: GolfLeaderboardEntry[] = (response.leaderboardRows || []).map((entry) => {
    const rounds: GolfLeaderboardEntry['rounds'] = {}

    for (const round of entry.rounds || []) {
      const roundNum = parseMongoNumber(round.roundId)
      const strokes = parseMongoNumber(round.strokes)
      if (roundNum && strokes !== undefined) {
        switch (roundNum) {
          case 1:
            rounds.round1 = strokes
            break
          case 2:
            rounds.round2 = strokes
            break
          case 3:
            rounds.round3 = strokes
            break
          case 4:
            rounds.round4 = strokes
            break
        }
      }
    }

    return {
      player_id: entry.playerId,
      player_name: `${entry.firstName} ${entry.lastName}`,
      position: entry.position || '-',
      to_par: parseToPar(entry.total),
      thru: entry.thru,
      total_strokes: entry.totalStrokesFromCompletedRounds
        ? parseInt(entry.totalStrokesFromCompletedRounds)
        : undefined,
      status: mapPlayerStatus(entry.status),
      rounds,
    }
  })

  return {
    current_round: currentRound,
    round_status: roundStatus,
    cut_line: cutLine,
    leaderboard,
  }
}

/**
 * Determines the EventStatus from a golf tournament payload
 */
export function getGolfEventStatus(payload: GolfTournamentPayload): EventStatus {
  if (payload.round_status === 'official') {
    return 'final'
  }
  if (payload.round_status === 'complete' && payload.current_round === 4) {
    return 'final'
  }
  if (payload.leaderboard.length > 0 && payload.round_status !== 'not_started') {
    return 'in_progress'
  }
  return 'scheduled'
}

/**
 * Fetches and normalizes tournament data
 */
export async function fetchGolfTournamentState(
  apiKey: string,
  tournId: string,
  year: number
): Promise<{ payload: GolfTournamentPayload; status: EventStatus }> {
  const client = new SlashGolfWorkerClient(apiKey)
  const response = await client.getLeaderboard(tournId, year)
  const payload = normalizeLeaderboard(response)
  const status = getGolfEventStatus(payload)

  return { payload, status }
}

export interface GolfTournamentInfo {
  tournId: string
  name: string
  startDate: string
  endDate: string
  venue?: string
  par?: number
  status: 'upcoming' | 'in_progress' | 'completed'
}

/**
 * Fetches upcoming tournaments from the schedule
 */
export async function fetchUpcomingTournaments(
  apiKey: string,
  year: number
): Promise<GolfTournamentInfo[]> {
  const client = new SlashGolfWorkerClient(apiKey)
  const schedule = await client.getSchedule(year)
  const now = new Date()

  return schedule.schedule
    .map((t) => {
      const startDateStr = parseMongoDate(t.date.start)
      const endDateStr = parseMongoDate(t.date.end)
      const startDate = startDateStr ? new Date(startDateStr) : new Date()
      const endDate = endDateStr ? new Date(endDateStr) : new Date()

      let status: 'upcoming' | 'in_progress' | 'completed' = 'upcoming'
      if (endDate < now) {
        status = 'completed'
      } else if (startDate <= now && endDate >= now) {
        status = 'in_progress'
      }

      const course = t.courses?.[0]

      return {
        tournId: t.tournId,
        name: t.name,
        startDate: startDateStr || '',
        endDate: endDateStr || '',
        venue: course?.courseName,
        par: course?.par,
        status,
      }
    })
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
}

export interface GolfFieldPlayer {
  playerId: string
  firstName: string
  lastName: string
  fullName: string
}

/**
 * Fetches the field for a tournament
 */
export async function fetchTournamentField(
  apiKey: string,
  tournId: string,
  year: number
): Promise<GolfFieldPlayer[]> {
  const client = new SlashGolfWorkerClient(apiKey)
  const response = await client.getTournamentField(tournId, year)

  return (response.players || []).map((p) => ({
    playerId: p.playerId,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: `${p.firstName} ${p.lastName}`,
  }))
}
