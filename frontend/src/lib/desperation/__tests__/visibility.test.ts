import { describe, it, expect } from 'vitest'
import { gameLockAt, canEditPick, isPickVisibleToOthers, isCountVisibleToOthers, isWeekLocked } from '../visibility'

const week = { lock_at: '2026-09-13T17:00:00Z' } // Sun noon CDT
const wed = { kickoff_at: '2026-09-10T00:20:00Z', status: 'scheduled' as const }
const sunEarly = { kickoff_at: '2026-09-13T17:00:00Z', status: 'scheduled' as const }
const mnf = { kickoff_at: '2026-09-15T00:15:00Z', status: 'scheduled' as const }

describe('gameLockAt', () => {
  it('pre-Sunday games lock at their own kickoff', () => {
    expect(gameLockAt(wed, week).toISOString()).toBe('2026-09-10T00:20:00.000Z')
  })
  it('Sunday and Monday games lock at the week lock', () => {
    expect(gameLockAt(mnf, week).toISOString()).toBe('2026-09-13T17:00:00.000Z')
  })
})

describe('canEditPick', () => {
  it('MNF is editable Saturday night but not Sunday afternoon', () => {
    expect(canEditPick(mnf, week, new Date('2026-09-13T03:00:00Z'))).toBe(true)
    expect(canEditPick(mnf, week, new Date('2026-09-13T20:00:00Z'))).toBe(false)
  })
  it('the Wednesday game is not editable Thursday even though the week is open', () => {
    expect(canEditPick(wed, week, new Date('2026-09-11T12:00:00Z'))).toBe(false)
  })
  it('exactly at lock is locked', () => {
    expect(canEditPick(sunEarly, week, new Date('2026-09-13T17:00:00Z'))).toBe(false)
    expect(canEditPick(sunEarly, week, new Date('2026-09-13T16:59:59Z'))).toBe(true)
  })
  it('non-scheduled games are never editable', () => {
    expect(canEditPick({ ...mnf, status: 'in_progress' }, week, new Date('2026-09-01T00:00:00Z'))).toBe(false)
    expect(canEditPick({ ...mnf, status: 'postponed' }, week, new Date('2026-09-01T00:00:00Z'))).toBe(false)
  })
})

describe('isPickVisibleToOthers', () => {
  it('nothing is visible before the Sunday noon lock, even a finished Wednesday game', () => {
    const thu = new Date('2026-09-11T12:00:00Z')
    expect(isPickVisibleToOthers(week, thu)).toBe(false)
    expect(isPickVisibleToOthers(week, new Date('2026-09-13T16:59:59Z'))).toBe(false)
  })
  it('everything is visible from the lock second on, including games that have not kicked off', () => {
    expect(isPickVisibleToOthers(week, new Date('2026-09-13T17:00:00Z'))).toBe(true)
    expect(isPickVisibleToOthers(week, new Date('2026-09-13T20:00:00Z'))).toBe(true)
  })
})

describe('isCountVisibleToOthers / isWeekLocked', () => {
  it('counts are hidden Thursday even after the Wednesday reveal', () => {
    expect(isCountVisibleToOthers(week, new Date('2026-09-11T12:00:00Z'))).toBe(false)
  })
  it('counts appear at the noon lock', () => {
    expect(isCountVisibleToOthers(week, new Date('2026-09-13T17:00:00Z'))).toBe(true)
    expect(isWeekLocked(week, new Date('2026-09-13T17:00:00Z'))).toBe(true)
  })
})
