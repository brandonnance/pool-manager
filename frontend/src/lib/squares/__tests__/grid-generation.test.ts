import { describe, it, expect } from 'vitest'
import {
  shuffleArray,
  generateGridNumbers,
  isValidGridNumbers,
} from '../grid-generation'

describe('shuffleArray', () => {
  it('should return array of same length', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const result = shuffleArray(input)
    expect(result.length).toBe(input.length)
  })

  it('should contain all original elements', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const result = shuffleArray(input)
    expect(result.sort((a, b) => a - b)).toEqual(input)
  })

  it('should not mutate original array', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const original = [...input]
    shuffleArray(input)
    expect(input).toEqual(original)
  })

  it('should produce different results with different random seeds', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

    // Use deterministic random for reproducible test
    let seed1 = 0.1
    const random1 = () => {
      seed1 = (seed1 * 9301 + 49297) % 233280
      return seed1 / 233280
    }

    let seed2 = 0.9
    const random2 = () => {
      seed2 = (seed2 * 9301 + 49297) % 233280
      return seed2 / 233280
    }

    const result1 = shuffleArray(input, random1)
    const result2 = shuffleArray(input, random2)

    // Should be different (with high probability)
    expect(result1.join(',')).not.toBe(result2.join(','))
  })

  it('should produce deterministic results with fixed random function', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

    // Create a counter to track calls
    let callIndex = 0
    const fixedValues = [0.5, 0.3, 0.7, 0.1, 0.9, 0.2, 0.8, 0.4, 0.6, 0.5]
    const fixedRandom = () => fixedValues[callIndex++ % fixedValues.length]

    const result1 = shuffleArray(input, fixedRandom)

    // Reset and run again
    callIndex = 0
    const result2 = shuffleArray(input, () => fixedValues[callIndex++ % fixedValues.length])

    expect(result1).toEqual(result2)
  })

  it('should handle empty array', () => {
    const result = shuffleArray([])
    expect(result).toEqual([])
  })

  it('should handle single element array', () => {
    const result = shuffleArray([5])
    expect(result).toEqual([5])
  })

  it('should use the custom random function provided', () => {
    const input = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    let callCount = 0
    const countingRandom = () => {
      callCount++
      return 0.5
    }

    shuffleArray(input, countingRandom)

    // Fisher-Yates makes n-1 swaps for an array of length n
    expect(callCount).toBe(9)
  })
})

describe('generateGridNumbers', () => {
  it('should generate valid row and column numbers', () => {
    const { rowNumbers, colNumbers } = generateGridNumbers()
    expect(isValidGridNumbers(rowNumbers)).toBe(true)
    expect(isValidGridNumbers(colNumbers)).toBe(true)
  })

  it('should generate arrays of length 10', () => {
    const { rowNumbers, colNumbers } = generateGridNumbers()
    expect(rowNumbers.length).toBe(10)
    expect(colNumbers.length).toBe(10)
  })

  it('should use provided random function', () => {
    let callCount = 0
    const countingRandom = () => {
      callCount++
      return Math.random()
    }

    generateGridNumbers(countingRandom)

    // Two arrays of 10 elements each = 2 * 9 = 18 calls
    expect(callCount).toBe(18)
  })

  it('should produce deterministic results with fixed random', () => {
    let seed = 0.12345
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }

    const result1 = generateGridNumbers(seededRandom)

    // Reset seed
    seed = 0.12345
    const result2 = generateGridNumbers(seededRandom)

    expect(result1.rowNumbers).toEqual(result2.rowNumbers)
    expect(result1.colNumbers).toEqual(result2.colNumbers)
  })
})

describe('isValidGridNumbers', () => {
  it('should return true for valid grid numbers in order', () => {
    expect(isValidGridNumbers([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(true)
  })

  it('should return true for valid grid numbers reversed', () => {
    expect(isValidGridNumbers([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])).toBe(true)
  })

  it('should return true for valid grid numbers shuffled', () => {
    expect(isValidGridNumbers([5, 2, 8, 1, 9, 0, 4, 7, 3, 6])).toBe(true)
  })

  it('should return false for wrong length (too short)', () => {
    expect(isValidGridNumbers([0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(false)
  })

  it('should return false for wrong length (too long)', () => {
    expect(isValidGridNumbers([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(false)
  })

  it('should return false for empty array', () => {
    expect(isValidGridNumbers([])).toBe(false)
  })

  it('should return false for duplicates', () => {
    expect(isValidGridNumbers([0, 0, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(false)
    expect(isValidGridNumbers([5, 5, 5, 5, 5, 5, 5, 5, 5, 5])).toBe(false)
  })

  it('should return false for out-of-range values (too high)', () => {
    expect(isValidGridNumbers([0, 1, 2, 3, 4, 5, 6, 7, 8, 10])).toBe(false)
  })

  it('should return false for out-of-range values (negative)', () => {
    expect(isValidGridNumbers([-1, 1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(false)
  })

  it('should return false for missing values', () => {
    // Has 0-8 but no 9 (has 0 twice would be caught by duplicates)
    expect(isValidGridNumbers([0, 1, 2, 3, 4, 5, 6, 7, 8, 8])).toBe(false)
  })
})
