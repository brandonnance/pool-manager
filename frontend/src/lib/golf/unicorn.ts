/**
 * Unicorn Team Algorithm
 *
 * Finds the mathematically optimal 6-golfer team that meets tier point requirements.
 * Uses tier multiset enumeration for efficiency (~300 combinations vs ~13 billion brute force).
 */

import { calculateEntryScore } from './scoring'

// Input type for golfers with their scores
export interface GolferWithScore {
  golferId: string
  golferName: string
  tier: number
  toPar: number // Score relative to par (e.g., -6, 0, +3)
  position: string
  madeCut: boolean
  thru: number | null
  round1: number | null
  round2: number | null
  round3: number | null
  round4: number | null
}

// Golfer in the unicorn team result
export interface UnicornGolfer {
  golferId: string
  golferName: string
  tier: number
  score: number // to_par
  position: string
  madeCut: boolean
  thru: number | null
  round1: number | null
  round2: number | null
  round3: number | null
  round4: number | null
  counted: boolean
}

// The unicorn team result
export interface UnicornTeam {
  golfers: UnicornGolfer[]
  totalScore: number
  totalTierPoints: number
  alternativeCount: number // Number of OTHER team combinations achieving same score
}

/**
 * Generate all valid tier multisets (combinations with repetition)
 * that have exactly 6 elements and sum to at least minPoints.
 *
 * @param minPoints Minimum tier points required (default 21)
 * @returns Array of tier multisets, e.g., [[1,1,2,3,4,6], [1,2,2,3,4,5], ...]
 */
export function generateValidMultisets(minPoints: number): number[][] {
  const results: number[][] = []

  // Recursive generation of 6-element multisets from tiers [0,1,2,3,4,5,6]
  function generate(current: number[], startTier: number, remaining: number): void {
    if (remaining === 0) {
      const sum = current.reduce((a, b) => a + b, 0)
      if (sum >= minPoints) {
        results.push([...current])
      }
      return
    }

    // Early termination: if max possible sum can't reach minPoints, skip
    const currentSum = current.reduce((a, b) => a + b, 0)
    const maxPossibleSum = currentSum + remaining * 6 // Fill remaining with tier 6
    if (maxPossibleSum < minPoints) {
      return
    }

    for (let tier = startTier; tier <= 6; tier++) {
      current.push(tier)
      generate(current, tier, remaining - 1) // tier (not tier+1) allows repetition
      current.pop()
    }
  }

  generate([], 0, 6)
  return results
}

/**
 * Convert a tier multiset to a count map.
 * e.g., [1,1,2,3,4,6] -> Map { 1 => 2, 2 => 1, 3 => 1, 4 => 1, 6 => 1 }
 */
function multisetToTierCounts(multiset: number[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const tier of multiset) {
    counts.set(tier, (counts.get(tier) || 0) + 1)
  }
  return counts
}

/**
 * Find the optimal "unicorn" team - the best possible 6-golfer roster
 * that meets tier point requirements using "best 4 of 6" scoring.
 *
 * @param golfersByTier Map of tier -> golfers sorted by to_par ascending (best first)
 * @param minTierPoints Minimum tier points required (default 21)
 * @returns The optimal team, or null if no valid team exists
 */
export function findUnicornTeam(
  golfersByTier: Map<number, GolferWithScore[]>,
  minTierPoints: number = 21
): UnicornTeam | null {
  // Generate all valid tier multisets
  const validMultisets = generateValidMultisets(minTierPoints)

  let bestTeam: GolferWithScore[] | null = null
  let bestScore = Infinity
  let bestTierPoints = 0
  let teamsAtBestScore = 0

  // For each valid multiset, build the best possible team
  for (const multiset of validMultisets) {
    const tierCounts = multisetToTierCounts(multiset)

    // Check if we have enough golfers in each required tier
    let canBuild = true
    for (const [tier, count] of tierCounts) {
      const availableGolfers = golfersByTier.get(tier) || []
      if (availableGolfers.length < count) {
        canBuild = false
        break
      }
    }

    if (!canBuild) continue

    // Build team by picking the best N golfers from each tier
    const team: GolferWithScore[] = []
    for (const [tier, count] of tierCounts) {
      const tierGolfers = golfersByTier.get(tier)!
      team.push(...tierGolfers.slice(0, count))
    }

    // Calculate best-4-of-6 score
    // Convert to the format expected by calculateEntryScore
    const golferScores = team.map((g) => ({
      golferId: g.golferId,
      golferName: g.golferName,
      tier: g.tier,
      totalScore: g.toPar, // calculateEntryScore uses totalScore field
      madeCut: g.madeCut,
      counted: false,
    }))

    const { totalScore } = calculateEntryScore(golferScores)

    // Track best and count ties
    if (totalScore < bestScore) {
      bestScore = totalScore
      bestTeam = team
      bestTierPoints = multiset.reduce((a, b) => a + b, 0)
      teamsAtBestScore = 1
    } else if (totalScore === bestScore) {
      teamsAtBestScore++
    }
  }

  if (!bestTeam) {
    return null
  }

  // Calculate final best-4-of-6 to get counted/dropped flags
  const golferScores = bestTeam.map((g) => ({
    golferId: g.golferId,
    golferName: g.golferName,
    tier: g.tier,
    totalScore: g.toPar,
    madeCut: g.madeCut,
    counted: false,
    position: g.position,
    thru: g.thru,
    round1: g.round1,
    round2: g.round2,
    round3: g.round3,
    round4: g.round4,
  }))

  const { countedGolfers, droppedGolfers } = calculateEntryScore(golferScores)

  // Merge back with full golfer info
  const unicornGolfers: UnicornGolfer[] = [
    ...countedGolfers.map((g) => {
      const original = bestTeam!.find((o) => o.golferId === g.golferId)!
      return {
        golferId: g.golferId,
        golferName: g.golferName,
        tier: g.tier,
        score: original.toPar,
        position: original.position,
        madeCut: original.madeCut,
        thru: original.thru,
        round1: original.round1,
        round2: original.round2,
        round3: original.round3,
        round4: original.round4,
        counted: true,
      }
    }),
    ...droppedGolfers.map((g) => {
      const original = bestTeam!.find((o) => o.golferId === g.golferId)!
      return {
        golferId: g.golferId,
        golferName: g.golferName,
        tier: g.tier,
        score: original.toPar,
        position: original.position,
        madeCut: original.madeCut,
        thru: original.thru,
        round1: original.round1,
        round2: original.round2,
        round3: original.round3,
        round4: original.round4,
        counted: false,
      }
    }),
  ]

  return {
    golfers: unicornGolfers,
    totalScore: bestScore,
    totalTierPoints: bestTierPoints,
    alternativeCount: teamsAtBestScore - 1, // Exclude the one we're showing
  }
}
