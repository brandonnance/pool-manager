'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Square } from './squares-grid'

interface SqWinner {
  id: string
  sq_game_id: string
  square_id: string | null
  win_type: string
  payout: number | null
  winner_name: string | null
}

interface PayoutLeaderboardProps {
  squares: Square[]
  winners: SqWinner[]
  currentUserId: string | null
}

interface LeaderboardEntry {
  participantName: string
  totalWins: number
  normalWins: number      // Forward wins (includes score_change, quarter forward, hybrid forward)
  reverseWins: number     // Reverse wins (includes all _reverse types)
  halftimeWins: number    // Halftime-specific wins
  quarterWins: number     // Hybrid quarter wins (q1, halftime, q3, final)
}

export function PayoutLeaderboard({ squares, winners, currentUserId }: PayoutLeaderboardProps) {
  // Create square lookup by ID
  const squareById = new Map<string, Square>()
  squares.forEach((sq) => {
    if (sq.id) squareById.set(sq.id, sq)
  })

  // Aggregate wins by participant name
  const winsByParticipant = new Map<string, LeaderboardEntry>()

  winners.forEach((winner) => {
    if (!winner.square_id) return
    const square = squareById.get(winner.square_id)
    if (!square?.participant_name) return

    const name = square.participant_name
    const existing = winsByParticipant.get(name) || {
      participantName: name,
      totalWins: 0,
      normalWins: 0,
      reverseWins: 0,
      halftimeWins: 0,
      quarterWins: 0,
    }

    existing.totalWins++

    const isReverse = winner.win_type.includes('_reverse')
    const isHybridQuarter = winner.win_type.startsWith('hybrid_')
    const isHalftime = winner.win_type === 'halftime' || winner.win_type === 'halftime_reverse' ||
                       winner.win_type === 'hybrid_halftime' || winner.win_type === 'hybrid_halftime_reverse'

    // Track forward vs reverse
    if (isReverse) {
      existing.reverseWins++
    } else {
      existing.normalWins++
    }

    // Track halftime separately
    if (isHalftime) {
      existing.halftimeWins++
    }

    // Track hybrid quarter wins
    if (isHybridQuarter) {
      existing.quarterWins++
    }

    winsByParticipant.set(name, existing)
  })

  // Sort by total wins descending
  const leaderboard = Array.from(winsByParticipant.values()).sort((a, b) => b.totalWins - a.totalWins)

  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            No winners yet
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center text-xs text-muted-foreground font-medium px-2 py-1">
            <div className="w-8">#</div>
            <div className="flex-1">Name</div>
            <div className="w-16 text-right">Wins</div>
          </div>

          {/* Entries */}
          {leaderboard.map((entry, index) => {
            const rank = index + 1

            return (
              <div
                key={entry.participantName}
                className="flex items-center px-2 py-2 rounded-md text-sm hover:bg-muted/50"
              >
                <div className="w-8 font-medium">
                  {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                </div>
                <div className="flex-1 truncate">{entry.participantName}</div>
                <div className="w-16 text-right font-bold tabular-nums">{entry.totalWins}</div>
              </div>
            )
          })}
        </div>

        {/* Win breakdown legend */}
        {leaderboard.some((e) => e.reverseWins > 0 || e.halftimeWins > 0 || e.quarterWins > 0) && (
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            <div className="font-medium mb-2">Win Breakdown</div>
            {leaderboard.slice(0, 3).map((entry) => (
              <div key={entry.participantName} className="flex justify-between py-0.5">
                <span className="truncate mr-2">{entry.participantName}</span>
                <span>
                  {entry.normalWins > 0 && `${entry.normalWins}F`}
                  {entry.normalWins > 0 && entry.reverseWins > 0 && ', '}
                  {entry.reverseWins > 0 && `${entry.reverseWins}R`}
                  {(entry.normalWins > 0 || entry.reverseWins > 0) && entry.quarterWins > 0 && ' '}
                  {entry.quarterWins > 0 && `(${entry.quarterWins} qtr)`}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
