'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { NoAccountSquaresGrid, type NoAccountSquare } from './no-account-squares-grid'
import { NoAccountPoolSettings } from './no-account-pool-settings'
import { AssignNameDialog } from './assign-name-dialog'
import { BulkAssignDialog } from './bulk-assign-dialog'
import { EditGameTeamsButton } from './edit-game-teams-button'
import { ParticipantSummaryPanel } from './participant-summary-panel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  isSuperAdmin?: boolean
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

// Score Entry Component for Playoff Games
function PlayoffScoreEntry({
  game,
  sqPoolId,
  reverseScoring,
  squares,
  rowNumbers,
  colNumbers,
}: {
  game: SqGame
  sqPoolId: string
  reverseScoring: boolean
  squares: NoAccountSquare[]
  rowNumbers: number[]
  colNumbers: number[]
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [finalHome, setFinalHome] = useState(game.home_score?.toString() ?? '')
  const [finalAway, setFinalAway] = useState(game.away_score?.toString() ?? '')
  const [halfHome, setHalfHome] = useState(game.halftime_home_score?.toString() ?? '')
  const [halfAway, setHalfAway] = useState(game.halftime_away_score?.toString() ?? '')
  const [status, setStatus] = useState(game.status ?? 'scheduled')

  const isSuperBowl = game.round === 'super_bowl'
  const isFinal = game.status === 'final'

  const handleOpen = () => {
    setFinalHome(game.home_score?.toString() ?? '')
    setFinalAway(game.away_score?.toString() ?? '')
    setHalfHome(game.halftime_home_score?.toString() ?? '')
    setHalfAway(game.halftime_away_score?.toString() ?? '')
    setStatus(game.status ?? 'scheduled')
    setError(null)
    setIsOpen(true)
  }

  const getWinnerName = (homeScore: number, awayScore: number, isReverse: boolean) => {
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10

    let rowIndex: number
    let colIndex: number

    if (isReverse) {
      rowIndex = rowNumbers.findIndex((n) => n === awayDigit)
      colIndex = colNumbers.findIndex((n) => n === homeDigit)
    } else {
      rowIndex = rowNumbers.findIndex((n) => n === homeDigit)
      colIndex = colNumbers.findIndex((n) => n === awayDigit)
    }

    const square = squares.find((s) => s.row_index === rowIndex && s.col_index === colIndex)
    return square?.participant_name ?? 'Unclaimed'
  }

  const getSquareId = (homeScore: number, awayScore: number, isReverse: boolean) => {
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10

    let rowIndex: number
    let colIndex: number

    if (isReverse) {
      rowIndex = rowNumbers.findIndex((n) => n === awayDigit)
      colIndex = colNumbers.findIndex((n) => n === homeDigit)
    } else {
      rowIndex = rowNumbers.findIndex((n) => n === homeDigit)
      colIndex = colNumbers.findIndex((n) => n === awayDigit)
    }

    const square = squares.find((s) => s.row_index === rowIndex && s.col_index === colIndex)
    return square?.id ?? null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // Build updates
    const updates: Record<string, unknown> = {
      status,
      home_score: finalHome !== '' ? parseInt(finalHome, 10) : null,
      away_score: finalAway !== '' ? parseInt(finalAway, 10) : null,
    }

    // Add halftime scores for Super Bowl
    if (isSuperBowl) {
      updates.halftime_home_score = halfHome !== '' ? parseInt(halfHome, 10) : null
      updates.halftime_away_score = halfAway !== '' ? parseInt(halfAway, 10) : null
    }

    const { error: updateError } = await supabase
      .from('sq_games')
      .update(updates)
      .eq('id', game.id)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    // Delete existing winners for this game before recalculating
    await supabase.from('sq_winners').delete().eq('sq_game_id', game.id)

    // Helper to record a winner
    const recordWinner = async (
      homeScore: number,
      awayScore: number,
      winType: string,
      reverseWinType: string
    ) => {
      const forwardSquareId = getSquareId(homeScore, awayScore, false)
      const forwardWinnerName = getWinnerName(homeScore, awayScore, false)

      if (forwardSquareId) {
        await supabase.from('sq_winners').insert({
          sq_game_id: game.id,
          square_id: forwardSquareId,
          win_type: winType,
          winner_name: forwardWinnerName,
        })
      }

      if (reverseScoring) {
        const reverseSquareId = getSquareId(homeScore, awayScore, true)
        const reverseWinnerName = getWinnerName(homeScore, awayScore, true)

        if (reverseSquareId && reverseSquareId !== forwardSquareId) {
          await supabase.from('sq_winners').insert({
            sq_game_id: game.id,
            square_id: reverseSquareId,
            win_type: reverseWinType,
            winner_name: reverseWinnerName,
          })
        }
      }
    }

    // Record halftime winner for Super Bowl
    if (isSuperBowl && halfHome !== '' && halfAway !== '') {
      await recordWinner(
        parseInt(halfHome, 10),
        parseInt(halfAway, 10),
        'halftime',
        'halftime_reverse'
      )
    }

    // Record final winner (only when status is final)
    if (status === 'final' && finalHome !== '' && finalAway !== '') {
      await recordWinner(
        parseInt(finalHome, 10),
        parseInt(finalAway, 10),
        'normal',
        'reverse'
      )
    }

    setIsLoading(false)
    setIsOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleOpen} className="h-6 text-xs">
          {isFinal ? 'Edit' : 'Score'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Score</DialogTitle>
          <DialogDescription>
            {game.game_name} - {game.away_team} @ {game.home_team}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Super Bowl Halftime */}
            {isSuperBowl && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Halftime Score</Label>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1 truncate">{game.away_team}</div>
                    <Input
                      type="number"
                      min="0"
                      value={halfAway}
                      onChange={(e) => setHalfAway(e.target.value)}
                      className="text-center"
                    />
                  </div>
                  <div className="text-center text-muted-foreground text-sm pt-5">-</div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1 truncate">{game.home_team}</div>
                    <Input
                      type="number"
                      min="0"
                      value={halfHome}
                      onChange={(e) => setHalfHome(e.target.value)}
                      className="text-center"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Final Score */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Final Score</Label>
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1 truncate">{game.away_team}</div>
                  <Input
                    type="number"
                    min="0"
                    value={finalAway}
                    onChange={(e) => setFinalAway(e.target.value)}
                    className="text-center text-lg font-bold"
                  />
                </div>
                <div className="text-center text-muted-foreground pt-5">-</div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1 truncate">{game.home_team}</div>
                  <Input
                    type="number"
                    min="0"
                    value={finalHome}
                    onChange={(e) => setFinalHome(e.target.value)}
                    className="text-center text-lg font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Game Status</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={status === 'scheduled' ? 'default' : 'outline'}
                  onClick={() => setStatus('scheduled')}
                  size="sm"
                >
                  Scheduled
                </Button>
                <Button
                  type="button"
                  variant={status === 'in_progress' ? 'default' : 'outline'}
                  onClick={() => setStatus('in_progress')}
                  className={status === 'in_progress' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                  size="sm"
                >
                  In Progress
                </Button>
                <Button
                  type="button"
                  variant={status === 'final' ? 'default' : 'outline'}
                  onClick={() => setStatus('final')}
                  size="sm"
                >
                  Final
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Score'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Simple game display component
function SimplePlayoffGameCard({
  game,
  isCommissioner,
  sqPoolId,
  reverseScoring,
  squares,
  rowNumbers,
  colNumbers,
}: {
  game: SqGame
  isCommissioner: boolean
  sqPoolId: string
  reverseScoring: boolean
  squares: NoAccountSquare[]
  rowNumbers: number[]
  colNumbers: number[]
}) {
  const hasScores = game.home_score !== null && game.away_score !== null
  const isFinal = game.status === 'final'

  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium truncate">{game.game_name}</span>
        <div className="flex items-center gap-1">
          {isCommissioner && (
            <>
              <PlayoffScoreEntry
                game={game}
                sqPoolId={sqPoolId}
                reverseScoring={reverseScoring}
                squares={squares}
                rowNumbers={rowNumbers}
                colNumbers={colNumbers}
              />
              <EditGameTeamsButton
                gameId={game.id}
                gameName={game.game_name}
                homeTeam={game.home_team}
                awayTeam={game.away_team}
              />
            </>
          )}
          <Badge variant={isFinal ? 'secondary' : game.status === 'in_progress' ? 'default' : 'outline'} className="text-xs">
            {isFinal ? 'Final' : game.status === 'in_progress' ? 'Live' : 'Sched'}
          </Badge>
        </div>
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
  isSuperAdmin = false,
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

  // Round hierarchy for playoff mode (higher number = higher tier)
  const roundHierarchy: Record<string, number> = {
    wild_card: 1,
    divisional: 2,
    conference: 3,
    super_bowl_halftime: 4,
    super_bowl: 5,
  }

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

          // Only set if new round is higher in hierarchy than existing
          if (round) {
            const existing = winningSquareRounds.get(winner.square_id)
            const existingRank = existing ? roundHierarchy[existing] ?? 0 : 0
            const newRank = roundHierarchy[round] ?? 0

            if (newRank > existingRank) {
              winningSquareRounds.set(winner.square_id, round)
            }
          }
        }
      }
    }
  }

  // Calculate wins by participant name
  // Track forward vs reverse wins separately
  const winsByName = new Map<string, { total: number; forward: number; reverse: number }>()
  for (const winner of winners) {
    if (winner.winner_name) {
      const current = winsByName.get(winner.winner_name) ?? { total: 0, forward: 0, reverse: 0 }
      const isReverse = winner.win_type.includes('reverse')
      winsByName.set(winner.winner_name, {
        total: current.total + 1,
        forward: current.forward + (isReverse ? 0 : 1),
        reverse: current.reverse + (isReverse ? 1 : 0),
      })
    }
  }

  const leaderboardEntries = Array.from(winsByName.entries())
    .map(([name, stats]) => ({ name, ...stats }))
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

          {/* Participant Summary - Commissioner only */}
          {isCommissioner && (
            <ParticipantSummaryPanel sqPoolId={sqPoolId} />
          )}

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
                          <SimplePlayoffGameCard
                            key={game.id}
                            game={game}
                            isCommissioner={isCommissioner}
                            sqPoolId={sqPoolId}
                            reverseScoring={reverseScoring}
                            squares={squares}
                            rowNumbers={rowNumbers ?? []}
                            colNumbers={colNumbers ?? []}
                          />
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
              isSuperAdmin={isSuperAdmin}
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
                        <div className="text-right">
                          <span className="font-bold tabular-nums">{entry.total}</span>
                          {reverseScoring && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({entry.forward}F, {entry.reverse}R)
                            </span>
                          )}
                        </div>
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
