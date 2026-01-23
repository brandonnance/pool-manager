'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTierColor } from '@/lib/golf/types'
import type { UnicornTeam } from '@/lib/golf/unicorn'

interface UnicornCardProps {
  unicornTeam: UnicornTeam
}

function formatScore(score: number): string {
  if (score === 0) return 'E'
  if (score > 0) return `+${score}`
  return score.toString()
}

export function UnicornCard({ unicornTeam }: UnicornCardProps) {
  const { golfers, totalScore, totalTierPoints, alternativeCount } = unicornTeam

  // Format thru display - show CUT if missed cut, F if finished, hole number otherwise
  const getThruDisplay = (golfer: (typeof golfers)[0]) => {
    if (!golfer.madeCut) return 'CUT'
    if (golfer.thru === 18) return 'F'
    if (golfer.thru === null || golfer.thru === undefined) {
      // If thru is null but we have a completed round score, infer they finished
      if (
        golfer.round1 !== null ||
        golfer.round2 !== null ||
        golfer.round3 !== null ||
        golfer.round4 !== null
      ) {
        return 'F'
      }
      return '-'
    }
    return golfer.thru.toString()
  }

  // Format round score - show 80 for cut players in R3/R4
  const formatRound = (golfer: (typeof golfers)[0], score: number | null, roundNum: number): string => {
    if (!golfer.madeCut && (roundNum === 3 || roundNum === 4)) {
      return '80'
    }
    if (score === null || score === undefined) return '-'
    return score.toString()
  }

  return (
    <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg text-amber-800">Optimal Team</CardTitle>
          </div>
          <div
            className={cn(
              'font-mono font-bold text-xl',
              totalScore < 0 && 'text-green-600',
              totalScore > 0 && 'text-red-600',
              totalScore === 0 && 'text-gray-700'
            )}
          >
            {formatScore(totalScore)}
          </div>
        </div>
        <CardDescription className="text-amber-700">
          The best possible 6-golfer roster
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Column Headers - Desktop only */}
        <div className="hidden sm:grid grid-cols-[2.5rem_1fr_3rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-1 text-xs font-medium text-amber-700 uppercase tracking-wide pt-2 pb-1 px-3">
          <span>POS</span>
          <span>GOLFER</span>
          <span className="text-right">TOT</span>
          <span className="text-center">THR</span>
          <span className="text-center">R1</span>
          <span className="text-center">R2</span>
          <span className="text-center">R3</span>
          <span className="text-center">R4</span>
        </div>

        {/* Mobile Header */}
        <div className="sm:hidden grid grid-cols-[2rem_2.5rem_2rem_2rem_2rem_2rem_2rem] gap-1 text-xs font-medium text-amber-700 uppercase tracking-wide pt-2 pb-1 px-2">
          <span>POS</span>
          <span className="text-right">TOT</span>
          <span className="text-center">THR</span>
          <span className="text-center">R1</span>
          <span className="text-center">R2</span>
          <span className="text-center">R3</span>
          <span className="text-center">R4</span>
        </div>

        {/* Golfer Rows */}
        <div className="grid gap-1">
          {golfers.map((golfer) => {
            const isDropped = !golfer.counted
            const thruDisplay = getThruDisplay(golfer)

            return (
              <div
                key={golfer.golferId}
                className={cn(
                  'rounded border',
                  isDropped ? 'bg-red-50 border-red-200' : 'bg-white border-amber-100',
                  !golfer.madeCut && 'opacity-60'
                )}
              >
                {/* Mobile: Name row */}
                <div className="sm:hidden flex items-center gap-1.5 px-2 pt-1.5 pb-0.5">
                  <span
                    className={cn(
                      'w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-xs text-white font-medium',
                      getTierColor(golfer.tier)
                    )}
                  >
                    {golfer.tier}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-medium truncate',
                      !golfer.madeCut && 'line-through text-muted-foreground'
                    )}
                  >
                    {golfer.golferName}
                  </span>
                </div>

                {/* Mobile: Stats row */}
                <div className="sm:hidden grid grid-cols-[2rem_2.5rem_2rem_2rem_2rem_2rem_2rem] gap-1 text-sm px-2 pb-1.5 items-center font-mono">
                  <span className="text-muted-foreground text-xs">{golfer.position}</span>
                  <span
                    className={cn(
                      'font-bold text-right',
                      golfer.score < 0 && 'text-green-600',
                      golfer.score > 0 && 'text-red-600'
                    )}
                  >
                    {formatScore(golfer.score)}
                  </span>
                  <span
                    className={cn(
                      'text-center text-xs',
                      !golfer.madeCut ? 'text-red-600 font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {thruDisplay}
                  </span>
                  <span className="text-center text-muted-foreground text-xs">
                    {formatRound(golfer, golfer.round1, 1)}
                  </span>
                  <span className="text-center text-muted-foreground text-xs">
                    {formatRound(golfer, golfer.round2, 2)}
                  </span>
                  <span
                    className={cn('text-center text-xs', !golfer.madeCut ? 'text-red-600' : 'text-muted-foreground')}
                  >
                    {formatRound(golfer, golfer.round3, 3)}
                  </span>
                  <span
                    className={cn('text-center text-xs', !golfer.madeCut ? 'text-red-600' : 'text-muted-foreground')}
                  >
                    {formatRound(golfer, golfer.round4, 4)}
                  </span>
                </div>

                {/* Desktop: Single row layout */}
                <div className="hidden sm:grid grid-cols-[2.5rem_1fr_3rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-1 text-sm py-1.5 px-3 items-center font-mono">
                  {/* Position */}
                  <span className="text-muted-foreground text-xs">{golfer.position}</span>

                  {/* Golfer name with tier badge */}
                  <div className="flex items-center gap-1.5 font-sans min-w-0">
                    <span
                      className={cn(
                        'w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-xs text-white font-medium',
                        getTierColor(golfer.tier)
                      )}
                    >
                      {golfer.tier}
                    </span>
                    <span
                      className={cn('truncate', !golfer.madeCut && 'line-through text-muted-foreground')}
                    >
                      {golfer.golferName}
                    </span>
                  </div>

                  {/* Total to-par */}
                  <span
                    className={cn(
                      'font-bold text-right',
                      golfer.score < 0 && 'text-green-600',
                      golfer.score > 0 && 'text-red-600'
                    )}
                  >
                    {formatScore(golfer.score)}
                  </span>

                  {/* Thru */}
                  <span
                    className={cn(
                      'text-center text-xs',
                      !golfer.madeCut ? 'text-red-600 font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {thruDisplay}
                  </span>

                  {/* R1-R4 */}
                  <span className="text-center text-muted-foreground">
                    {formatRound(golfer, golfer.round1, 1)}
                  </span>
                  <span className="text-center text-muted-foreground">
                    {formatRound(golfer, golfer.round2, 2)}
                  </span>
                  <span
                    className={cn('text-center', !golfer.madeCut ? 'text-red-600' : 'text-muted-foreground')}
                  >
                    {formatRound(golfer, golfer.round3, 3)}
                  </span>
                  <span
                    className={cn('text-center', !golfer.madeCut ? 'text-red-600' : 'text-muted-foreground')}
                  >
                    {formatRound(golfer, golfer.round4, 4)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer with tier points and alternative count */}
        <div className="mt-3 pt-2 border-t border-amber-200 text-sm text-amber-700 flex items-center justify-between">
          <span>Tier Points: {totalTierPoints}</span>
          {alternativeCount > 0 && (
            <span className="text-amber-600">
              {alternativeCount} other combination{alternativeCount !== 1 ? 's' : ''} also achieve{' '}
              {formatScore(totalScore)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
