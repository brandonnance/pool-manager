// Golf scoring calculations

import { GolferEntryScore, EntryStanding } from './types'

const MISSED_CUT_PENALTY = 80

/**
 * Calculate a golfer's total score for the tournament
 * If missed cut, R3 and R4 are treated as +80 each
 */
export function calculateGolferScore(
  round1: number | null | undefined,
  round2: number | null | undefined,
  round3: number | null | undefined,
  round4: number | null | undefined,
  madeCut: boolean
): number {
  const r1 = round1 ?? 0
  const r2 = round2 ?? 0

  if (!madeCut) {
    // Missed cut: R1 + R2 + 80 + 80
    return r1 + r2 + MISSED_CUT_PENALTY + MISSED_CUT_PENALTY
  }

  const r3 = round3 ?? 0
  const r4 = round4 ?? 0
  return r1 + r2 + r3 + r4
}

/**
 * Calculate an entry's score using "best 4 of 6" scoring
 * Returns the sum of the 4 lowest golfer scores
 */
export function calculateEntryScore(golferScores: GolferEntryScore[]): {
  totalScore: number
  countedGolfers: GolferEntryScore[]
  droppedGolfers: GolferEntryScore[]
} {
  if (golferScores.length === 0) {
    return { totalScore: 0, countedGolfers: [], droppedGolfers: [] }
  }

  // Sort by total score (ascending - lowest first)
  const sorted = [...golferScores].sort((a, b) => a.totalScore - b.totalScore)

  // Best 4 count, worst 2 are dropped
  const countedGolfers = sorted.slice(0, 4).map(g => ({ ...g, counted: true }))
  const droppedGolfers = sorted.slice(4).map(g => ({ ...g, counted: false }))

  const totalScore = countedGolfers.reduce((sum, g) => sum + g.totalScore, 0)

  return { totalScore, countedGolfers, droppedGolfers }
}

/**
 * Format a score relative to par
 * e.g., 280 with par 288 = "-8"
 */
export function formatScoreToPar(score: number, par: number = 288): string {
  const diff = score - par
  if (diff === 0) return 'E'
  if (diff > 0) return `+${diff}`
  return String(diff)
}

/**
 * Format a single round score
 */
export function formatRoundScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '-'
  return String(score)
}

/**
 * Calculate standings from entries
 */
export function calculateStandings(entries: EntryStanding[]): EntryStanding[] {
  // Sort by score (ascending - lowest first)
  const sorted = [...entries].sort((a, b) => {
    // Handle null scores (no picks yet)
    if (a.score === null && b.score === null) return 0
    if (a.score === null) return 1
    if (b.score === null) return -1
    return a.score - b.score
  })

  // Assign ranks with tie handling
  let currentRank = 1
  let previousScore: number | null = null

  return sorted.map((entry, index) => {
    // Check for tie
    const tied = previousScore !== null && entry.score === previousScore

    if (!tied) {
      currentRank = index + 1
    }

    previousScore = entry.score

    return {
      ...entry,
      rank: currentRank,
      tied,
    }
  })
}

/**
 * Check if picks are locked based on lock time
 */
export function arePicksLocked(
  picksLockAt: string | null | undefined,
  demoMode: boolean = false
): boolean {
  // Demo mode bypasses lock
  if (demoMode) return false

  // No lock time set
  if (!picksLockAt) return false

  const lockTime = new Date(picksLockAt)
  const now = new Date()

  return now >= lockTime
}

/**
 * Calculate time until picks lock
 */
export function getTimeUntilLock(picksLockAt: string | null | undefined): {
  locked: boolean
  timeString: string | null
  urgency: 'none' | 'warning' | 'danger'
} {
  if (!picksLockAt) {
    return { locked: false, timeString: null, urgency: 'none' }
  }

  const lockTime = new Date(picksLockAt)
  const now = new Date()
  const diff = lockTime.getTime() - now.getTime()

  if (diff <= 0) {
    return { locked: true, timeString: 'Locked', urgency: 'danger' }
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  let timeString: string
  let urgency: 'none' | 'warning' | 'danger'

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    timeString = `${days} day${days !== 1 ? 's' : ''}`
    urgency = 'none'
  } else if (hours > 0) {
    timeString = `${hours}h ${minutes}m`
    urgency = hours < 2 ? 'warning' : 'none'
  } else {
    timeString = `${minutes}m`
    urgency = 'danger'
  }

  return { locked: false, timeString, urgency }
}
