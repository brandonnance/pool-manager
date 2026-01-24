/**
 * @fileoverview SlashGolf Provider for Edge Functions
 */

import type { GolfTournamentPayload, GolfLeaderboardEntry, EventStatus } from '../types.ts'

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com'

// MongoDB Extended JSON types
interface MongoNumber {
  $numberInt?: string
  $numberLong?: string
}

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
  status: string
  position: string
  total: string
  totalStrokesFromCompletedRounds?: string
  thru: string | number
  rounds: SlashGolfRound[]
}

interface SlashGolfRound {
  roundId: MongoNumber
  strokes: MongoNumber
  scoreToPar: string
}

function parseMongoNumber(val: MongoNumber | number | undefined): number | undefined {
  if (val === undefined) return undefined
  if (typeof val === 'number') return val
  if (val.$numberInt) return parseInt(val.$numberInt)
  if (val.$numberLong) return parseInt(val.$numberLong)
  return undefined
}

function parseToPar(val: string): number {
  if (val === 'E') return 0
  return parseInt(val) || 0
}

function mapPlayerStatus(status?: string): 'active' | 'cut' | 'withdrawn' | 'disqualified' {
  switch (status) {
    case 'cut': return 'cut'
    case 'wd': return 'withdrawn'
    case 'dq': return 'disqualified'
    default: return 'active'
  }
}

export async function fetchGolfLeaderboard(
  apiKey: string,
  tournId: string,
  year: number
): Promise<SlashGolfLeaderboardResponse> {
  const url = new URL(`https://${RAPIDAPI_HOST}/leaderboard`)
  url.searchParams.append('tournId', tournId)
  url.searchParams.append('year', String(year))

  const response = await fetch(url.toString(), {
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SlashGolf API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

export function normalizeLeaderboard(response: SlashGolfLeaderboardResponse): GolfTournamentPayload {
  const currentRound = parseMongoNumber(response.roundId) ?? 1

  let roundStatus = 'not_started'
  if (response.roundStatus === 'Complete' || response.roundStatus === 'Official') {
    roundStatus = 'complete'
  } else if (response.status === 'Official') {
    roundStatus = 'official'
  } else if (response.leaderboardRows?.length > 0) {
    roundStatus = 'in_progress'
  }

  let cutLine: number | undefined
  if (response.cutLines?.[0]?.cutScore) {
    cutLine = parseToPar(response.cutLines[0].cutScore)
  }

  const leaderboard: GolfLeaderboardEntry[] = (response.leaderboardRows || []).map((entry) => {
    const rounds: GolfLeaderboardEntry['rounds'] = {}

    for (const round of entry.rounds || []) {
      const roundNum = parseMongoNumber(round.roundId)
      const strokes = parseMongoNumber(round.strokes)
      if (roundNum && strokes !== undefined) {
        switch (roundNum) {
          case 1: rounds.round1 = strokes; break
          case 2: rounds.round2 = strokes; break
          case 3: rounds.round3 = strokes; break
          case 4: rounds.round4 = strokes; break
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

export async function fetchGolfTournamentState(
  apiKey: string,
  tournId: string,
  year: number
): Promise<{ payload: GolfTournamentPayload; status: EventStatus }> {
  const response = await fetchGolfLeaderboard(apiKey, tournId, year)
  const payload = normalizeLeaderboard(response)
  const status = getGolfEventStatus(payload)
  return { payload, status }
}
