import { describe, it, expect } from 'vitest'
import { isArchived, canArchive, partitionArchived } from '../archive'

describe('isArchived', () => {
  it('is false when archived_at is null', () => {
    expect(isArchived({ archived_at: null })).toBe(false)
  })

  it('is true when archived_at is set', () => {
    expect(isArchived({ archived_at: '2026-09-09T12:00:00Z' })).toBe(true)
  })
})

describe('canArchive', () => {
  it('allows a completed, unarchived pool', () => {
    expect(canArchive({ status: 'completed', archived_at: null })).toBe(true)
  })

  it('rejects an open pool', () => {
    expect(canArchive({ status: 'open', archived_at: null })).toBe(false)
  })

  it('rejects a draft pool', () => {
    expect(canArchive({ status: 'draft', archived_at: null })).toBe(false)
  })

  it('rejects an in-progress (locked) pool', () => {
    expect(canArchive({ status: 'locked', archived_at: null })).toBe(false)
  })

  it('rejects a pool that is already archived', () => {
    expect(canArchive({ status: 'completed', archived_at: '2026-09-09T12:00:00Z' })).toBe(false)
  })
})

describe('partitionArchived', () => {
  const a = { id: 'a', archived_at: null }
  const b = { id: 'b', archived_at: '2026-09-09T12:00:00Z' }
  const c = { id: 'c', archived_at: null }

  it('splits pools into active and archived, preserving order', () => {
    expect(partitionArchived([a, b, c])).toEqual({ active: [a, c], archived: [b] })
  })

  it('returns empty arrays for no pools', () => {
    expect(partitionArchived([])).toEqual({ active: [], archived: [] })
  })

  it('treats null/undefined input as no pools', () => {
    expect(partitionArchived(null)).toEqual({ active: [], archived: [] })
    expect(partitionArchived(undefined)).toEqual({ active: [], archived: [] })
  })
})
