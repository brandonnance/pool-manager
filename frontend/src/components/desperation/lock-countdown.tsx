'use client'

import { useEffect, useState } from 'react'
import { Lock, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { gameLockAt } from '@/lib/desperation/visibility'
import type { NdGame, NdWeek } from '@/lib/desperation/types'
import { fmtCountdown, fmtLockCT } from './format'

interface Props {
  week: Pick<NdWeek, 'lock_at'>
  games: NdGame[]
  className?: string
}

/**
 * Shows the next lock event: either the next individual kickoff before the
 * week lock, or the week lock itself. Ticks every second.
 */
export function LockCountdown({ week, games, className }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const weekLock = new Date(week.lock_at).getTime()
  const open = games.filter((g) => g.status === 'scheduled' && gameLockAt(g, week).getTime() > now)

  if (open.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Lock className="size-4" />
        <span>All picks locked for this week</span>
      </div>
    )
  }

  const nextLock = Math.min(...open.map((g) => gameLockAt(g, week).getTime()))
  const isWeekLock = nextLock === weekLock
  const lockingNow = open.filter((g) => gameLockAt(g, week).getTime() === nextLock)
  const remaining = nextLock - now
  const urgent = remaining < 60 * 60 * 1000

  const what = isWeekLock
    ? `${open.length} remaining game${open.length === 1 ? '' : 's'} lock`
    : lockingNow.length === 1
      ? `${lockingNow[0].away_abbr} @ ${lockingNow[0].home_abbr} locks`
      : `${lockingNow.length} games lock`

  return (
    <div className={cn('flex items-center gap-2 text-sm', urgent ? 'text-orange-600' : 'text-muted-foreground', className)}>
      <Clock className="size-4 shrink-0" />
      <span>
        {what} in <span className="font-semibold tabular-nums text-foreground">{fmtCountdown(remaining)}</span>
        {isWeekLock && <span className="hidden sm:inline"> · {fmtLockCT(week.lock_at)}</span>}
      </span>
    </div>
  )
}
