'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Square } from './squares-grid'

interface ScoreChange {
  id: string
  sq_game_id: string | null
  home_score: number
  away_score: number
  change_order: number
  created_at: string | null
}

interface SqWinner {
  id: string
  sq_game_id: string
  square_id: string | null
  win_type: string
  payout: number | null
  winner_name: string | null
}

interface ScoreChangeLogProps {
  scoreChanges: ScoreChange[]
  winners: SqWinner[]
  squares: Square[]
  rowNumbers: number[] | null
  colNumbers: number[] | null
  reverseScoring: boolean
  currentUserId: string | null
}

export function ScoreChangeLog({
  scoreChanges,
  winners,
  squares,
  rowNumbers,
  colNumbers,
  reverseScoring,
  currentUserId,
}: ScoreChangeLogProps) {
  // Create square lookup
  const squareById = new Map<string, Square>()
  squares.forEach((sq) => {
    if (sq.id) squareById.set(sq.id, sq)
  })

  // Group winners by their payout (which stores change_order for score_change winners)
  const winnersByChangeOrder = new Map<number, SqWinner[]>()
  winners.forEach((w) => {
    if (w.win_type === 'score_change' || w.win_type === 'score_change_reverse') {
      const order = w.payout ?? 0
      if (!winnersByChangeOrder.has(order)) {
        winnersByChangeOrder.set(order, [])
      }
      winnersByChangeOrder.get(order)!.push(w)
    }
  })

  // Get winning square for a score
  const getWinningInfo = (homeScore: number, awayScore: number) => {
    if (!rowNumbers || !colNumbers) return null
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10
    return { homeDigit, awayDigit }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score Change Log</CardTitle>
        <CardDescription>
          {scoreChanges.length} score change{scoreChanges.length !== 1 ? 's' : ''} (newest first)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {scoreChanges
            .sort((a, b) => b.change_order - a.change_order)
            .map((change) => {
              const winningInfo = getWinningInfo(change.home_score, change.away_score)
              const changeWinners = winnersByChangeOrder.get(change.change_order) || []

              // Check if current user won this score change
              const userWon = changeWinners.some((w) => {
                if (!w.square_id) return false
                const sq = squareById.get(w.square_id)
                return sq?.user_id === currentUserId
              })

              return (
                <div
                  key={change.id}
                  className={`p-3 rounded-lg border ${
                    userWon
                      ? 'bg-amber-50 border-amber-200 ring-1 ring-amber-300'
                      : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        #{change.change_order}
                      </Badge>
                      <div className="font-mono text-lg font-bold">
                        {change.away_score} - {change.home_score}
                      </div>
                      {winningInfo && (
                        <span className="text-xs text-muted-foreground font-mono">
                          [{winningInfo.awayDigit}-{winningInfo.homeDigit}]
                        </span>
                      )}
                    </div>
                    {userWon && <span className="text-amber-600">🏆</span>}
                  </div>

                  {/* Winners for this score change */}
                  {changeWinners.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-dashed flex flex-wrap gap-2">
                      {changeWinners.map((winner) => {
                        const sq = winner.square_id ? squareById.get(winner.square_id) : null
                        const isCurrentUser = sq?.user_id === currentUserId

                        return (
                          <div
                            key={winner.id}
                            className={`text-xs px-2 py-1 rounded ${
                              isCurrentUser
                                ? 'bg-amber-100 text-amber-800 font-medium'
                                : 'bg-white text-muted-foreground'
                            }`}
                          >
                            {winner.win_type === 'score_change_reverse' && (
                              <span className="text-muted-foreground mr-1">(R)</span>
                            )}
                            {winner.winner_name || 'Unknown'}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

          {scoreChanges.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No score changes recorded yet. The commissioner will add scores as the game progresses.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
