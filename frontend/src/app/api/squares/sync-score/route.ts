/**
 * @fileoverview NFL Squares Live Score Sync API Route
 * @route GET /api/squares/sync-score?gameId=xxx
 * @auth Requires commissioner role or super admin
 *
 * @description
 * Fetches live score data from ESPN API for a specific NFL game and returns
 * the current score and status. This is called by the client-side polling
 * mechanism to update scores in real-time.
 *
 * The client is responsible for updating the database with the returned scores.
 * This keeps the API route simple and stateless.
 *
 * @features
 * - Fetches current score from ESPN hidden API
 * - Returns home/away scores, game status, and quarter info
 * - Handles halftime detection for halftime winners
 * - No database writes - client handles updates
 */
import { NextRequest, NextResponse } from 'next/server'

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

// Response type for our API
export interface SyncScoreResponse {
  success: boolean
  espnGameId: string
  homeScore: number | null
  awayScore: number | null
  homeTeam: string
  awayTeam: string
  status: 'scheduled' | 'in_progress' | 'final'
  period: number
  clock: string
  isHalftime: boolean
  halftimeHomeScore: number | null
  halftimeAwayScore: number | null
  q1HomeScore: number | null
  q1AwayScore: number | null
  q3HomeScore: number | null
  q3AwayScore: number | null
  lastUpdated: string
}

/**
 * GET handler for fetching live NFL scores from ESPN
 *
 * @param request - Next.js request with gameId query param (ESPN game ID)
 * @returns JSON response with current score data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const espnGameId = searchParams.get('espnGameId')

    if (!espnGameId) {
      return NextResponse.json(
        { error: 'Missing espnGameId parameter' },
        { status: 400 }
      )
    }

    // Fetch the NFL scoreboard from ESPN
    // Using seasontype=3 for playoffs
    const espnUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=3'

    const espnResponse = await fetch(espnUrl, {
      headers: {
        'Accept': 'application/json',
      },
      // Don't cache - we want fresh data
      cache: 'no-store',
    })

    if (!espnResponse.ok) {
      console.error('ESPN API error:', espnResponse.status, espnResponse.statusText)
      return NextResponse.json(
        { error: 'Failed to fetch from ESPN API' },
        { status: 502 }
      )
    }

    const data: ESPNScoreboardResponse = await espnResponse.json()

    // Find the specific game by ID
    const event = data.events?.find((e) => e.id === espnGameId)

    if (!event) {
      return NextResponse.json(
        { error: `Game ${espnGameId} not found in ESPN data` },
        { status: 404 }
      )
    }

    const competition = event.competitions[0]
    const homeCompetitor = competition.competitors.find((c) => c.homeAway === 'home')
    const awayCompetitor = competition.competitors.find((c) => c.homeAway === 'away')

    if (!homeCompetitor || !awayCompetitor) {
      return NextResponse.json(
        { error: 'Could not identify home/away teams' },
        { status: 500 }
      )
    }

    // Parse scores
    const homeScore = homeCompetitor.score ? parseInt(homeCompetitor.score, 10) : null
    const awayScore = awayCompetitor.score ? parseInt(awayCompetitor.score, 10) : null

    // Parse status
    const espnStatus = competition.status.type.name
    let status: 'scheduled' | 'in_progress' | 'final' = 'scheduled'
    if (espnStatus === 'STATUS_IN_PROGRESS' || espnStatus === 'STATUS_HALFTIME') {
      status = 'in_progress'
    } else if (espnStatus === 'STATUS_FINAL' || espnStatus === 'STATUS_FINAL_OVERTIME') {
      status = 'final'
    }

    // Check if halftime
    const isHalftime = espnStatus === 'STATUS_HALFTIME' || competition.status.period === 2

    // Extract quarter scores from linescores
    const homeLinescores = homeCompetitor.linescores || []
    const awayLinescores = awayCompetitor.linescores || []

    // Q1 scores (period 1)
    const q1HomeScore = homeLinescores.find((l) => l.period === 1)?.value ?? null
    const q1AwayScore = awayLinescores.find((l) => l.period === 1)?.value ?? null

    // Halftime scores (sum of Q1 + Q2)
    let halftimeHomeScore: number | null = null
    let halftimeAwayScore: number | null = null

    if (competition.status.period >= 2 || status === 'final') {
      const q2Home = homeLinescores.find((l) => l.period === 2)?.value ?? 0
      const q2Away = awayLinescores.find((l) => l.period === 2)?.value ?? 0
      halftimeHomeScore = (q1HomeScore ?? 0) + q2Home
      halftimeAwayScore = (q1AwayScore ?? 0) + q2Away
    }

    // Q3 scores (sum of Q1 + Q2 + Q3)
    let q3HomeScore: number | null = null
    let q3AwayScore: number | null = null

    if (competition.status.period >= 3 || status === 'final') {
      const q3Home = homeLinescores.find((l) => l.period === 3)?.value ?? 0
      const q3Away = awayLinescores.find((l) => l.period === 3)?.value ?? 0
      q3HomeScore = (halftimeHomeScore ?? 0) + q3Home
      q3AwayScore = (halftimeAwayScore ?? 0) + q3Away
    }

    const response: SyncScoreResponse = {
      success: true,
      espnGameId,
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
      lastUpdated: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Sync score error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
