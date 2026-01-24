/**
 * @fileoverview ESPN Provider for Edge Functions
 */

import type { TeamGamePayload, Sport, EventStatus } from '../types.ts'

// ESPN API response types
interface ESPNTeam {
  id: string
  abbreviation: string
  displayName: string
}

interface ESPNCompetitor {
  homeAway: 'home' | 'away'
  team: ESPNTeam
  score: string
  linescores?: Array<{ value: number; period: number }>
}

interface ESPNStatus {
  clock: number
  displayClock: string
  period: number
  type: {
    id: string
    name: string
    description: string
  }
}

interface ESPNCompetition {
  id: string
  competitors: ESPNCompetitor[]
  status: ESPNStatus
}

interface ESPNEvent {
  id: string
  name: string
  competitions: ESPNCompetition[]
}

interface ESPNScoreboardResponse {
  events: ESPNEvent[]
}

// ESPN API endpoints by sport
const ESPN_ENDPOINTS: Record<Sport, string> = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  ncaa_fb: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  ncaa_bb: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  pga: '', // Golf uses SlashGolf
}

const SEASON_TYPE_PARAMS: Record<Sport, string> = {
  nfl: 'seasontype=3', // Playoffs
  ncaa_fb: '',
  ncaa_bb: '',
  pga: '',
}

export interface ESPNGameData {
  espnGameId: string
  homeScore: number | null
  awayScore: number | null
  homeTeam: string
  awayTeam: string
  status: EventStatus
  period: number
  clock: string
  isHalftime: boolean
  halftimeHomeScore: number | null
  halftimeAwayScore: number | null
  q1HomeScore: number | null
  q1AwayScore: number | null
  q3HomeScore: number | null
  q3AwayScore: number | null
}

function mapESPNStatus(espnStatus: string): EventStatus {
  if (espnStatus === 'STATUS_IN_PROGRESS' || espnStatus === 'STATUS_HALFTIME') {
    return 'in_progress'
  }
  if (espnStatus === 'STATUS_FINAL' || espnStatus === 'STATUS_FINAL_OVERTIME') {
    return 'final'
  }
  if (espnStatus === 'STATUS_CANCELED' || espnStatus === 'STATUS_POSTPONED') {
    return 'cancelled'
  }
  return 'scheduled'
}

export async function fetchESPNScoreboard(sport: Sport): Promise<ESPNScoreboardResponse> {
  const endpoint = ESPN_ENDPOINTS[sport]
  if (!endpoint) {
    throw new Error(`ESPN not supported for sport: ${sport}`)
  }

  const seasonParam = SEASON_TYPE_PARAMS[sport]
  const url = seasonParam ? `${endpoint}?${seasonParam}` : endpoint

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function fetchESPNGame(sport: Sport, espnGameId: string): Promise<ESPNGameData | null> {
  const data = await fetchESPNScoreboard(sport)
  const event = data.events?.find((e) => e.id === espnGameId)
  if (!event) {
    return null
  }
  return normalizeESPNEvent(event)
}

export function normalizeESPNEvent(event: ESPNEvent): ESPNGameData {
  const competition = event.competitions[0]
  const homeCompetitor = competition.competitors.find((c) => c.homeAway === 'home')
  const awayCompetitor = competition.competitors.find((c) => c.homeAway === 'away')

  if (!homeCompetitor || !awayCompetitor) {
    throw new Error('Could not identify home/away teams')
  }

  const homeScore = homeCompetitor.score ? parseInt(homeCompetitor.score, 10) : null
  const awayScore = awayCompetitor.score ? parseInt(awayCompetitor.score, 10) : null

  const espnStatus = competition.status.type.name
  const status = mapESPNStatus(espnStatus)
  const isHalftime = espnStatus === 'STATUS_HALFTIME' || competition.status.period === 2

  const homeLinescores = homeCompetitor.linescores || []
  const awayLinescores = awayCompetitor.linescores || []

  const q1HomeScore = homeLinescores.find((l) => l.period === 1)?.value ?? null
  const q1AwayScore = awayLinescores.find((l) => l.period === 1)?.value ?? null

  let halftimeHomeScore: number | null = null
  let halftimeAwayScore: number | null = null

  if (competition.status.period >= 2 || status === 'final') {
    const q2Home = homeLinescores.find((l) => l.period === 2)?.value ?? 0
    const q2Away = awayLinescores.find((l) => l.period === 2)?.value ?? 0
    halftimeHomeScore = (q1HomeScore ?? 0) + q2Home
    halftimeAwayScore = (q1AwayScore ?? 0) + q2Away
  }

  let q3HomeScore: number | null = null
  let q3AwayScore: number | null = null

  if (competition.status.period >= 3 || status === 'final') {
    const q3Home = homeLinescores.find((l) => l.period === 3)?.value ?? 0
    const q3Away = awayLinescores.find((l) => l.period === 3)?.value ?? 0
    q3HomeScore = (halftimeHomeScore ?? 0) + q3Home
    q3AwayScore = (halftimeAwayScore ?? 0) + q3Away
  }

  return {
    espnGameId: event.id,
    homeScore,
    awayScore,
    homeTeam: homeCompetitor.team.displayName,
    awayTeam: awayCompetitor.team.displayName,
    status,
    period: competition.status.period,
    clock: competition.status.displayClock,
    isHalftime,
    halftimeHomeScore,
    halftimeAwayScore,
    q1HomeScore,
    q1AwayScore,
    q3HomeScore,
    q3AwayScore,
  }
}

export function toTeamGamePayload(gameData: ESPNGameData): TeamGamePayload {
  const payload: TeamGamePayload = {
    home_score: gameData.homeScore ?? 0,
    away_score: gameData.awayScore ?? 0,
    home_team: gameData.homeTeam,
    away_team: gameData.awayTeam,
    period: gameData.period,
    clock: gameData.clock,
    is_halftime: gameData.isHalftime,
  }

  if (gameData.q1HomeScore !== null || gameData.halftimeHomeScore !== null || gameData.q3HomeScore !== null) {
    payload.quarter_scores = {}

    if (gameData.q1HomeScore !== null && gameData.q1AwayScore !== null) {
      payload.quarter_scores.q1 = { home: gameData.q1HomeScore, away: gameData.q1AwayScore }
    }

    if (gameData.halftimeHomeScore !== null && gameData.halftimeAwayScore !== null) {
      payload.quarter_scores.q2 = { home: gameData.halftimeHomeScore, away: gameData.halftimeAwayScore }
    }

    if (gameData.q3HomeScore !== null && gameData.q3AwayScore !== null) {
      payload.quarter_scores.q3 = { home: gameData.q3HomeScore, away: gameData.q3AwayScore }
    }

    if (gameData.status === 'final' && gameData.homeScore !== null && gameData.awayScore !== null) {
      payload.quarter_scores.q4 = { home: gameData.homeScore, away: gameData.awayScore }
    }
  }

  return payload
}
