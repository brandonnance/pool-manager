'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { rankByPoints } from '@/lib/desperation/scoring'
import type { BoardPayload, WeekScore } from '@/lib/desperation/types'
import { fmtLockCT } from './format'
import { WeekScoreLine } from './week-score-line'

interface Props {
  board: BoardPayload
}

/**
 * Season standings (finalized weeks only) with a live column for the week being
 * viewed. The week cell is X/Y · max for the viewer at all times and for others
 * once the week is locked; a dash until then.
 */
export function StandingsPanel({ board }: Props) {
  const { week, entries } = board
  const ranked = useMemo(() => {
    const rows = rankByPoints(entries.map((e) => ({ entryId: e.id, points: e.seasonPoints })))
    const byId = new Map(entries.map((e) => [e.id, e]))
    return rows.map((r) => ({ ...r, entry: byId.get(r.entryId)! }))
  }, [entries])

  const weekDone = week.status === 'final'
  const hiddenTitle = `Hidden until ${fmtLockCT(week.lock_at)}`

  const weekCell = (score: WeekScore | null) =>
    score ? (
      <WeekScoreLine score={score} />
    ) : (
      <span className="text-muted-foreground" title={hiddenTitle}>&mdash;</span>
    )

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium sm:px-3">#</th>
              <th className="px-2 py-2 text-left font-medium sm:px-3">Player</th>
              <th className="px-2 py-2 text-right font-medium sm:px-3">Week {week.week_number}</th>
              <th className="px-2 py-2 text-right font-medium sm:px-3">Season</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.entryId} className={cn('border-t', r.entry.isMe && 'bg-primary/5')}>
                <td className="px-2 py-2 tabular-nums text-muted-foreground sm:px-3">
                  {r.tied ? `T${r.rank}` : r.rank}
                </td>
                <td className={cn('max-w-[10rem] truncate px-2 py-2 sm:max-w-none sm:px-3', r.entry.isMe && 'font-semibold text-primary')}>
                  {r.entry.name}{r.entry.isMe && ' (you)'}
                </td>
                <td className="px-2 py-2 text-right sm:px-3">{weekCell(r.entry.score)}</td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums sm:px-3">{r.points}</td>
              </tr>
            ))}
            {ranked.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No entries yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {weekDone
          ? `Week ${week.week_number} is final and counted in Season.`
          : `Week ${week.week_number} points join the Season total when the week's last game ends.`}{' '}
        Ties share a rank. There are no tiebreakers.
      </p>
    </div>
  )
}
