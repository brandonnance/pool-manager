// Validation utilities for March Madness Blind Draw

import type { Round, Region } from './types'

export const VALID_ROUNDS: Round[] = ['R64', 'R32', 'S16', 'E8', 'F4', 'FINAL']
export const VALID_REGIONS: Region[] = ['East', 'West', 'South', 'Midwest']

// Number of games per round
export const GAMES_PER_ROUND: Record<Round, number> = {
  R64: 32,
  R32: 16,
  S16: 8,
  E8: 4,
  F4: 2,
  FINAL: 1,
}

// Total games in tournament
export const TOTAL_GAMES = 63 // 32 + 16 + 8 + 4 + 2 + 1

/**
 * Validate that a pool has exactly 64 teams
 */
export function validateTeamCount(count: number): { valid: boolean; message: string } {
  if (count < 64) {
    return { valid: false, message: `Need ${64 - count} more teams` }
  }
  if (count > 64) {
    return { valid: false, message: `Too many teams (${count - 64} extra)` }
  }
  return { valid: true, message: 'Valid' }
}

/**
 * Validate that a pool has exactly 64 entries
 */
export function validateEntryCount(count: number): { valid: boolean; message: string } {
  if (count < 64) {
    return { valid: false, message: `Need ${64 - count} more entries` }
  }
  if (count > 64) {
    return { valid: false, message: `Too many entries (${count - 64} extra)` }
  }
  return { valid: true, message: 'Valid' }
}

/**
 * Validate that each region has exactly 16 teams (seeds 1-16)
 */
export function validateRegions(
  teams: Array<{ region: string; seed: number }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const region of VALID_REGIONS) {
    const regionTeams = teams.filter(t => t.region === region)
    const seeds = new Set(regionTeams.map(t => t.seed))

    if (regionTeams.length !== 16) {
      errors.push(`${region} region has ${regionTeams.length} teams (need 16)`)
    }

    // Check for missing seeds
    for (let seed = 1; seed <= 16; seed++) {
      if (!seeds.has(seed)) {
        errors.push(`${region} region missing seed #${seed}`)
      }
    }

    // Check for duplicate seeds
    if (seeds.size !== regionTeams.length) {
      errors.push(`${region} region has duplicate seeds`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate a seed number
 */
export function isValidSeed(seed: number): boolean {
  return seed >= 1 && seed <= 16 && Number.isInteger(seed)
}

/**
 * Validate a region string
 */
export function isValidRegion(region: string): region is Region {
  return VALID_REGIONS.includes(region as Region)
}

/**
 * Validate a round string
 */
export function isValidRound(round: string): round is Round {
  return VALID_ROUNDS.includes(round as Round)
}

/**
 * Get the next round after the given round
 */
export function getNextRound(round: Round): Round | null {
  const idx = VALID_ROUNDS.indexOf(round)
  if (idx === -1 || idx === VALID_ROUNDS.length - 1) {
    return null
  }
  return VALID_ROUNDS[idx + 1]
}

/**
 * Validate that payout percentages sum to 100%
 */
export function validatePayouts(payouts: {
  sweet16_payout_pct: number
  elite8_payout_pct: number
  final4_payout_pct: number
  runnerup_payout_pct: number
  champion_payout_pct: number
}): { valid: boolean; total: number; message: string } {
  const total =
    payouts.sweet16_payout_pct +
    payouts.elite8_payout_pct +
    payouts.final4_payout_pct +
    payouts.runnerup_payout_pct +
    payouts.champion_payout_pct

  if (total !== 100) {
    return {
      valid: false,
      total,
      message: `Payouts sum to ${total}% (should be 100%)`,
    }
  }

  return { valid: true, total, message: 'Valid' }
}

/**
 * Get first-round matchups based on seed (standard NCAA format)
 * Returns pairs of [higherSeed, lowerSeed] that play each other
 */
export function getFirstRoundMatchups(): Array<[number, number]> {
  return [
    [1, 16],
    [8, 9],
    [5, 12],
    [4, 13],
    [6, 11],
    [3, 14],
    [7, 10],
    [2, 15],
  ]
}

/**
 * Determine which seeds would play in subsequent rounds
 * (assuming favorites win - used for bracket structure)
 */
export function getExpectedMatchupSeeds(
  round: Round
): Array<[number, number]> {
  switch (round) {
    case 'R64':
      return getFirstRoundMatchups()
    case 'R32':
      return [
        [1, 8],
        [4, 5],
        [3, 6],
        [2, 7],
      ]
    case 'S16':
      return [
        [1, 4],
        [2, 3],
      ]
    case 'E8':
      return [[1, 2]]
    case 'F4':
      // Final Four: cross-region matchups
      return [
        [1, 1], // Region winners
        [1, 1],
      ]
    case 'FINAL':
      return [[1, 1]] // Final Four winners
    default:
      return []
  }
}
