/**
 * NFL Desperation scoring — pure functions.
 *
 * Rules (NFL_Desperation.md §6–§9):
 * - Weekly points = n(n+1)/2 where n = picks on qualifying games, ONLY if all correct.
 * - One wrong qualifying pick → 0.
 * - Ties and canceled games do not qualify: removed from n entirely.
 * - Postponed games stay pending until rescheduled or removed by the commissioner.
 */
import type { NdGame, NdPick, WeekScore, EntryWeekState, Winner } from './types'

/** n(n+1)/2 */
export function triangular(n: number): number {
  if (n <= 0) return 0
  return (n * (n + 1)) / 2
}

/** Derive winner from a final score. Returns null if the game isn't final. */
export function deriveWinner(game: Pick<NdGame, 'status' | 'home_score' | 'away_score'>): Winner | null {
  if (game.status !== 'final') return null
  if (game.home_score === null || game.away_score === null) return null
  if (game.home_score === game.away_score) return 'tie'
  return game.home_score > game.away_score ? 'home' : 'away'
}

/** A game qualifies for scoring iff it is final with a non-tie result. */
export function gameQualifies(game: Pick<NdGame, 'status' | 'winner'>): boolean {
  return game.status === 'final' && game.winner !== null && game.winner !== 'tie'
}

/** Final or canceled — nothing more will happen to this game. */
export function isTerminal(game: Pick<NdGame, 'status'>): boolean {
  return game.status === 'final' || game.status === 'canceled'
}

/** Tie or canceled — the pick is erased as though the game never happened. */
export function isVoided(game: Pick<NdGame, 'status' | 'winner'>): boolean {
  return game.status === 'canceled' || (game.status === 'final' && game.winner === 'tie')
}

/**
 * Score one entry's picks for a week.
 * `games` must contain every game referenced by `picks`; picks on unknown games are ignored.
 */
export function scoreWeek(picks: NdPick[], games: NdGame[]): WeekScore {
  const byId = new Map(games.map((g) => [g.id, g]))

  let correct = 0
  let wrong = 0
  let pending = 0
  let voided = 0
  let picksMade = 0

  for (const pick of picks) {
    const game = byId.get(pick.game_id)
    if (!game) continue
    picksMade++

    if (isVoided(game)) {
      voided++
    } else if (gameQualifies(game)) {
      if (pick.selection === game.winner) correct++
      else wrong++
    } else {
      // scheduled, in_progress, postponed, or final-without-score (shouldn't happen)
      pending++
    }
  }

  const qualifying = correct + wrong
  const busted = wrong > 0
  const complete = pending === 0
  const potentialPoints = busted ? 0 : triangular(correct + pending)
  const finalPoints = complete ? (busted ? 0 : triangular(correct)) : null

  return { picksMade, correct, wrong, pending, voided, qualifying, busted, complete, potentialPoints, finalPoints }
}

export function entryWeekState(score: WeekScore): EntryWeekState {
  if (score.picksMade === 0) return 'no_picks'
  if (score.busted) return 'busted'
  if (score.complete) return 'perfect'
  return 'alive'
}

/** Display-ready summary of a week score, shared by the footer, board, and standings. */
export interface WeekScoreSummary {
  state: EntryWeekState
  /** Correct picks so far */
  right: number
  /** Picks that still count: picks made minus voided (tie / canceled) */
  counted: number
  /** Voided picks, for an optional "(1 tie)" hint */
  voided: number
  /** Max points while alive; final points once complete; 0 when busted */
  points: number
  /** 'max' while games remain, 'pts' once the entry's week is decided */
  pointsLabel: 'max' | 'pts'
}

/**
 * "X/Y" where X = correct so far and Y = picks that count, plus the one number
 * that matters in all-or-nothing scoring: the max still on the table (or the
 * final total once every picked game is done). Busted → 0, labeled 'pts'.
 */
export function summarizeWeekScore(score: WeekScore): WeekScoreSummary {
  const state = entryWeekState(score)
  const decided = score.complete || score.busted
  return {
    state,
    right: score.correct,
    counted: score.picksMade - score.voided,
    voided: score.voided,
    points: decided ? (score.finalPoints ?? 0) : score.potentialPoints,
    pointsLabel: decided ? 'pts' : 'max',
  }
}

/**
 * Season total = sum of FINALIZED weeks only. A week's points join the season
 * when its last game ends, never before — even for an entry whose own picks
 * are all decided (that would leak their result before the Sunday lock).
 */
export function sumSeasonPoints<T extends { entry_id: string; points: number; finalized: boolean }>(
  rows: T[]
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const r of rows) {
    if (!r.finalized) continue
    totals.set(r.entry_id, (totals.get(r.entry_id) ?? 0) + r.points)
  }
  return totals
}

export interface StandingRow<T = string> {
  entryId: T
  points: number
  rank: number
  /** true when this rank is shared */
  tied: boolean
}

/**
 * Rank entries by points, descending. Ties share a rank (1, 2, 2, 4). No tiebreakers (§13, §16, §17).
 */
export function rankByPoints<T>(rows: Array<{ entryId: T; points: number }>): StandingRow<T>[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points)
  const out: StandingRow<T>[] = []
  let rank = 0
  let prevPoints: number | null = null
  sorted.forEach((row, i) => {
    if (row.points !== prevPoints) {
      rank = i + 1
      prevPoints = row.points
    }
    out.push({ entryId: row.entryId, points: row.points, rank, tied: false })
  })
  // mark ties
  const counts = new Map<number, number>()
  out.forEach((r) => counts.set(r.rank, (counts.get(r.rank) ?? 0) + 1))
  out.forEach((r) => (r.tied = (counts.get(r.rank) ?? 0) > 1))
  return out
}
