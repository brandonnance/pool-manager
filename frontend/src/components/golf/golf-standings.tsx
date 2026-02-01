'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTierColor } from '@/lib/golf/types'

interface GolferScore {
  golferId: string
  golferName: string
  tier: number
  round1: number | null
  round2: number | null
  round3: number | null
  round4: number | null
  totalScore: number // This is now to-par, not stroke total
  toPar?: number
  thru?: number | null
  position?: string | null
  madeCut: boolean
  status?: string // 'active' | 'cut' | 'withdrawn' | 'dq'
  counted: boolean
}

// Format a to-par score for display (E, +5, -3, etc.)
function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E'
  if (toPar > 0) return `+${toPar}`
  return toPar.toString()
}

interface EntryStanding {
  entryId: string
  entryName: string | null
  userName: string | null
  userId: string
  rank: number
  tied: boolean
  score: number | null
  golferScores: GolferScore[]
}

interface GolfStandingsProps {
  standings: EntryStanding[]
  currentUserId: string
  tournamentStatus: 'upcoming' | 'in_progress' | 'completed'
  parPerRound: number
  totalPar: number
}

export function GolfStandings({ standings, currentUserId, tournamentStatus }: GolfStandingsProps) {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())

  function toggleEntry(entryId: string) {
    setExpandedEntries(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }

  if (standings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No entries yet. Be the first to make picks!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Standings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {standings.map(entry => {
            const isExpanded = expandedEntries.has(entry.entryId)
            const isCurrentUser = entry.userId === currentUserId
            const isWinner = entry.rank === 1 && tournamentStatus === 'completed'

            return (
              <div key={entry.entryId}>
                <button
                  onClick={() => toggleEntry(entry.entryId)}
                  className={cn(
                    'w-full flex items-center justify-between py-3 px-2 hover:bg-muted/50 transition-colors rounded-md',
                    isCurrentUser && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <div className={cn(
                      'w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold',
                      entry.rank === 1 && 'bg-yellow-100 text-yellow-700',
                      entry.rank === 2 && 'bg-gray-100 text-gray-700',
                      entry.rank === 3 && 'bg-amber-100 text-amber-700',
                      entry.rank > 3 && 'bg-muted text-muted-foreground'
                    )}>
                      {entry.tied ? 'T' : ''}{entry.rank}
                    </div>

                    {/* Entry Info */}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-medium',
                          isCurrentUser && 'text-primary'
                        )}>
                          {entry.userName ?? 'Unknown'}
                        </span>
                        {entry.entryName && entry.entryName !== 'Entry 1' && (
                          <span className="text-sm text-muted-foreground">
                            ({entry.entryName})
                          </span>
                        )}
                        {isCurrentUser && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                        {isWinner && (
                          <Badge className="bg-yellow-500 text-xs">Winner</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Score - entry.score is already to-par */}
                    <div className="text-right">
                      {entry.score !== null ? (
                        <div className={cn(
                          'font-mono font-bold text-lg',
                          entry.score < 0 && 'text-green-600',
                          entry.score > 0 && 'text-red-600'
                        )}>
                          {formatToPar(entry.score)}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">-</div>
                      )}
                    </div>

                    {/* Expand/Collapse */}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && entry.golferScores.length > 0 && (
                  <div className="px-2 pb-4">
                    {/* Column Headers */}
                    <div className="grid grid-cols-[2.5rem_1fr_3rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-2">
                      <span>POS</span>
                      <span>GOLFER</span>
                      <span className="text-right">TOT</span>
                      <span className="text-center">THR</span>
                      <span className="text-center">R1</span>
                      <span className="text-center">R2</span>
                      <span className="text-center">R3</span>
                      <span className="text-center">R4</span>
                    </div>

                    {/* Counted Golfers (Best 4) */}
                    <div className="space-y-1 mb-3">
                      {entry.golferScores
                        .filter(g => g.counted)
                        .map(golfer => (
                          <GolferScoreRow key={golfer.golferId} golfer={golfer} />
                        ))}
                    </div>

                    {/* Dropped Golfers (Worst 2) */}
                    {entry.golferScores.filter(g => !g.counted).length > 0 && (
                      <div className="space-y-1 opacity-50">
                        <div className="text-xs text-muted-foreground px-2 pt-1 border-t">Dropped</div>
                        {entry.golferScores
                          .filter(g => !g.counted)
                          .map(golfer => (
                            <GolferScoreRow key={golfer.golferId} golfer={golfer} />
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function GolferScoreRow({ golfer }: { golfer: GolferScore }) {
  // golfer.totalScore is already to-par
  const toPar = golfer.totalScore
  const isWithdrawn = golfer.status === 'withdrawn'
  const isDQ = golfer.status === 'dq'
  const hasNegativeStatus = isWithdrawn || isDQ || !golfer.madeCut

  // Format thru display - show WD/DQ/CUT if applicable, F if finished round, hole number otherwise
  const getThruDisplay = () => {
    if (isWithdrawn) return 'WD'
    if (isDQ) return 'DQ'
    if (!golfer.madeCut) return 'CUT'
    if (golfer.thru === 18) return 'F'
    // If thru is null but we have a completed round score, infer they finished
    // Check the most recent round that has a score
    if (golfer.thru === null || golfer.thru === undefined) {
      // If any round score exists, they've finished at least that round
      if (golfer.round1 !== null || golfer.round2 !== null || golfer.round3 !== null || golfer.round4 !== null) {
        return 'F'
      }
      return '-'
    }
    return golfer.thru.toString()
  }

  // Format round score - WD/DQ players show 80 for all rounds, cut players show 80 for R3/R4
  const formatRound = (score: number | null, roundNum: number): string => {
    if (isWithdrawn || isDQ) {
      return '80'
    }
    if (!golfer.madeCut && (roundNum === 3 || roundNum === 4)) {
      return '80'
    }
    if (score === null || score === undefined) return '-'
    return score.toString()
  }

  return (
    <div className="grid grid-cols-[2.5rem_1fr_3rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-1 py-1.5 px-2 rounded bg-muted/30 text-sm font-mono items-center">
      {/* Position */}
      <span className="text-muted-foreground text-xs">{golfer.position ?? '-'}</span>

      {/* Golfer name with tier badge */}
      <div className="flex items-center gap-1.5 font-sans min-w-0">
        <span className={cn(
          'w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-xs text-white font-medium',
          getTierColor(golfer.tier)
        )}>
          {golfer.tier}
        </span>
        <span className={cn('truncate', hasNegativeStatus && 'line-through text-muted-foreground')}>
          {golfer.golferName}
        </span>
      </div>

      {/* Total to-par */}
      <span className={cn(
        'text-right font-bold',
        toPar < 0 && 'text-green-600',
        toPar > 0 && 'text-red-600'
      )}>
        {formatToPar(toPar)}
      </span>

      {/* Thru */}
      <span className={cn(
        'text-center text-xs',
        hasNegativeStatus ? 'text-red-600 font-medium' : 'text-muted-foreground'
      )}>
        {getThruDisplay()}
      </span>

      {/* R1-R4 */}
      <span className={cn(
        'text-center text-muted-foreground',
        (isWithdrawn || isDQ) && 'text-red-600'
      )}>{formatRound(golfer.round1, 1)}</span>
      <span className={cn(
        'text-center text-muted-foreground',
        (isWithdrawn || isDQ) && 'text-red-600'
      )}>{formatRound(golfer.round2, 2)}</span>
      <span className={cn(
        'text-center',
        hasNegativeStatus ? 'text-red-600' : 'text-muted-foreground'
      )}>
        {formatRound(golfer.round3, 3)}
      </span>
      <span className={cn(
        'text-center',
        hasNegativeStatus ? 'text-red-600' : 'text-muted-foreground'
      )}>
        {formatRound(golfer.round4, 4)}
      </span>
    </div>
  )
}
