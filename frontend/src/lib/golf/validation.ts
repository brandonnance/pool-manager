// Golf pick validation

import { EntryPick, getTierPoints } from './types'

const REQUIRED_PICKS = 6

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  totalTierPoints: number
  minTierPoints: number
  picksCount: number
}

/**
 * Validate a roster of picks
 */
export function validateRoster(
  picks: EntryPick[],
  minTierPoints: number = 21
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check pick count
  const picksCount = picks.length
  if (picksCount < REQUIRED_PICKS) {
    errors.push(`Need ${REQUIRED_PICKS - picksCount} more golfer${REQUIRED_PICKS - picksCount !== 1 ? 's' : ''}`)
  } else if (picksCount > REQUIRED_PICKS) {
    errors.push(`Too many golfers selected (${picksCount}/${REQUIRED_PICKS})`)
  }

  // Check for duplicate golfers
  const golferIds = new Set<string>()
  for (const pick of picks) {
    if (golferIds.has(pick.golferId)) {
      errors.push(`Duplicate golfer: ${pick.golferName}`)
    }
    golferIds.add(pick.golferId)
  }

  // Calculate tier points
  const totalTierPoints = picks.reduce((sum, pick) => sum + getTierPoints(pick.tier), 0)

  // Check minimum tier points
  if (totalTierPoints < minTierPoints) {
    const needed = minTierPoints - totalTierPoints
    errors.push(`Need ${needed} more tier point${needed !== 1 ? 's' : ''} (${totalTierPoints}/${minTierPoints})`)
  }

  // Advisory warning if significantly over minimum
  if (totalTierPoints > minTierPoints + 3) {
    warnings.push(`You're at ${totalTierPoints} points. Consider picking a lower-tier golfer for better value.`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalTierPoints,
    minTierPoints,
    picksCount,
  }
}

/**
 * Check if a golfer can be added to the roster
 */
export function canAddGolfer(
  currentPicks: EntryPick[],
  golferId: string
): { canAdd: boolean; reason?: string } {
  // Check if already at max
  if (currentPicks.length >= REQUIRED_PICKS) {
    return { canAdd: false, reason: 'Roster is full (6 golfers)' }
  }

  // Check for duplicate
  if (currentPicks.some(p => p.golferId === golferId)) {
    return { canAdd: false, reason: 'Golfer already selected' }
  }

  return { canAdd: true }
}

/**
 * Get tier points summary for display
 */
export function getTierPointsSummary(
  picks: EntryPick[],
  minTierPoints: number = 21
): {
  current: number
  minimum: number
  status: 'below' | 'at' | 'above'
  message: string
} {
  const current = picks.reduce((sum, pick) => sum + getTierPoints(pick.tier), 0)

  let status: 'below' | 'at' | 'above'
  let message: string

  if (current < minTierPoints) {
    status = 'below'
    message = `Need ${minTierPoints - current} more point${minTierPoints - current !== 1 ? 's' : ''}`
  } else if (current === minTierPoints) {
    status = 'at'
    message = 'Minimum tier points met'
  } else {
    status = 'above'
    message = `${current - minTierPoints} point${current - minTierPoints !== 1 ? 's' : ''} over minimum`
  }

  return { current, minimum: minTierPoints, status, message }
}
