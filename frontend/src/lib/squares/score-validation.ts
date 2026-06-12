/**
 * Score validation utilities for squares pools
 * Handles validation of score changes in score_change mode
 */

import type { ScoreChange, ScoreValidationResult } from './types'

/**
 * Validate a new score change against the previous score.
 *
 * Rules:
 * 1. Scores cannot decrease
 * 2. Only one team can score at a time
 * 3. At least one score must change
 *
 * @param newHomeScore - New home team score
 * @param newAwayScore - New away team score
 * @param previousHomeScore - Previous home team score
 * @param previousAwayScore - Previous away team score
 * @param homeTeamName - Home team name (for error messages)
 * @param awayTeamName - Away team name (for error messages)
 * @returns Validation result with isValid and optional error message
 */
export function validateScoreChange(
  newHomeScore: number,
  newAwayScore: number,
  previousHomeScore: number,
  previousAwayScore: number,
  homeTeamName: string = 'Home',
  awayTeamName: string = 'Away'
): ScoreValidationResult {
  // Rule 1: Scores cannot decrease
  if (newHomeScore < previousHomeScore) {
    return {
      isValid: false,
      error: `${homeTeamName} score cannot be less than ${previousHomeScore}`,
    }
  }
  if (newAwayScore < previousAwayScore) {
    return {
      isValid: false,
      error: `${awayTeamName} score cannot be less than ${previousAwayScore}`,
    }
  }

  const homeChanged = newHomeScore !== previousHomeScore
  const awayChanged = newAwayScore !== previousAwayScore

  // Rule 2: Only one team can score at a time
  if (homeChanged && awayChanged) {
    return {
      isValid: false,
      error: 'Only one team can score at a time',
    }
  }

  // Rule 3: At least one score must change
  if (!homeChanged && !awayChanged) {
    return {
      isValid: false,
      error: 'Score must change from the previous entry',
    }
  }

  return { isValid: true, error: null }
}

/** Upper bound for a plausible single-game score (football/basketball) */
export const MAX_REASONABLE_SCORE = 200

/**
 * Validate a single score value: whole number, non-negative, plausibly sized.
 *
 * @param value - Parsed score value
 * @param label - Field label for error messages (e.g. "Halftime home score")
 * @returns Validation result
 */
export function validateScoreValue(
  value: number,
  label: string = 'Score'
): ScoreValidationResult {
  if (!Number.isInteger(value)) {
    return { isValid: false, error: `${label} must be a whole number` }
  }
  if (value < 0) {
    return { isValid: false, error: `${label} cannot be negative` }
  }
  if (value > MAX_REASONABLE_SCORE) {
    return {
      isValid: false,
      error: `${label} looks too high (max ${MAX_REASONABLE_SCORE})`,
    }
  }
  return { isValid: true, error: null }
}

/**
 * Validate that cumulative stage scores never decrease (e.g. Q1 <= Halftime
 * <= Q3 <= Final). Pass null for stages without scores; they are skipped.
 *
 * @param stages - Stage scores in game order, null when not entered
 * @returns Validation result
 */
export function validateStageProgression(
  stages: Array<{ label: string; home: number; away: number } | null>
): ScoreValidationResult {
  const present = stages.filter(
    (s): s is { label: string; home: number; away: number } => s !== null
  )
  for (let i = 1; i < present.length; i++) {
    const prev = present[i - 1]
    const curr = present[i]
    if (curr.home < prev.home || curr.away < prev.away) {
      return {
        isValid: false,
        error: `${curr.label} score cannot be lower than ${prev.label} score`,
      }
    }
  }
  return { isValid: true, error: null }
}

/**
 * Validate that the first score change is 0-0.
 *
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @returns Validation result
 */
export function validateFirstScoreChange(
  homeScore: number,
  awayScore: number
): ScoreValidationResult {
  if (homeScore !== 0 || awayScore !== 0) {
    return {
      isValid: false,
      error: 'First score must be 0-0',
    }
  }
  return { isValid: true, error: null }
}

/**
 * Get the last score from a list of score changes.
 *
 * @param scoreChanges - Array of score changes
 * @returns The most recent score (by change_order), or 0-0 if empty
 */
export function getLastScore(
  scoreChanges: ScoreChange[]
): { homeScore: number; awayScore: number } {
  if (scoreChanges.length === 0) {
    return { homeScore: 0, awayScore: 0 }
  }
  const sorted = [...scoreChanges].sort(
    (a, b) => b.change_order - a.change_order
  )
  return {
    homeScore: sorted[0].home_score,
    awayScore: sorted[0].away_score,
  }
}

/**
 * Sort score changes by change_order ascending.
 *
 * @param scoreChanges - Array of score changes
 * @returns New array sorted by change_order
 */
export function sortScoreChanges(scoreChanges: ScoreChange[]): ScoreChange[] {
  return [...scoreChanges].sort((a, b) => a.change_order - b.change_order)
}
