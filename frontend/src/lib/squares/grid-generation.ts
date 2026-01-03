/**
 * Grid generation utilities for squares pools
 * Handles random number generation for row/column assignments
 */

/**
 * Fisher-Yates shuffle algorithm for generating random number arrays.
 * Used for assigning random digits to grid rows/columns.
 *
 * @param array - Array to shuffle (typically [0,1,2,3,4,5,6,7,8,9])
 * @param randomFn - Optional custom random function (for testing). Should return [0, 1)
 * @returns New shuffled array (does not mutate input)
 */
export function shuffleArray(
  array: number[],
  randomFn: () => number = Math.random
): number[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Generate row and column number assignments for a squares grid.
 *
 * @param randomFn - Optional custom random function (for testing)
 * @returns Object with rowNumbers and colNumbers arrays, each containing 0-9 shuffled
 */
export function generateGridNumbers(
  randomFn: () => number = Math.random
): { rowNumbers: number[]; colNumbers: number[] } {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  return {
    rowNumbers: shuffleArray(digits, randomFn),
    colNumbers: shuffleArray(digits, randomFn),
  }
}

/**
 * Validate that a number array is a valid grid assignment.
 * Must contain exactly digits 0-9 with no duplicates.
 *
 * @param numbers - Array to validate
 * @returns true if valid, false otherwise
 */
export function isValidGridNumbers(numbers: number[]): boolean {
  if (numbers.length !== 10) return false
  const sorted = [...numbers].sort((a, b) => a - b)
  return sorted.every((n, i) => n === i)
}
