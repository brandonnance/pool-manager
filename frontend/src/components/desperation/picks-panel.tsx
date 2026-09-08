'use client'

import { useMemo } from 'react'
import { Flame, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canEditPick } from '@/lib/desperation/visibility'
import { scoreWeek, summarizeWeekScore } from '@/lib/desperation/scoring'
import type { NdGame, NdWeek, Selection } from '@/lib/desperation/types'
import { GameCard } from './game-card'
import { fmtKickoffLong } from './format'

interface Props {
  week: NdWeek
  games: NdGame[]
  picks: Record<string, Selection>
  saving: Set<string>
  now: number
  onPick: (gameId: string, sel: Selection | null) => void
}

/** Group games by identical kickoff time, in order. */
function groupByKickoff(games: NdGame[]) {
  const groups: Array<{ key: string; label: string; games: NdGame[] }> = []
  for (const g of games) {
    const last = groups[groups.length - 1]
    if (last && last.key === g.kickoff_at) last.games.push(g)
    else groups.push({ key: g.kickoff_at, label: fmtKickoffLong(g.kickoff_at), games: [g] })
  }
  return groups
}

const STATE_TEXT = {
  no_picks: 'Zero picks scores zero',
  alive: 'All must hit or you get 0',
  busted: 'One pick lost — 0 this week',
  perfect: 'Perfect week',
} as const

export function PicksPanel({ week, games, picks, saving, now, onPick }: Props) {
  const groups = useMemo(() => groupByKickoff(games), [games])
  const nowDate = new Date(now)
  // Same scorer the board and standings use, so the footer agrees with them
  // (voided picks drop out of the denominator and the max).
  const summary = useMemo(
    () => summarizeWeekScore(scoreWeek(Object.entries(picks).map(([game_id, selection]) => ({ game_id, selection })), games)),
    [picks, games]
  )
  const count = summary.counted

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <p>
          <span className="font-medium text-foreground">Picks save automatically.</span> Tap a team to pick it, tap it again to
          clear. There&apos;s no submit button. Each game locks at kickoff, and everything locks Sunday at noon Central.
        </p>
      </div>
      <div className="space-y-6">
        {groups.map((grp) => (
          <section key={grp.key}>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {grp.label}
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              {grp.games.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  selection={picks[g.id]}
                  editable={canEditPick(g, week, nowDate)}
                  saving={saving.has(g.id)}
                  onSelect={(sel) => onPick(g.id, sel)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Sticky summary */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 md:max-w-4xl">
          <div className="flex items-center gap-2">
            <Flame
              className={cn(
                'size-5',
                summary.state === 'busted'
                  ? 'text-muted-foreground/50'
                  : count >= 8 ? 'text-orange-500' : count >= 4 ? 'text-amber-500' : 'text-muted-foreground'
              )}
            />
            <div>
              <div className="text-sm font-semibold tabular-nums">
                {summary.state === 'no_picks' ? '0 picks' : (
                  <>
                    {summary.right}/{count} <span className="font-normal text-muted-foreground">right</span>
                    {summary.voided > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">({summary.voided} voided)</span>}
                  </>
                )}
              </div>
              <div className={cn('text-xs', summary.state === 'busted' ? 'text-red-600' : summary.state === 'perfect' ? 'text-emerald-700' : 'text-muted-foreground')}>
                {STATE_TEXT[summary.state]}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={cn('text-2xl font-bold tabular-nums leading-none', summary.state === 'busted' && 'text-red-600', summary.state === 'perfect' && 'text-emerald-700')}>
              {summary.points}
            </div>
            <div className={cn('text-xs', summary.state === 'busted' ? 'text-red-600' : 'text-muted-foreground')}>
              {summary.state === 'busted' ? 'busted' : summary.pointsLabel === 'max' ? 'max pts' : 'pts'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
