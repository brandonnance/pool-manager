/**
 * Test fixtures for squares
 */

import type { Square } from '@/lib/squares/types'

/**
 * Generate a full 10x10 grid of squares
 */
export function generateFullGrid(options?: {
  sqPoolId?: string
  userId?: string | null
  participantName?: string | null
}): Square[] {
  const { sqPoolId = 'sq-pool-1', userId = null, participantName = null } = options ?? {}

  return Array.from({ length: 100 }, (_, i) => ({
    id: `${sqPoolId}-sq-${Math.floor(i / 10)}-${i % 10}`,
    row_index: Math.floor(i / 10),
    col_index: i % 10,
    user_id: userId,
    participant_name: participantName,
  }))
}

/**
 * Sample squares with some claimed by users
 */
export const sampleSquares: Square[] = Array.from({ length: 100 }, (_, i) => ({
  id: `sq-${Math.floor(i / 10)}-${i % 10}`,
  row_index: Math.floor(i / 10),
  col_index: i % 10,
  user_id: i < 50 ? `user-${i % 5}` : null,
  participant_name: i < 50 ? `User ${i % 5}` : null,
}))

/**
 * Full grid with all squares claimed
 */
export const fullClaimedGrid: Square[] = Array.from({ length: 100 }, (_, i) => ({
  id: `sq-${Math.floor(i / 10)}-${i % 10}`,
  row_index: Math.floor(i / 10),
  col_index: i % 10,
  user_id: `user-${i % 10}`,
  participant_name: `Player ${i % 10}`,
}))

/**
 * Empty grid with no claims
 */
export const emptyGrid: Square[] = Array.from({ length: 100 }, (_, i) => ({
  id: `sq-${Math.floor(i / 10)}-${i % 10}`,
  row_index: Math.floor(i / 10),
  col_index: i % 10,
  user_id: null,
  participant_name: null,
}))

/**
 * Find a square by position
 */
export function findSquareByPosition(
  squares: Square[],
  rowIndex: number,
  colIndex: number
): Square | undefined {
  return squares.find(
    (sq) => sq.row_index === rowIndex && sq.col_index === colIndex
  )
}
