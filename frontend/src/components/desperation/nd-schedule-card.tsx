'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarDays, RefreshCw, Loader2, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { NdWeek, NdGame } from '@/lib/desperation/types'
import { REGULAR_SEASON_WEEKS } from '@/lib/desperation/schedule'
import { fmtKickoffLong, fmtLockCT, fmtPeriod } from './format'

interface Props {
  seasonYear: number
  weeks: NdWeek[]
  currentWeek: NdWeek | null
  currentGames: NdGame[]
  isCommissioner: boolean
}

export function NdScheduleCard({ seasonYear, weeks, currentWeek, currentGames, isCommissioner }: Props) {
  const router = useRouter()
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadSchedule = async () => {
    setLoadingSchedule(true)
    try {
      const res = await fetch('/api/desperation/sync-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonYear }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      const total = (data.results as Array<{ games: number }>).reduce((n, r) => n + r.games, 0)
      const errors = (data.results as Array<{ week: number; error?: string }>).filter((r) => r.error)
      toast.success(`Loaded ${total} games across ${data.results.length} weeks${errors.length ? ` (${errors.length} weeks failed)` : ''}`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoadingSchedule(false)
    }
  }

  const refreshScores = async () => {
    if (!currentWeek) return
    setRefreshing(true)
    try {
      const res = await fetch('/api/desperation/sync-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonYear, week: currentWeek.week_number, force: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success(data.synced ? `Refreshed ${data.updated} games` : `Skipped (${data.reason})`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4" /> Schedule
        </CardTitle>
        <Badge variant={weeks.length === REGULAR_SEASON_WEEKS ? 'secondary' : 'outline'}>
          {weeks.length}/{REGULAR_SEASON_WEEKS} weeks
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCommissioner && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={loadSchedule} disabled={loadingSchedule}>
              {loadingSchedule ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {weeks.length === 0 ? 'Load schedule from ESPN' : 'Re-sync schedule'}
            </Button>
            {currentWeek && (
              <Button size="sm" variant="outline" onClick={refreshScores} disabled={refreshing}>
                {refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Refresh scores
              </Button>
            )}
          </div>
        )}

        {currentWeek ? (
          <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold">Week {currentWeek.week_number}</span>
              <Badge variant="outline" className="capitalize">{currentWeek.status.replace('_', ' ')}</Badge>
              <span className="text-muted-foreground">Lock: {fmtLockCT(currentWeek.lock_at)}</span>
              <span className="text-muted-foreground">{currentGames.length} games</span>
            </div>
            <ul className="divide-y rounded-lg border text-sm">
              {currentGames.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="truncate">
                    <span className="font-medium">{g.away_abbr}</span> @ <span className="font-medium">{g.home_abbr}</span>
                    {g.neutral_site && <span className="ml-1 text-xs text-muted-foreground">(neutral)</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {g.status === 'final' ? (
                      <span className={g.winner === 'tie' ? 'text-amber-600' : ''}>
                        {g.away_score}–{g.home_score} F{g.winner === 'tie' ? ' (tie)' : ''}
                      </span>
                    ) : g.status === 'in_progress' ? (
                      <span className="text-red-600">{g.away_score}–{g.home_score} · {fmtPeriod(g.period, g.clock)}</span>
                    ) : g.status === 'scheduled' ? (
                      fmtKickoffLong(g.kickoff_at)
                    ) : (
                      <span className="uppercase text-xs">{g.status}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No schedule loaded yet. {isCommissioner ? 'Load it from ESPN to open the pool.' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
