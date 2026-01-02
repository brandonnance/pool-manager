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
  userId: string
  displayName: string
  totalWins: number
  normalWins: number
  reverseWins: number
  halftimeWins: number
}

export function PayoutLeaderboard({ squares, winners, currentUserId }: PayoutLeaderboardProps) {
  // Create square lookup by ID
  const squareById = new Map<string, Square>()
  squares.forEach((sq) => {
    if (sq.id) squareById.set(sq.id, sq)
  })

  // Aggregate wins by user
  const winsByUser = new Map<string, LeaderboardEntry>()

  winners.forEach((winner) => {
    if (!winner.square_id) return
    const square = squareById.get(winner.square_id)
    if (!square?.user_id) return

    const userId = square.user_id
    const existing = winsByUser.get(userId) || {
      userId,
      displayName: square.owner_name || 'Unknown',
      totalWins: 0,
      normalWins: 0,
      reverseWins: 0,
      halftimeWins: 0,
    }

    existing.totalWins++
    if (winner.win_type === 'normal') existing.normalWins++
    else if (winner.win_type === 'reverse') existing.reverseWins++
    else if (winner.win_type === 'halftime' || winner.win_type === 'halftime_reverse')
      existing.halftimeWins++

    winsByUser.set(userId, existing)
  })

  // Sort by total wins descending
  const leaderboard = Array.from(winsByUser.values()).sort((a, b) => b.totalWins - a.totalWins)

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
            const isCurrentUser = entry.userId === currentUserId
            const rank = index + 1

            return (
              <div
                key={entry.userId}
                className={`flex items-center px-2 py-2 rounded-md text-sm ${
                  isCurrentUser ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
                }`}
              >
                <div className="w-8 font-medium">
                  {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                </div>
                <div className="flex-1 truncate">
                  {entry.displayName}
                  {isCurrentUser && (
                    <span className="ml-1 text-xs text-muted-foreground">(You)</span>
                  )}
                </div>
                <div className="w-16 text-right font-bold tabular-nums">{entry.totalWins}</div>
              </div>
            )
          })}
        </div>

        {/* Win breakdown legend */}
        {leaderboard.some((e) => e.reverseWins > 0 || e.halftimeWins > 0) && (
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            <div className="font-medium mb-2">Win Breakdown</div>
            {leaderboard.slice(0, 3).map((entry) => (
              <div key={entry.userId} className="flex justify-between py-0.5">
                <span className="truncate mr-2">{entry.displayName}</span>
                <span>
                  {entry.normalWins > 0 && `${entry.normalWins} final`}
                  {entry.normalWins > 0 && entry.reverseWins > 0 && ', '}
                  {entry.reverseWins > 0 && `${entry.reverseWins} rev`}
                  {(entry.normalWins > 0 || entry.reverseWins > 0) && entry.halftimeWins > 0 && ', '}
                  {entry.halftimeWins > 0 && `${entry.halftimeWins} HT`}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
