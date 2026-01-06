import {
  SportradarScheduleResponse,
  SportradarTournamentField,
  SportradarLeaderboardResponse,
  SportradarPlayerProfile,
  GolfTournament,
  GolfPlayer,
  GolfPlayerScore,
  isMajorTournament,
} from './types'

const SPORTRADAR_BASE_URL = process.env.SPORTRADAR_BASE_URL || 'https://api.sportradar.com/golf/production/pga/v3/en'
const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY

export class SportradarClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || SPORTRADAR_API_KEY || ''
    this.baseUrl = baseUrl || SPORTRADAR_BASE_URL

    if (!this.apiKey) {
      console.warn('Sportradar API key not configured')
    }
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Sportradar API key not configured')
    }

    const url = `${this.baseUrl}${endpoint}?api_key=${this.apiKey}`
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Sportradar API error: ${response.status} - ${errorText}`)
    }

    return response.json()
  }

  async getSchedule(year: number): Promise<SportradarScheduleResponse> {
    return this.fetch<SportradarScheduleResponse>(`/tournaments/${year}/schedule.json`)
  }

  async getMajorTournaments(year: number): Promise<GolfTournament[]> {
    const schedule = await this.getSchedule(year)
    
    return schedule.tournaments
      .filter(t => isMajorTournament(t.name))
      .map(t => ({
        sportradarId: t.id,
        name: t.name,
        startDate: t.start_date,
        endDate: t.end_date,
        venueName: t.venue?.name,
        courseName: t.course?.name,
        status: this.mapStatus(t.status),
      }))
  }

  async getTournamentField(tournamentId: string): Promise<SportradarTournamentField> {
    return this.fetch<SportradarTournamentField>(`/tournaments/${tournamentId}/field.json`)
  }

  async getPlayers(tournamentId: string): Promise<GolfPlayer[]> {
    const field = await this.getTournamentField(tournamentId)
    
    return field.field.map(p => ({
      sportradarId: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      fullName: `${p.first_name} ${p.last_name}`,
      country: p.country,
    }))
  }

  async getLeaderboard(tournamentId: string): Promise<SportradarLeaderboardResponse> {
    return this.fetch<SportradarLeaderboardResponse>(`/tournaments/${tournamentId}/leaderboard.json`)
  }

  async getScores(tournamentId: string): Promise<GolfPlayerScore[]> {
    const leaderboard = await this.getLeaderboard(tournamentId)
    
    return leaderboard.leaderboard.map(p => {
      const rounds = p.rounds || []
      const r1 = rounds.find(r => r.sequence === 1)
      const r2 = rounds.find(r => r.sequence === 2)
      const r3 = rounds.find(r => r.sequence === 3)
      const r4 = rounds.find(r => r.sequence === 4)
      
      return {
        playerId: p.id,
        playerName: `${p.first_name} ${p.last_name}`,
        position: p.tied ? `T${p.position}` : String(p.position),
        tied: p.tied || false,
        round1: r1?.strokes,
        round2: r2?.strokes,
        round3: r3?.strokes,
        round4: r4?.strokes,
        totalStrokes: p.strokes,
        toPar: p.score,
        thru: rounds[rounds.length - 1]?.thru,
        status: this.mapPlayerStatus(p.status),
      }
    })
  }

  async getPlayerProfile(playerId: string): Promise<SportradarPlayerProfile> {
    return this.fetch<SportradarPlayerProfile>(`/players/${playerId}/profile.json`)
  }

  async getPlayerHeadshot(playerId: string): Promise<string | null> {
    try {
      const profile = await this.getPlayerProfile(playerId)
      return profile.headshot || null
    } catch {
      return null
    }
  }

  private mapStatus(status: string): 'upcoming' | 'in_progress' | 'completed' {
    switch (status) {
      case 'scheduled':
        return 'upcoming'
      case 'inprogress':
        return 'in_progress'
      case 'closed':
      case 'cancelled':
        return 'completed'
      default:
        return 'upcoming'
    }
  }

  private mapPlayerStatus(status?: string): 'active' | 'cut' | 'withdrawn' | 'disqualified' {
    switch (status) {
      case 'cut':
        return 'cut'
      case 'withdrawn':
        return 'withdrawn'
      case 'disqualified':
        return 'disqualified'
      default:
        return 'active'
    }
  }
}

// Singleton instance for server-side use
let clientInstance: SportradarClient | null = null

export function getSportradarClient(): SportradarClient {
  if (!clientInstance) {
    clientInstance = new SportradarClient()
  }
  return clientInstance
}
