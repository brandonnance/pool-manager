// Spread cover calculations for March Madness Blind Draw

import type { MmGame, MmPoolTeam, PushRule } from './types'

export interface SpreadCoverResult {
  winner: 'higher' | 'lower'
  spreadCover: 'higher' | 'lower' | 'push'
  advancingTeam: 'higher' | 'lower'
  margin: number
  adjustedMargin: number
}

/**
 * Calculate the spread cover result for a game
 * @param higherSeedScore - Score of the higher seed (better seed, e.g. #1)
 * @param lowerSeedScore - Score of the lower seed (worse seed, e.g. #16)
 * @param spread - Point spread (negative means higher seed is favored)
 * @param pushRule - How to handle pushes
 * @returns Spread cover result
 */
export function calculateSpreadCover(
  higherSeedScore: number,
  lowerSeedScore: number,
  spread: number,
  pushRule: PushRule = 'favorite_advances'
): SpreadCoverResult {
  // Determine straight-up winner
  const margin = higherSeedScore - lowerSeedScore
  const winner: 'higher' | 'lower' = margin > 0 ? 'higher' : 'lower'

  // Calculate adjusted score for spread
  // Spread is negative when higher seed is favored
  // e.g., spread = -10 means higher seed favored by 10
  // adjusted = higherSeedScore + spread (adding negative number)
  const adjustedHigherScore = higherSeedScore + spread
  const adjustedMargin = adjustedHigherScore - lowerSeedScore

  let spreadCover: 'higher' | 'lower' | 'push'
  if (adjustedMargin > 0) {
    spreadCover = 'higher'
  } else if (adjustedMargin < 0) {
    spreadCover = 'lower'
  } else {
    spreadCover = 'push'
  }

  // Determine advancing team based on spread cover
  let advancingTeam: 'higher' | 'lower'
  if (spreadCover === 'push') {
    // Handle push based on rule
    switch (pushRule) {
      case 'favorite_advances':
        // Favorite is whoever is favored by the spread
        // If spread is negative, higher seed is favorite
        advancingTeam = spread < 0 ? 'higher' : 'lower'
        break
      case 'underdog_advances':
        // Underdog is whoever is not favored
        advancingTeam = spread < 0 ? 'lower' : 'higher'
        break
      case 'coin_flip':
        // Random (use consistent "random" for same game)
        advancingTeam = Math.random() < 0.5 ? 'higher' : 'lower'
        break
      default:
        advancingTeam = 'higher'
    }
  } else {
    advancingTeam = spreadCover
  }

  return {
    winner,
    spreadCover,
    advancingTeam,
    margin: Math.abs(margin),
    adjustedMargin,
  }
}

/**
 * Generate a realistic spread based on seed differential
 * @param higherSeed - Seed number of higher seed (1-16, lower is better)
 * @param lowerSeed - Seed number of lower seed (1-16, higher is worse)
 * @returns Suggested spread (negative = higher seed favored)
 */
export function generateSpreadFromSeeds(
  higherSeed: number,
  lowerSeed: number
): number {
  // Approximate points per seed difference
  // Based on historical NCAA tournament data
  const pointsPerSeed = 2.5

  // Calculate base spread
  const seedDiff = lowerSeed - higherSeed
  let spread = -seedDiff * pointsPerSeed

  // Adjust for extreme matchups
  if (higherSeed === 1 && lowerSeed === 16) {
    spread = -23 // 1v16 typically has huge spread
  } else if (higherSeed === 2 && lowerSeed === 15) {
    spread = -15
  } else if (higherSeed === 3 && lowerSeed === 14) {
    spread = -12
  }

  // Round to nearest 0.5
  return Math.round(spread * 2) / 2
}

/**
 * Simulate a game score based on spread
 * @param spread - Point spread (negative = higher seed favored)
 * @param upsetProbability - Base probability of upset (default 0.3)
 * @returns Simulated scores [higherSeedScore, lowerSeedScore]
 */
export function simulateGameScore(
  spread: number,
  upsetProbability: number = 0.3
): [number, number] {
  // Base score around 70
  const baseScore = 70

  // Random variance
  const variance = () => Math.floor(Math.random() * 15) - 7

  // Determine if upset
  const isUpset = Math.random() < upsetProbability

  // Expected margin based on spread (flip sign since spread is from higher seed perspective)
  const expectedMargin = -spread

  // Actual margin with variance
  let actualMargin: number
  if (isUpset) {
    // Upset: lower seed wins by at least 1
    actualMargin = -(Math.floor(Math.random() * 10) + 1)
  } else {
    // Favorite wins (usually higher seed when spread < 0)
    actualMargin = Math.max(1, expectedMargin + Math.floor(Math.random() * 10) - 5)
    if (spread > 0) {
      // Lower seed was favored, so they win
      actualMargin = -actualMargin
    }
  }

  const higherSeedScore = baseScore + variance() + Math.floor(actualMargin / 2)
  const lowerSeedScore = baseScore + variance() - Math.floor(actualMargin / 2)

  // Ensure no ties and reasonable scores
  const finalHigherScore = Math.max(50, higherSeedScore)
  let finalLowerScore = Math.max(50, lowerSeedScore)

  // Prevent ties
  if (finalHigherScore === finalLowerScore) {
    finalLowerScore = finalHigherScore - 1
  }

  return [finalHigherScore, finalLowerScore]
}
