'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Trophy, MapPin, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTierColor } from '@/lib/golf/types'
import { UnicornCard } from './unicorn-card'
import type { UnicornTeam } from '@/lib/golf/unicorn'

interface Pick {
  golferId: string
  golferName: string
  tier: number
  score: number
  position: string
  madeCut: boolean
  thru: number | null
  round1: number | null
  round2: number | null
  round3: number | null
  round4: number | null
  counted?: boolean
}

interface Entry {
  id: string
  entryName: string
  participantName: string | null
  totalScore: number
  picks: Pick[]
}

interface GolfPublicLeaderboardProps {
  poolName: string
  tournamentName: string
  tournamentVenue: string | null
  lockTime: string | null
  entries: Entry[]
  tournamentId: string
  unicornTeam?: UnicornTeam | null
}

function formatScore(score: number): string {
  if (score === 0) return 'E'
  if (score > 0) return `+${score}`
  return score.toString()
}

export function GolfPublicLeaderboard({
  poolName,
  tournamentName,
  tournamentVenue,
  entries,
  unicornTeam,
}: GolfPublicLeaderboardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)

  // Calculate rankings on FULL list first (handle ties)
  const rankedEntries = useMemo(() => {
    // Count entries at each score to detect ties
    const scoreCounts = new Map<number, number>()
    entries.forEach(entry => {
      scoreCounts.set(entry.totalScore, (scoreCounts.get(entry.totalScore) || 0) + 1)
    })

    let currentRank = 1
    let previousScore: number | null = null

    return entries.map((entry, index) => {
      if (previousScore !== null && entry.totalScore > previousScore) {
        currentRank = index + 1
      }
      previousScore = entry.totalScore

      // Entry is tied if more than one entry has the same score
      const isTied = (scoreCounts.get(entry.totalScore) || 0) > 1

      return {
        ...entry,
        rank: currentRank,
        tied: isTied,
      }
    })
  }, [entries])

  // Filter ranked entries by search query (preserves original rankings)
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return rankedEntries
    const query = searchQuery.toLowerCase()
    return rankedEntries.filter((e) =>
      e.entryName.toLowerCase().includes(query)
    )
  }, [rankedEntries, searchQuery])

  const toggleExpanded = (entryId: string) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{poolName}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Trophy className="h-4 w-4" />
                <span>{tournamentName}</span>
                {tournamentVenue && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <MapPin className="h-4 w-4" />
                    <span>{tournamentVenue}</span>
                  </>
                )}
              </div>
            </div>
            <Badge variant="default">Leaderboard</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        <div className="text-sm text-muted-foreground">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
          {searchQuery && filteredEntries.length !== entries.length && (
            <span> (filtered from {entries.length})</span>
          )}
        </div>

        {/* Unicorn Team */}
        {unicornTeam && <UnicornCard unicornTeam={unicornTeam} />}

        {/* Leaderboard */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Standings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? 'No entries match your search' : 'No entries yet'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredEntries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id
                  const isLeader = entry.rank === 1

                  return (
                    <div key={entry.id}>
                      {/* Entry Row */}
                      <button
                        onClick={() => toggleExpanded(entry.id)}
                        className={cn(
                          'w-full px-4 py-3 flex items-center gap-4 text-left',
                          'hover:bg-muted/50 transition-colors',
                          isLeader && 'bg-amber-50/50'
                        )}
                      >
                        {/* Rank - show T prefix for ties */}
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                          isLeader
                            ? 'bg-amber-100 text-amber-700'
                            : entry.rank <= 3
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-gray-50 text-gray-500'
                        )}>
                          {entry.tied ? 'T' : ''}{entry.rank}
                        </div>

                        {/* Entry Info */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'font-medium truncate',
                            isLeader && 'text-amber-700'
                          )}>
                            {entry.entryName}
                          </p>
                        </div>

                        {/* Score */}
                        <div className={cn(
                          'font-mono font-bold text-lg',
                          entry.totalScore < 0 && 'text-green-600',
                          entry.totalScore > 0 && 'text-red-600'
                        )}>
                          {formatScore(entry.totalScore)}
                        </div>

                        {/* Expand Icon */}
                        <div className="text-muted-foreground">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Picks */}
                      {isExpanded && (
                        <div className="px-2 sm:px-4 pb-4 bg-muted/30">
                          {/* Column Headers - Desktop */}
                          <div className="hidden sm:grid grid-cols-[2.5rem_1fr_3rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 pb-1 px-3">
                            <span>POS</span>
                            <span>GOLFER</span>
                            <span className="text-right">TOT</span>
                            <span className="text-center">THR</span>
                            <span className="text-center">R1</span>
                            <span className="text-center">R2</span>
                            <span className="text-center">R3</span>
                            <span className="text-center">R4</span>
                          </div>
                          {/* Column Headers - Mobile */}
                          <div className="sm:hidden grid grid-cols-[2rem_2.5rem_2rem_2rem_2rem_2rem_2rem] gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2 pb-1 px-2">
                            <span>POS</span>
                            <span className="text-right">TOT</span>
                            <span className="text-center">THR</span>
                            <span className="text-center">R1</span>
                            <span className="text-center">R2</span>
                            <span className="text-center">R3</span>
                            <span className="text-center">R4</span>
                          </div>
                          <div className="grid gap-1">
                            {/* Sort picks by score (best first), show counted vs dropped */}
                            {[...entry.picks].sort((a, b) => a.score - b.score).map((pick) => {
                              // Use the counted flag if available, otherwise fall back to sorting position
                              const isDropped = pick.counted === false
                              // Format thru display - show CUT if missed cut, F if finished, hole number otherwise
                              const getThruDisplay = () => {
                                if (!pick.madeCut) return 'CUT'
                                if (pick.thru === 18) return 'F'
                                // If thru is null but we have a completed round score, infer they finished
                                if (pick.thru === null || pick.thru === undefined) {
                                  if (pick.round1 !== null || pick.round2 !== null || pick.round3 !== null || pick.round4 !== null) {
                                    return 'F'
                                  }
                                  return '-'
                                }
                                return pick.thru.toString()
                              }
                              const thruDisplay = getThruDisplay()

                              // Format round score - show 80 for cut players in R3/R4
                              const formatRound = (score: number | null, roundNum: number): string => {
                                if (!pick.madeCut && (roundNum === 3 || roundNum === 4)) {
                                  return '80'
                                }
                                if (score === null || score === undefined) return '-'
                                return score.toString()
                              }

                              return (
                                <div
                                  key={pick.golferId}
                                  className={cn(
                                    'rounded border',
                                    isDropped ? 'bg-red-50 border-red-200' : 'bg-white',
                                    !pick.madeCut && 'opacity-60'
                                  )}
                                >
                                  {/* Mobile: Name row */}
                                  <div className="sm:hidden flex items-center gap-1.5 px-2 pt-1.5 pb-0.5">
                                    <span className={cn(
                                      'w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-xs text-white font-medium',
                                      getTierColor(pick.tier)
                                    )}>
                                      {pick.tier}
                                    </span>
                                    <span className={cn(
                                      'text-sm font-medium truncate',
                                      !pick.madeCut && 'line-through text-muted-foreground'
                                    )}>
                                      {pick.golferName}
                                    </span>
                                  </div>

                                  {/* Mobile: Stats row */}
                                  <div className="sm:hidden grid grid-cols-[2rem_2.5rem_2rem_2rem_2rem_2rem_2rem] gap-1 text-sm px-2 pb-1.5 items-center font-mono">
                                    <span className="text-muted-foreground text-xs">{pick.position}</span>
                                    <span className={cn(
                                      'font-bold text-right',
                                      pick.score < 0 && 'text-green-600',
                                      pick.score > 0 && 'text-red-600'
                                    )}>
                                      {formatScore(pick.score)}
                                    </span>
                                    <span className={cn(
                                      'text-center text-xs',
                                      !pick.madeCut ? 'text-red-600 font-medium' : 'text-muted-foreground'
                                    )}>
                                      {thruDisplay}
                                    </span>
                                    <span className="text-center text-muted-foreground text-xs">{formatRound(pick.round1, 1)}</span>
                                    <span className="text-center text-muted-foreground text-xs">{formatRound(pick.round2, 2)}</span>
                                    <span className={cn(
                                      'text-center text-xs',
                                      !pick.madeCut ? 'text-red-600' : 'text-muted-foreground'
                                    )}>
                                      {formatRound(pick.round3, 3)}
                                    </span>
                                    <span className={cn(
                                      'text-center text-xs',
                                      !pick.madeCut ? 'text-red-600' : 'text-muted-foreground'
                                    )}>
                                      {formatRound(pick.round4, 4)}
                                    </span>
                                  </div>

                                  {/* Desktop: Single row layout */}
                                  <div className="hidden sm:grid grid-cols-[2.5rem_1fr_3rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-1 text-sm py-1.5 px-3 items-center font-mono">
                                    {/* Position */}
                                    <span className="text-muted-foreground text-xs">
                                      {pick.position}
                                    </span>

                                    {/* Golfer name with tier badge */}
                                    <div className="flex items-center gap-1.5 font-sans min-w-0">
                                      <span className={cn(
                                        'w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-xs text-white font-medium',
                                        getTierColor(pick.tier)
                                      )}>
                                        {pick.tier}
                                      </span>
                                      <span className={cn('truncate', !pick.madeCut && 'line-through text-muted-foreground')}>
                                        {pick.golferName}
                                      </span>
                                    </div>

                                    {/* Total to-par */}
                                    <span className={cn(
                                      'font-bold text-right',
                                      pick.score < 0 && 'text-green-600',
                                      pick.score > 0 && 'text-red-600'
                                    )}>
                                      {formatScore(pick.score)}
                                    </span>

                                    {/* Thru */}
                                    <span className={cn(
                                      'text-center text-xs',
                                      !pick.madeCut ? 'text-red-600 font-medium' : 'text-muted-foreground'
                                    )}>
                                      {thruDisplay}
                                    </span>

                                    {/* R1-R4 */}
                                    <span className="text-center text-muted-foreground">{formatRound(pick.round1, 1)}</span>
                                    <span className="text-center text-muted-foreground">{formatRound(pick.round2, 2)}</span>
                                    <span className={cn(
                                      'text-center',
                                      !pick.madeCut ? 'text-red-600' : 'text-muted-foreground'
                                    )}>
                                      {formatRound(pick.round3, 3)}
                                    </span>
                                    <span className={cn(
                                      'text-center',
                                      !pick.madeCut ? 'text-red-600' : 'text-muted-foreground'
                                    )}>
                                      {formatRound(pick.round4, 4)}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="mt-8 py-6 text-center text-sm text-muted-foreground border-t bg-white">
        <p>Powered by BN Pools</p>
      </footer>
    </div>
  )
}
