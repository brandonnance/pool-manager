'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { NoAccountSquaresGrid, type NoAccountSquare } from './no-account-squares-grid'
import { NoAccountPoolSettings } from './no-account-pool-settings'
import { AssignNameDialog } from './assign-name-dialog'
import { BulkAssignDialog } from './bulk-assign-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WinningRound } from './square-cell'

interface SqGame {
  id: string
  game_name: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  halftime_home_score: number | null
  halftime_away_score: number | null
  round: string
  status: string | null
  pays_halftime: boolean | null
  display_order: number | null
}

interface SqWinner {
  id: string
  sq_game_id: string
  square_id: string | null
  win_type: string
  payout: number | null
  winner_name: string | null
}

interface NoAccountPlayoffContentProps {
  sqPoolId: string
  poolId: string
  publicSlug: string | null
  numbersLocked: boolean
  reverseScoring: boolean
  rowNumbers: number[] | null
  colNumbers: number[] | null
  mode: string | null
  poolStatus: string
  squares: NoAccountSquare[]
  games: SqGame[]
  winners: SqWinner[]
  isCommissioner: boolean
}

function getRoundLabel(round: string): string {
  switch (round) {
    case 'wild_card':
      return 'Wild Card'
    case 'divisional':
      return 'Divisional'
    case 'conference':
      return 'Conference'
    case 'super_bowl':
      return 'Super Bowl'
    default:
      return round
  }
}

// Simple game display component
function SimplePlayoffGameCard({ game }: { game: SqGame }) {
  const hasScores = game.home_score !== null && game.away_score !== null
  const isFinal = game.status === 'final'

  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium truncate">{game.game_name}</span>
        <Badge variant={isFinal ? 'secondary' : game.status === 'in_progress' ? 'default' : 'outline'} className="text-xs">
          {isFinal ? 'Final' : game.status === 'in_progress' ? 'Live' : 'Sched'}
        </Badge>
      </div>
      <div className="flex items-center justify-center gap-2">
        <div className="text-center flex-1">
          <div className="text-xs font-medium truncate">{game.away_team}</div>
          <div className="text-xl font-bold tabular-nums">
            {hasScores ? game.away_score : '-'}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">@</div>
        <div className="text-center flex-1">
          <div className="text-xs font-medium truncate">{game.home_team}</div>
          <div className="text-xl font-bold tabular-nums">
            {hasScores ? game.home_score : '-'}
          </div>
        </div>
      </div>
      {game.pays_halftime && game.halftime_home_score !== null && game.halftime_away_score !== null && (
        <div className="text-center text-xs text-muted-foreground mt-2">
          HT: {game.halftime_away_score} - {game.halftime_home_score}
        </div>
      )}
    </div>
  )
}

export function NoAccountPlayoffContent({
  sqPoolId,
  poolId,
  publicSlug,
  numbersLocked,
  reverseScoring,
  rowNumbers,
  colNumbers,
  mode,
  poolStatus,
  squares: initialSquares,
  games,
  winners,
  isCommissioner,
}: NoAccountPlayoffContentProps) {
  // Local state for squares with realtime updates
  const [squares, setSquares] = useState<NoAccountSquare[]>(initialSquares)

  // Realtime subscription for instant updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`commissioner-playoff-squares-${sqPoolId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sq_squares',
          filter: `sq_pool_id=eq.${sqPoolId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newSquare = payload.new as Database['public']['Tables']['sq_squares']['Row']
            setSquares((prev) => [
              ...prev,
              {
                id: newSquare.id,
                row_index: newSquare.row_index,
                col_index: newSquare.col_index,
                participant_name: newSquare.participant_name,
                verified: newSquare.verified ?? false,
              },
            ])
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Database['public']['Tables']['sq_squares']['Row']
            setSquares((prev) =>
              prev.map((sq) =>
                sq.id === updated.id
                  ? {
                      ...sq,
                      participant_name: updated.participant_name,
                      verified: updated.verified ?? false,
                    }
                  : sq
              )
            )
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setSquares((prev) => prev.filter((sq) => sq.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sqPoolId])

  // Sync with server data when props change (e.g., after router.refresh for non-squares data)
  useEffect(() => {
    setSquares(initialSquares)
  }, [initialSquares])

  // Dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState<{
    rowIndex: number
    colIndex: number
    square: NoAccountSquare | null
  } | null>(null)

  // Build winning squares map (squareId -> round)
  const gameById = new Map(games.map((g) => [g.id, g]))
  const winningSquareRounds = new Map<string, WinningRound>()

  if (numbersLocked) {
    for (const winner of winners) {
      if (winner.square_id) {
        const game = gameById.get(winner.sq_game_id)
        if (game) {
          // Super Bowl halftime gets its own color
          const isHalftime = winner.win_type === 'halftime' || winner.win_type === 'halftime_reverse'
          const round =
            game.round === 'super_bowl' && isHalftime
              ? 'super_bowl_halftime'
              : (game.round as WinningRound)

          // Don't overwrite existing round assignment
          if (!winningSquareRounds.has(winner.square_id)) {
            winningSquareRounds.set(winner.square_id, round)
          }
        }
      }
    }
  }

  // Calculate wins by participant name
  const winsByName = new Map<string, number>()
  for (const winner of winners) {
    if (winner.winner_name) {
      const current = winsByName.get(winner.winner_name) ?? 0
      winsByName.set(winner.winner_name, current + 1)
    }
  }

  const leaderboardEntries = Array.from(winsByName.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)

  // Group games by round
  const gamesByRound = games.reduce(
    (acc, game) => {
      const round = game.round
      if (!acc[round]) acc[round] = []
      acc[round].push(game)
      return acc
    },
    {} as Record<string, SqGame[]>
  )

  const roundOrder = ['wild_card', 'divisional', 'conference', 'super_bowl']

  const handleSquareClick = (rowIndex: number, colIndex: number, square: NoAccountSquare | null) => {
    if (!isCommissioner) return
    setSelectedSquare({ rowIndex, colIndex, square })
    setAssignDialogOpen(true)
  }

  const handleDialogClose = () => {
    setAssignDialogOpen(false)
    setSelectedSquare(null)
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main content - Grid */}
        <div className="lg:col-span-3 space-y-6">
          {/* Grid */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Squares Grid</CardTitle>
                  <CardDescription>
                    {numbersLocked
                      ? 'Numbers have been revealed!'
                      : 'Assign squares before locking numbers'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <NoAccountSquaresGrid
                sqPoolId={sqPoolId}
                squares={squares}
                rowNumbers={rowNumbers}
                colNumbers={colNumbers}
                numbersLocked={numbersLocked}
                isCommissioner={isCommissioner}
                winningSquareRounds={winningSquareRounds}
                homeTeamLabel="Home"
                awayTeamLabel="Away"
                legendMode="full_playoff"
                onSquareClick={handleSquareClick}
              />
            </CardContent>
          </Card>

          {/* Games List - only show after numbers locked */}
          {numbersLocked && games.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Games</CardTitle>
                <CardDescription>{games.length} playoff games</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {roundOrder.map((round) => {
                  const roundGames = gamesByRound[round]
                  if (!roundGames || roundGames.length === 0) return null

                  return (
                    <div key={round}>
                      <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                        {getRoundLabel(round)}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {roundGames.map((game) => (
                          <SimplePlayoffGameCard key={game.id} game={game} />
                        ))}
                      </div>
                    </div>
                  )
                })}

                {games.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No games added yet
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Commissioner Settings */}
          {isCommissioner && (
            <NoAccountPoolSettings
              sqPoolId={sqPoolId}
              poolId={poolId}
              publicSlug={publicSlug}
              numbersLocked={numbersLocked}
              reverseScoring={reverseScoring}
              mode={mode}
              scoringMode={null}
              poolStatus={poolStatus}
              onBulkAssignClick={() => setBulkDialogOpen(true)}
            />
          )}

          {/* Wins Leaderboard */}
          {numbersLocked && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Wins</CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboardEntries.length > 0 ? (
                  <div className="space-y-1">
                    {leaderboardEntries.map((entry, index) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 font-medium">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                          </span>
                          <span className="truncate">{entry.name}</span>
                        </div>
                        <span className="font-bold tabular-nums">{entry.total}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No winners yet
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pool Info for non-commissioners */}
          {!isCommissioner && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pool Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reverse Scoring</span>
                  <span>{reverseScoring ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Numbers</span>
                  <span>{numbersLocked ? 'Locked' : 'Pending'}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Assign Name Dialog */}
      {selectedSquare && (
        <AssignNameDialog
          open={assignDialogOpen}
          onOpenChange={handleDialogClose}
          sqPoolId={sqPoolId}
          rowIndex={selectedSquare.rowIndex}
          colIndex={selectedSquare.colIndex}
          currentName={selectedSquare.square?.participant_name ?? null}
          currentVerified={selectedSquare.square?.verified ?? false}
          squareId={selectedSquare.square?.id ?? null}
          onSaved={() => {}}
        />
      )}

      {/* Bulk Assign Dialog */}
      <BulkAssignDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        sqPoolId={sqPoolId}
        existingSquares={squares.map((s) => ({
          row_index: s.row_index,
          col_index: s.col_index,
          participant_name: s.participant_name,
        }))}
        onComplete={() => {}}
      />
    </div>
  )
}
