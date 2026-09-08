'use client'

import { cn } from '@/lib/utils'
import { summarizeWeekScore } from '@/lib/desperation/scoring'
import type { WeekScore } from '@/lib/desperation/types'

interface Props {
  score: WeekScore
  className?: string
}

/**
 * Compact "3/7 · 28 max" line for board rows and standings cells.
 *   alive    → 3/7 · 28 max
 *   busted   → 3/7 · 0 busted
 *   perfect  → 7/7 · 28 pts
 *   no picks → 0 picks · 0
 * Voided picks (tie / canceled) are dropped from the denominator and noted.
 */
export function WeekScoreLine({ score, className }: Props) {
  const s = summarizeWeekScore(score)
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 whitespace-nowrap tabular-nums', className)}>
      {s.state === 'no_picks' ? (
        <span className="text-muted-foreground">0 picks</span>
      ) : (
        <span>
          <span className="font-medium">{s.right}/{s.counted}</span>
          {s.voided > 0 && <span className="ml-1 text-xs text-muted-foreground">({s.voided} voided)</span>}
        </span>
      )}
      <span className="text-muted-foreground">·</span>
      <span
        className={cn(
          'font-semibold',
          s.state === 'busted' && 'text-red-600',
          s.state === 'perfect' && 'text-emerald-700'
        )}
      >
        {s.points}
        <span className={cn('ml-0.5 text-xs font-normal', s.state === 'busted' ? 'text-red-600' : 'text-muted-foreground')}>
          {s.state === 'busted' ? 'busted' : s.state === 'no_picks' ? '' : s.pointsLabel}
        </span>
      </span>
    </span>
  )
}
