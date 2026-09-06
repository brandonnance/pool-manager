'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { rankByPoints } from '@/lib/desperation/scoring'
import type { BoardPayload, WeekScore } from '@/lib/desperation/types'

interface Props {
  board: BoardPayload
}

/** Desktop-only column: this week's points so far. null score = hidden until the noon lock. */
function weekCell(score: WeekScore | null) {
  if (!score) return <span className="text-muted-foreground" title="Hidden until the Sunday noon lock">&mdash;</span>
  if (score.busted) return <span className="text-red-600">Busted</span>
  if (score.picksMade === 0) return <span className="text-muted-foreground">0</span>
  if (score.complete) return <span>{score.finalPoints}</span>
  return <span>{score.potentialPoints}<span className="ml-0.5 text-xs font-normal text-muted-foreground">max</span></span>
}

export function StandingsPanel({ board }: Props) {
  const ranked = useMemo(() => {
    const rows = rankByPoints(board.entries.map((e) => ({ entryId: e.id, points: e.seasonPoints })))
    const byId = new Map(board.entries.map((e) => [e.id, e]))
    return rows.map((r) => ({ ...r, entry: byId.get(r.entryId)! }))
  }, [board.entries])

  const provisional = board.standingsIncludeProvisionalWeek

  return (
    <div className="space-y-3">
      {provisional !== null && (
        <p className="text-xs text-muted-foreground">
          Includes provisional Week {provisional} points. Totals finalize when the last game of the week ends.
        </p>
      )}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Player</th>
              <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Week {board.week.week_number}</th>
              <th className="px-3 py-2 text-right font-medium">Season</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.entryId} className={cn('border-t', r.entry.isMe && 'bg-primary/5')}>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {r.tied ? `T${r.rank}` : r.rank}
                </td>
                <td className={cn('px-3 py-2', r.entry.isMe && 'font-semibold text-primary')}>
                  {r.entry.name}{r.entry.isMe && ' (you)'}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{weekCell(r.entry.score)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.points}</td>
              </tr>
            ))}
            {ranked.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No entries yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Ties share a rank. There are no tiebreakers.</p>
    </div>
  )
}
