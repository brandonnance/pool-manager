// Golf Pool Types

export interface GolferWithTier {
  id: string
  name: string
  country: string | null
  headshotUrl?: string | null
  owgrRank?: number | null
  tier: number
}

export interface GolferResult {
  golferId: string
  golferName: string
  tier: number
  round1?: number | null
  round2?: number | null
  round3?: number | null
  round4?: number | null
  totalScore: number
  madeCut: boolean
  position?: string | null
}

export interface EntryPick {
  golferId: string
  golferName: string
  tier: number
}

export interface EntryWithPicks {
  id: string
  entryName: string | null
  entryNumber: number | null
  userId: string
  userName: string | null
  createdBy?: string | null
  submittedAt?: string | null
  picks: EntryPick[]
  totalTierPoints: number
}

export interface EntryStanding {
  entryId: string
  entryName: string | null
  userName: string | null
  userId: string
  rank: number
  tied: boolean
  score: number | null
  golferScores: GolferEntryScore[]
}

export interface GolferEntryScore {
  golferId: string
  golferName: string
  tier: number
  round1?: number | null
  round2?: number | null
  round3?: number | null
  round4?: number | null
  totalScore: number
  madeCut: boolean
  counted: boolean // Whether this golfer counts towards best 4
}

export interface TournamentInfo {
  id: string
  name: string
  startDate: string
  endDate: string
  venue?: string | null
  courseName?: string | null
  status: 'upcoming' | 'in_progress' | 'completed'
}

export interface GolfPoolConfig {
  id: string
  poolId: string
  tournamentId?: string | null
  minTierPoints: number
  picksLockAt?: string | null
  demoMode: boolean
}

// Tier display info
export const TIER_INFO: Record<number, { label: string; points: number; color: string }> = {
  0: { label: 'Elite', points: 0, color: 'bg-purple-500' },
  1: { label: 'Tier 1', points: 1, color: 'bg-blue-500' },
  2: { label: 'Tier 2', points: 2, color: 'bg-green-500' },
  3: { label: 'Tier 3', points: 3, color: 'bg-yellow-500' },
  4: { label: 'Tier 4', points: 4, color: 'bg-orange-500' },
  5: { label: 'Tier 5', points: 5, color: 'bg-red-400' },
  6: { label: 'Tier 6', points: 6, color: 'bg-red-600' },
}

export function getTierColor(tier: number): string {
  return TIER_INFO[tier]?.color ?? 'bg-gray-500'
}

export function getTierLabel(tier: number): string {
  return TIER_INFO[tier]?.label ?? `Tier ${tier}`
}

export function getTierPoints(tier: number): number {
  return TIER_INFO[tier]?.points ?? tier
}
