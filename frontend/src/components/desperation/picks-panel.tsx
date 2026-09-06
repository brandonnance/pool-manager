'use client'

import { useMemo } from 'react'
import { Flame, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canEditPick } from '@/lib/desperation/visibility'
import { triangular } from '@/lib/desperation/scoring'
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

export function PicksPanel({ week, games, picks, saving, now, onPick }: Props) {
  const groups = useMemo(() => groupByKickoff(games), [games])
  const nowDate = new Date(now)
  const count = Object.keys(picks).filter((id) => games.some((g) => g.id === id)).length
  const pts = triangular(count)

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
            <Flame className={cn('size-5', count >= 8 ? 'text-orange-500' : count >= 4 ? 'text-amber-500' : 'text-muted-foreground')} />
            <div>
              <div className="text-sm font-semibold">
                {count} pick{count === 1 ? '' : 's'}
              </div>
              <div className="text-xs text-muted-foreground">
                {count === 0 ? 'Zero picks scores zero' : 'All must hit or you get 0'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums leading-none">{pts}</div>
            <div className="text-xs text-muted-foreground">pts if perfect</div>
          </div>
        </div>
      </div>
    </div>
  )
}
