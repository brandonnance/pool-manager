'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Trophy, MapPin, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Pick {
  golferId: string
  golferName: string
  score: number
  position: string
  madeCut: boolean
  thru: number | null
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
}: GolfPublicLeaderboardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)

  // Filter entries by search query (entry name only for privacy)
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries
    const query = searchQuery.toLowerCase()
    return entries.filter((e) =>
      e.entryName.toLowerCase().includes(query)
    )
  }, [entries, searchQuery])

  // Calculate rankings (handle ties)
  const rankedEntries = useMemo(() => {
    let currentRank = 1
    let previousScore: number | null = null

    return filteredEntries.map((entry, index) => {
      if (previousScore !== null && entry.totalScore > previousScore) {
        currentRank = index + 1
      }
      previousScore = entry.totalScore

      return {
        ...entry,
        rank: currentRank,
      }
    })
  }, [filteredEntries])

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

        {/* Leaderboard */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Standings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rankedEntries.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? 'No entries match your search' : 'No entries yet'}
              </div>
            ) : (
              <div className="divide-y">
                {rankedEntries.map((entry) => {
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
                        {/* Rank */}
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
                          isLeader
                            ? 'bg-amber-100 text-amber-700'
                            : entry.rank <= 3
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-gray-50 text-gray-500'
                        )}>
                          {entry.rank}
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
                        <div className="px-4 pb-4 bg-muted/30">
                          <div className="pt-2 grid gap-2">
                            {entry.picks.map((pick, i) => (
                              <div
                                key={pick.golferId}
                                className={cn(
                                  'flex items-center justify-between text-sm py-1.5 px-3 rounded bg-white border',
                                  !pick.madeCut && 'opacity-60'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground w-5">
                                    {i + 1}.
                                  </span>
                                  <span className={cn(!pick.madeCut && 'line-through')}>
                                    {pick.golferName}
                                  </span>
                                  {!pick.madeCut && (
                                    <Badge variant="outline" className="text-xs">
                                      MC
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground">
                                    {pick.position}
                                  </span>
                                  <span className={cn(
                                    'font-mono font-medium',
                                    pick.score < 0 && 'text-green-600',
                                    pick.score > 0 && 'text-red-600'
                                  )}>
                                    {formatScore(pick.score)}
                                  </span>
                                </div>
                              </div>
                            ))}
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
