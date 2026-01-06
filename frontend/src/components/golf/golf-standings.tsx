'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTierColor, getTierLabel } from '@/lib/golf/types'
import { formatRoundScore, formatScoreToPar } from '@/lib/golf/scoring'

interface GolferScore {
  golferId: string
  golferName: string
  tier: number
  round1: number | null
  round2: number | null
  round3: number | null
  round4: number | null
  totalScore: number
  madeCut: boolean
  counted: boolean
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

export function GolfStandings({ standings, currentUserId, tournamentStatus, parPerRound, totalPar }: GolfStandingsProps) {
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

            // Calculate effective par for entry based on counted golfers' rounds played
            const countedGolfers = entry.golferScores.filter(g => g.counted)
            const totalRoundsPlayed = countedGolfers.reduce((sum, g) => sum + countRoundsPlayed(g), 0)
            const entryEffectivePar = parPerRound * totalRoundsPlayed

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
                    {/* Score */}
                    <div className="text-right">
                      {entry.score !== null && totalRoundsPlayed > 0 ? (
                        <div className="flex flex-col items-end">
                          <div className={cn(
                            'font-mono font-bold text-lg',
                            entry.score < entryEffectivePar && 'text-green-600',
                            entry.score > entryEffectivePar && 'text-red-600'
                          )}>
                            {formatScoreToPar(entry.score, entryEffectivePar)}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {entry.score}
                          </div>
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
                    {/* Counted Golfers (Best 4) */}
                    <div className="mb-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Counted (Best 4)
                      </div>
                      <div className="space-y-1">
                        {entry.golferScores
                          .filter(g => g.counted)
                          .map(golfer => (
                            <GolferScoreRow key={golfer.golferId} golfer={golfer} parPerRound={parPerRound} />
                          ))}
                      </div>
                    </div>

                    {/* Dropped Golfers (Worst 2) */}
                    {entry.golferScores.filter(g => !g.counted).length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Dropped (Worst 2)
                        </div>
                        <div className="space-y-1 opacity-60">
                          {entry.golferScores
                            .filter(g => !g.counted)
                            .map(golfer => (
                              <GolferScoreRow key={golfer.golferId} golfer={golfer} parPerRound={parPerRound} />
                            ))}
                        </div>
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

// Count how many rounds a golfer has actually played
function countRoundsPlayed(golfer: GolferScore): number {
  let count = 0
  if (golfer.round1 !== null) count++
  if (golfer.round2 !== null) count++
  // For missed cut, they've "played" 4 rounds (with penalty scores)
  if (!golfer.madeCut) return 4
  if (golfer.round3 !== null) count++
  if (golfer.round4 !== null) count++
  return count
}

function GolferScoreRow({ golfer, parPerRound }: { golfer: GolferScore; parPerRound: number }) {
  const roundsPlayed = countRoundsPlayed(golfer)
  const effectivePar = parPerRound * roundsPlayed
  const scoreToPar = roundsPlayed > 0 ? formatScoreToPar(golfer.totalScore, effectivePar) : '-'

  return (
    <div className="flex items-center justify-between py-1 px-2 rounded bg-muted/30">
      <div className="flex items-center gap-2">
        <span className={cn(
          'w-5 h-5 flex items-center justify-center rounded text-xs text-white font-medium',
          getTierColor(golfer.tier)
        )}>
          {golfer.tier}
        </span>
        <span className="text-sm">{golfer.golferName}</span>
        {!golfer.madeCut && (
          <Badge variant="destructive" className="text-xs">CUT</Badge>
        )}
      </div>

      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-muted-foreground">{formatRoundScore(golfer.round1)}</span>
        <span className="text-muted-foreground">{formatRoundScore(golfer.round2)}</span>
        {golfer.madeCut ? (
          <>
            <span className="text-muted-foreground">{formatRoundScore(golfer.round3)}</span>
            <span className="text-muted-foreground">{formatRoundScore(golfer.round4)}</span>
          </>
        ) : (
          <>
            <span className="text-destructive">+80</span>
            <span className="text-destructive">+80</span>
          </>
        )}
        <span className={cn(
          'font-bold ml-2 min-w-[40px] text-right',
          roundsPlayed > 0 && golfer.totalScore < effectivePar && 'text-green-600',
          roundsPlayed > 0 && golfer.totalScore > effectivePar && 'text-red-600'
        )}>
          {scoreToPar}
        </span>
        <span className="text-xs text-muted-foreground w-8 text-right">{golfer.totalScore}</span>
      </div>
    </div>
  )
}
