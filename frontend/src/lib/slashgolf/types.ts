// Slash Golf API Types
// API hosted on RapidAPI: https://rapidapi.com/slashgolf/api/live-golf-data

// Organization response
export interface SlashGolfOrganization {
  orgId: string
  name: string
}

// MongoDB Extended JSON number
interface MongoNumber {
  $numberInt?: string
  $numberLong?: string
}

// MongoDB Extended JSON date
interface MongoDate {
  $date: {
    $numberLong: string
  }
}

// Schedule response
export interface SlashGolfScheduleResponse {
  orgId: string
  year: string
  schedule: SlashGolfTournamentRaw[]
}

export interface SlashGolfTournamentRaw {
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
  courses?: SlashGolfCourse[]
}

export interface SlashGolfCourse {
  courseId: string
  courseName: string
  location?: {
    city: string
    state: string
    country: string
  }
  par?: number
  yardage?: number
}

// Helper to parse MongoDB numbers
export function parseMongoNumber(val: MongoNumber | number | undefined): number | undefined {
  if (val === undefined) return undefined
  if (typeof val === 'number') return val
  if (val.$numberInt) return parseInt(val.$numberInt)
  if (val.$numberLong) return parseInt(val.$numberLong)
  return undefined
}

// Helper to parse MongoDB dates
export function parseMongoDate(val: MongoDate | string | undefined): string | undefined {
  if (val === undefined) return undefined
  if (typeof val === 'string') return val
  if (val.$date?.$numberLong) {
    return new Date(parseInt(val.$date.$numberLong)).toISOString().split('T')[0]
  }
  return undefined
}

// Tournament/Field response
export interface SlashGolfTournamentResponse {
  tournId: string
  name: string
  date: {
    start: string
    end: string
    year: number
  }
  courses: SlashGolfCourse[]
  players: SlashGolfTournamentPlayer[]
}

export interface SlashGolfTournamentPlayer {
  playerId: string
  firstName: string
  lastName: string
  isAmateur?: boolean
  status?: string
  courseId?: string
}

// Leaderboard response
export interface SlashGolfLeaderboardResponse {
  orgId: string
  year: string
  tournId: string
  status: string // "Official", "In Progress", etc.
  roundId: MongoNumber
  roundStatus: string
  cutLines?: Array<{ cutCount: MongoNumber; cutScore: string }>
  leaderboardRows: SlashGolfLeaderboardEntry[]
}

export interface SlashGolfLeaderboardEntry {
  playerId: string
  firstName: string
  lastName: string
  isAmateur?: boolean
  courseId?: string
  status: string // "complete", "active", "cut", "wd", "dq"
  position: string // "1", "T2", etc.
  total: string // To par, e.g., "-16", "E", "+5"
  totalStrokesFromCompletedRounds?: string
  currentRoundScore?: string
  currentHole?: MongoNumber
  roundComplete?: boolean
  thru: string | number // "F" for finished, or hole number
  currentRound?: MongoNumber
  rounds: SlashGolfRound[]
}

export interface SlashGolfRound {
  roundId: MongoNumber
  strokes: MongoNumber
  scoreToPar: string
  courseId?: string
  courseName?: string
}

// World Rankings response
export interface SlashGolfRankingsResponse {
  rankings: SlashGolfRanking[]
}

export interface SlashGolfRanking {
  playerId: string
  firstName: string
  lastName: string
  country: string
  rank: number
  previousRank: number
  avgPoints: number
  totalPoints: number
  eventsPlayed: number
}

// Player search response
export interface SlashGolfPlayerResponse {
  players: SlashGolfPlayer[]
}

export interface SlashGolfPlayer {
  playerId: string
  firstName: string
  lastName: string
  country: string
  birthDate?: string
  birthCity?: string
  birthState?: string
  birthCountry?: string
  heightFeet?: number
  heightInches?: number
  weight?: number
  college?: string
  turnedPro?: number
}

// Normalized types for our app
export interface GolfTournament {
  id: string
  name: string
  startDate: string
  endDate: string
  venue?: string
  courseName?: string
  city?: string
  state?: string
  country?: string
  par?: number
  purse?: number
  status: 'upcoming' | 'in_progress' | 'completed'
}

export interface GolfPlayer {
  id: string
  firstName: string
  lastName: string
  fullName: string
  country: string
  owgrRank?: number
  headshotUrl?: string
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
  toPar: number
  thru?: string | number
  status: 'active' | 'cut' | 'withdrawn' | 'disqualified'
}
