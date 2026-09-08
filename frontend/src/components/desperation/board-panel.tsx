'use client'

import { useMemo } from 'react'
import { EyeOff, Skull, Trophy, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { entryWeekState, summarizeWeekScore } from '@/lib/desperation/scoring'
import type { BoardPayload, NdGame, Selection } from '@/lib/desperation/types'
import { fmtLockCT } from './format'
import { WeekNav } from './week-nav'
import { WeekScoreLine } from './week-score-line'

interface Props {
  board: BoardPayload
  viewWeek: number
  onChangeWeek: (w: number) => void
}

function pickOutcome(game: NdGame, sel: Selection): 'won' | 'lost' | 'tie' | 'live' | 'pending' {
  if (game.status === 'final') {
    if (game.winner === 'tie') return 'tie'
    return game.winner === sel ? 'won' : 'lost'
  }
  if (game.status === 'in_progress') return 'live'
  return 'pending'
}

function StateBadge({ state }: { state: ReturnType<typeof entryWeekState> }) {
  switch (state) {
    case 'busted':
      return <Badge variant="destructive" className="gap-1"><Skull className="size-3" /> Busted</Badge>
    case 'perfect':
      return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><Trophy className="size-3" /> Perfect</Badge>
    case 'alive':
      return <Badge variant="secondary" className="gap-1 text-emerald-700"><Activity className="size-3" /> Alive</Badge>
    default:
      return <Badge variant="outline">No picks</Badge>
  }
}

/**
 * Week board. Before the Sunday-noon lock only the viewer's own row carries
 * picks and a score; every other row is name-only. After the lock, everyone's
 * picks (with live/won/lost coloring) and X/Y · max lines are shown, sorted
 * alive-by-max first, busted last.
 */
export function BoardPanel({ board, viewWeek, onChangeWeek }: Props) {
  const { week, games, entries, countsVisible } = board

  const sorted = useMemo(() => {
    const rows = [...entries]
    if (countsVisible) {
      rows.sort((a, b) => {
        const sa = a.score, sb = b.score
        if (sa && sb) {
          if (sa.busted !== sb.busted) return sa.busted ? 1 : -1
          const pa = summarizeWeekScore(sa).points, pb = summarizeWeekScore(sb).points
          if (pb !== pa) return pb - pa
          if (sb.correct !== sa.correct) return sb.correct - sa.correct
        }
        return a.name.localeCompare(b.name)
      })
    } else {
      rows.sort((a, b) => (a.isMe ? -1 : b.isMe ? 1 : a.name.localeCompare(b.name)))
    }
    return rows
  }, [entries, countsVisible])

  return (
    <div className="space-y-3">
      <WeekNav board={board} viewWeek={viewWeek} onChangeWeek={onChangeWeek} />

      {!countsVisible && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          <EyeOff className="mt-0.5 size-4 shrink-0" />
          <div>
            Everyone&apos;s picks, counts, and points stay hidden until{' '}
            <span className="font-medium text-foreground">{fmtLockCT(week.lock_at)}</span>. Only you can see yours.
          </div>
        </div>
      )}

      <ul className="grid gap-2 md:grid-cols-2">
        {sorted.map((e) => {
          const state = e.score ? entryWeekState(e.score) : null
          // Server already gated e.picks: own picks always, others' only once the week is locked
          const revealed = games
            .map((g) => ({ g, sel: e.picks[g.id] }))
            .filter((x): x is { g: NdGame; sel: Selection } => !!x.sel)
          return (
            <li key={e.id} className={cn('rounded-xl border bg-card p-3', e.isMe && 'border-primary/60 ring-1 ring-primary/30')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('font-medium', e.isMe && 'text-primary')}>{e.name}{e.isMe && ' (you)'}</span>
                {state && <StateBadge state={state} />}
                {e.score && <WeekScoreLine score={e.score} className="ml-auto text-sm" />}
              </div>
              {revealed.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {revealed.map(({ g, sel }) => {
                    const o = pickOutcome(g, sel)
                    const abbr = sel === 'home' ? g.home_abbr : g.away_abbr
                    return (
                      <span
                        key={g.id}
                        className={cn(
                          'rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums',
                          o === 'won' && 'border-emerald-600 bg-emerald-50 text-emerald-800',
                          o === 'lost' && 'border-red-500 bg-red-50 text-red-700 line-through',
                          o === 'tie' && 'border-border bg-muted text-muted-foreground line-through',
                          o === 'live' && 'border-amber-500 bg-amber-50 text-amber-800',
                          o === 'pending' && 'border-border text-foreground'
                        )}
                        title={`${g.away_abbr} @ ${g.home_abbr}`}
                      >
                        {abbr}
                      </span>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
