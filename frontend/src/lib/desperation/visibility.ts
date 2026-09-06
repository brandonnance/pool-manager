/**
 * NFL Desperation lock & visibility gates — pure functions.
 *
 * Rules (NFL_Desperation.md §4–§5), plus the confirmed decision that
 * per-entry pick COUNTS stay hidden until the week lock (not live).
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

/** Are OTHER players' picks on this game visible? Yes once it has kicked off. */
export function isPickVisibleToOthers(
  game: Pick<NdGame, 'kickoff_at' | 'status'>,
  now: Date = new Date()
): boolean {
  if (game.status !== 'scheduled') return true
  return now >= new Date(game.kickoff_at)
}

/** Is the per-entry "number of picks this week" visible to other players? Only after the week lock. */
export function isCountVisibleToOthers(week: Pick<NdWeek, 'lock_at'>, now: Date = new Date()): boolean {
  return now >= new Date(week.lock_at)
}

/** Is the week fully locked (no game may be edited)? */
export function isWeekLocked(week: Pick<NdWeek, 'lock_at'>, now: Date = new Date()): boolean {
  return now >= new Date(week.lock_at)
}
