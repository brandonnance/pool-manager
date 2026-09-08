/**
 * NFL Desperation lock & visibility gates — pure functions.
 *
 * Rules (NFL_Desperation.md §4–§5), plus the confirmed decision (2026-09-08) that
 * NOTHING about another entry's week — individual picks, pick count, or points —
 * is visible until the week lock (Sunday 12:00 PM Central). An entry always sees
 * its own picks and score.
 *
 * Every server path that returns another entry's picks MUST go through these.
 */
import type { NdGame, NdWeek } from './types'

/** The instant a game locks: its kickoff or the week lock, whichever is first. */
export function gameLockAt(game: Pick<NdGame, 'kickoff_at'>, week: Pick<NdWeek, 'lock_at'>): Date {
  const kickoff = new Date(game.kickoff_at)
  const lock = new Date(week.lock_at)
  return kickoff < lock ? kickoff : lock
}

/** Can a pick on this game be created, changed, or removed right now? */
export function canEditPick(
  game: Pick<NdGame, 'kickoff_at' | 'status'>,
  week: Pick<NdWeek, 'lock_at'>,
  now: Date = new Date()
): boolean {
  if (game.status !== 'scheduled') return false
  return now < gameLockAt(game, week)
}

/** Is the week fully locked (no game may be edited)? */
export function isWeekLocked(week: Pick<NdWeek, 'lock_at'>, now: Date = new Date()): boolean {
  return now >= new Date(week.lock_at)
}

/**
 * Are OTHER players' individual picks for this week visible? Only after the week lock.
 * A pre-Sunday game's pick is locked at its kickoff but stays hidden until Sunday noon,
 * so nobody learns who is already busted before everyone's picks are frozen.
 */
export function isPickVisibleToOthers(week: Pick<NdWeek, 'lock_at'>, now: Date = new Date()): boolean {
  return isWeekLocked(week, now)
}

/** Is the per-entry pick count / week score visible to other players? Only after the week lock. */
export function isCountVisibleToOthers(week: Pick<NdWeek, 'lock_at'>, now: Date = new Date()): boolean {
  return isWeekLocked(week, now)
}
