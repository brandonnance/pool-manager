import {
  SlashGolfScheduleResponse,
  SlashGolfTournamentResponse,
  SlashGolfLeaderboardResponse,
  SlashGolfRankingsResponse,
  SlashGolfPlayerResponse,
  GolfTournament,
  GolfPlayer,
  GolfPlayerScore,
  parseMongoDate,
  parseMongoNumber,
} from './types'

const RAPIDAPI_HOST = 'live-golf-data.p.rapidapi.com'
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

export class SlashGolfClient {
  private apiKey: string
  private host: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || RAPIDAPI_KEY || ''
    this.host = RAPIDAPI_HOST

    if (!this.apiKey) {
      console.warn('RapidAPI key not configured for Slash Golf API')
    }
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('RapidAPI key not configured. Add RAPIDAPI_KEY to your .env.local file.')
    }

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
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      const errorText = await response.text()

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.')
      }

      if (response.status === 403) {
        throw new Error('API key invalid or subscription required.')
      }

      if (response.status === 404) {
        throw new Error('Resource not found.')
      }

      throw new Error(`Slash Golf API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  // Get schedule for a year (orgId: 1 = PGA Tour, 2 = LIV)
  async getSchedule(year: number, orgId: string = '1'): Promise<SlashGolfScheduleResponse> {
    return this.fetch<SlashGolfScheduleResponse>('/schedule', {
      orgId,
      year: String(year),
    })
  }

  // Get tournaments normalized for our app
  async getTournaments(year: number): Promise<GolfTournament[]> {
    const schedule = await this.getSchedule(year)

    return schedule.schedule.map(t => {
      const course = t.courses?.[0]
      const startDateStr = parseMongoDate(t.date.start)
      const endDateStr = parseMongoDate(t.date.end)
      const startDate = startDateStr ? new Date(startDateStr) : new Date()
      const endDate = endDateStr ? new Date(endDateStr) : new Date()
      const now = new Date()

      let status: 'upcoming' | 'in_progress' | 'completed' = 'upcoming'
      if (endDate < now) {
        status = 'completed'
      } else if (startDate <= now && endDate >= now) {
        status = 'in_progress'
      }

      return {
        id: t.tournId,
        name: t.name,
        startDate: startDateStr || '',
        endDate: endDateStr || '',
        venue: course?.courseName,
        courseName: course?.courseName,
        city: course?.location?.city,
        state: course?.location?.state,
        country: course?.location?.country,
        par: course?.par,
        purse: parseMongoNumber(t.purse),
        status,
      }
    })
  }

  // Get tournament field (entry list)
  async getTournamentField(tournId: string, year: number): Promise<SlashGolfTournamentResponse> {
    return this.fetch<SlashGolfTournamentResponse>('/tournament', {
      tournId,
      year: String(year),
    })
  }

  // Get players in a tournament normalized for our app
  async getPlayers(tournId: string, year: number): Promise<GolfPlayer[]> {
    const tournament = await this.getTournamentField(tournId, year)

    if (!tournament.players || tournament.players.length === 0) {
      return []
    }

    return tournament.players.map(p => ({
      id: p.playerId,
      firstName: p.firstName,
      lastName: p.lastName,
      fullName: `${p.firstName} ${p.lastName}`,
      country: '', // Country not available in tournament field response
    }))
  }

  // Get leaderboard for a tournament
  async getLeaderboard(tournId: string, year: number, roundId?: number): Promise<SlashGolfLeaderboardResponse> {
    const params: Record<string, string> = {
      tournId,
      year: String(year),
    }
    if (roundId) {
      params.roundId = String(roundId)
    }
    return this.fetch<SlashGolfLeaderboardResponse>('/leaderboard', params)
  }

  // Get scores normalized for our app
  async getScores(tournId: string, year: number): Promise<GolfPlayerScore[]> {
    const leaderboard = await this.getLeaderboard(tournId, year)

    return leaderboard.leaderboard.map(p => {
      const rounds = p.rounds || []
      const r1 = rounds.find(r => r.roundId === 1)
      const r2 = rounds.find(r => r.roundId === 2)
      const r3 = rounds.find(r => r.roundId === 3)
      const r4 = rounds.find(r => r.roundId === 4)

      return {
        playerId: p.playerId,
        playerName: `${p.firstName} ${p.lastName}`,
        position: p.position ? String(p.position) : '-',
        tied: false, // Slash Golf doesn't provide tied flag directly
        round1: r1?.score,
        round2: r2?.score,
        round3: r3?.score,
        round4: r4?.score,
        totalStrokes: p.total,
        toPar: p.toPar,
        thru: p.thru,
        status: this.mapPlayerStatus(p.status),
      }
    })
  }

  // Get world rankings
  async getWorldRankings(year?: number): Promise<SlashGolfRankingsResponse> {
    const params: Record<string, string> = {}
    if (year) {
      params.year = String(year)
    }
    return this.fetch<SlashGolfRankingsResponse>('/stats', {
      ...params,
      statId: 'owgr', // World rankings
    })
  }

  // Get world rankings as a map of playerId -> rank
  async getWorldRankingsMap(): Promise<Map<string, number>> {
    const rankings = await this.getWorldRankings()
    return new Map(rankings.rankings.map(r => [r.playerId, r.rank]))
  }

  // Search for a player
  async searchPlayer(lastName?: string, firstName?: string, playerId?: string): Promise<SlashGolfPlayerResponse> {
    const params: Record<string, string> = {}
    if (lastName) params.lastName = lastName
    if (firstName) params.firstName = firstName
    if (playerId) params.playerId = playerId
    return this.fetch<SlashGolfPlayerResponse>('/players', params)
  }

  private mapPlayerStatus(status?: string): 'active' | 'cut' | 'withdrawn' | 'disqualified' {
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
}

// Singleton instance for server-side use
let clientInstance: SlashGolfClient | null = null

export function getSlashGolfClient(): SlashGolfClient {
  if (!clientInstance) {
    clientInstance = new SlashGolfClient()
  }
  return clientInstance
}
