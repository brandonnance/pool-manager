// Sportradar Golf API Response Types

export interface SportradarTournament {
  id: string
  name: string
  start_date: string
  end_date: string
  course?: {
    id: string
    name: string
  }
  venue?: {
    id: string
    name: string
    city: string
    state?: string
    country: string
  }
  status: 'scheduled' | 'inprogress' | 'closed' | 'cancelled'
  purse?: number
  winning_share?: number
  currency?: string
  points_label?: string
  event_type?: string
  parent_id?: string
}

export interface SportradarScheduleResponse {
  tournaments: SportradarTournament[]
}

export interface SportradarPlayer {
  id: string
  first_name: string
  last_name: string
  country: string
  abbr_name?: string
  birthday?: string
  height?: number
  weight?: number
  turned_pro?: number
  college?: string
  handedness?: 'R' | 'L'
}

export interface SportradarPlayerProfile extends SportradarPlayer {
  headshot?: string
  rankings?: {
    source: string
    position: number
  }[]
  statistics?: Record<string, unknown>
}

export interface SportradarFieldPlayer {
  id: string
  first_name: string
  last_name: string
  country: string
  abbr_name?: string
  status?: 'active' | 'withdrawn' | 'cut' | 'disqualified'
}

export interface SportradarTournamentField {
  tournament: {
    id: string
    name: string
    start_date: string
    end_date: string
    status: string
  }
  field: SportradarFieldPlayer[]
}

export interface SportradarRoundScore {
  sequence: number
  strokes: number
  thru?: number
  eagles?: number
  birdies?: number
  pars?: number
  bogeys?: number
  double_bogeys?: number
  other_scores?: number
  holes_in_one?: number
}

export interface SportradarLeaderboardPlayer {
  id: string
  first_name: string
  last_name: string
  country: string
  abbr_name?: string
  position: number
  tied?: boolean
  money?: number
  points?: number
  score?: number
  strokes?: number
  status?: 'active' | 'cut' | 'withdrawn' | 'disqualified'
  rounds?: SportradarRoundScore[]
}

export interface SportradarLeaderboardResponse {
  tournament: {
    id: string
    name: string
    start_date: string
    end_date: string
    status: 'scheduled' | 'inprogress' | 'closed' | 'cancelled'
  }
  leaderboard: SportradarLeaderboardPlayer[]
  round?: number
  current_round?: number
}

// Simplified types for our use
export interface GolfTournament {
  sportradarId: string
  name: string
  startDate: string
  endDate: string
  venueName?: string
  courseName?: string
  status: 'upcoming' | 'in_progress' | 'completed'
}

export interface GolfPlayer {
  sportradarId: string
  firstName: string
  lastName: string
  fullName: string
  country: string
  headshotUrl?: string
  owgrRank?: number
}

export interface GolfPlayerScore {
  playerId: string
  playerName: string
  position: string
  tied: boolean
  round1?: number
  round2?: number
  round3?: number
  round4?: number
  totalStrokes?: number
  toPar?: number
  thru?: number
  status: 'active' | 'cut' | 'withdrawn' | 'disqualified'
}

// Major tournaments we care about
export const MAJOR_TOURNAMENTS = [
  'The Masters',
  'PGA Championship', 
  'U.S. Open',
  'The Open Championship',
  'The Open',
] as const

export type MajorTournament = typeof MAJOR_TOURNAMENTS[number]

export function isMajorTournament(name: string): boolean {
  const normalizedName = name.toLowerCase()
  return MAJOR_TOURNAMENTS.some(major => 
    normalizedName.includes(major.toLowerCase()) ||
    (major === 'The Open Championship' && normalizedName.includes('the open'))
  )
}
