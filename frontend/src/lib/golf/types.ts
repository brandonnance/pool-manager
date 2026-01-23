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
  toPar?: number // Live score relative to par
  thru?: number | null // Holes completed in current round
  position?: string | null // Tournament position (e.g., "1", "T2")
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

// Tier display info (Tier = Points, lower tier = better player = fewer points)
// OWGR ranges: T1=1-15, T2=16-40, T3=41-75, T4=76-125, T5=126-200, T6=200+
// Tier 0 (Elite) is manually assigned by commissioner for exceptional players
export const TIER_INFO: Record<number, { label: string; points: number; color: string; owgrRange: string }> = {
  0: { label: 'Elite', points: 0, color: 'bg-amber-500', owgrRange: 'Manual' },
  1: { label: 'Tier 1', points: 1, color: 'bg-purple-600', owgrRange: '1-15' },
  2: { label: 'Tier 2', points: 2, color: 'bg-blue-600', owgrRange: '16-40' },
  3: { label: 'Tier 3', points: 3, color: 'bg-green-600', owgrRange: '41-75' },
  4: { label: 'Tier 4', points: 4, color: 'bg-yellow-600', owgrRange: '76-125' },
  5: { label: 'Tier 5', points: 5, color: 'bg-orange-600', owgrRange: '126-200' },
  6: { label: 'Tier 6', points: 6, color: 'bg-red-600', owgrRange: '200+' },
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

// Golf Pool Status - derived from configuration state
export type GolfPoolStatus = 'draft' | 'open' | 'in_progress' | 'completed'

export interface GolfPoolStatusInfo {
  status: GolfPoolStatus
  label: string
  description: string
  variant: 'outline' | 'default' | 'secondary' | 'destructive'
  className?: string
}

/**
 * Derive the golf pool status from configuration state
 * Status is computed, not stored, to always reflect reality
 *
 * @param publicEntriesEnabled - Whether public entries are enabled
 * @param picksLockAt - When picks lock (ISO timestamp or null)
 * @param tournamentStatus - Tournament status from gp_tournaments
 * @param tournamentId - Whether a tournament is linked
 */
export function getGolfPoolStatus(
  publicEntriesEnabled: boolean,
  picksLockAt: string | null,
  tournamentStatus: 'upcoming' | 'in_progress' | 'completed' | null,
  tournamentId: string | null
): GolfPoolStatusInfo {
  // No tournament configured = draft
  if (!tournamentId) {
    return {
      status: 'draft',
      label: 'Draft',
      description: 'Tournament not configured',
      variant: 'outline',
      className: 'border-amber-500 text-amber-600',
    }
  }

  // Tournament completed = completed
  if (tournamentStatus === 'completed') {
    return {
      status: 'completed',
      label: 'Completed',
      description: 'Tournament has ended',
      variant: 'secondary',
    }
  }

  // Check if picks are locked (past lock time)
  const now = new Date()
  const lockTime = picksLockAt ? new Date(picksLockAt) : null
  const isLocked = lockTime ? now >= lockTime : false

  // Past lock time = in progress
  if (isLocked) {
    return {
      status: 'in_progress',
      label: 'In Progress',
      description: 'Picks locked, tournament underway',
      variant: 'default',
      className: 'bg-blue-600',
    }
  }

  // Public entries enabled = open for entries
  if (publicEntriesEnabled) {
    return {
      status: 'open',
      label: 'Accepting Entries',
      description: 'Public entries are open',
      variant: 'default',
      className: 'bg-green-600',
    }
  }

  // Tournament configured but not accepting entries yet = draft
  return {
    status: 'draft',
    label: 'Draft',
    description: 'Pool not yet open for entries',
    variant: 'outline',
    className: 'border-amber-500 text-amber-600',
  }
}
