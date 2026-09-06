'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BoardPayload } from '@/lib/desperation/types'

interface Props {
  board: BoardPayload
  viewWeek: number
  onChangeWeek: (w: number) => void
}

/**
 * Prev / "Week N" / Next. Forward navigation stops at the current week, or at
 * the next week once the current week has hit its Sunday-noon lock.
 */
export function WeekNav({ board, viewWeek, onChangeWeek }: Props) {
  const { week, weeks, currentWeek, nextOpenWeek } = board
  const minWeek = weeks[0]?.week_number ?? 1
  const maxWeek = nextOpenWeek ?? currentWeek ?? weeks[weeks.length - 1]?.week_number ?? 1
  const label =
    week.week_number === nextOpenWeek ? 'Open early' : week.status.replace('_', ' ')

  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="icon" disabled={viewWeek <= minWeek} onClick={() => onChangeWeek(viewWeek - 1)} aria-label="Previous week">
        <ChevronLeft />
      </Button>
      <div className="text-center">
        <div className="font-semibold">Week {week.week_number}</div>
        <div className="text-xs text-muted-foreground capitalize">{label}</div>
      </div>
      <Button variant="ghost" size="icon" disabled={viewWeek >= maxWeek} onClick={() => onChangeWeek(viewWeek + 1)} aria-label="Next week">
        <ChevronRight />
      </Button>
    </div>
  )
}
