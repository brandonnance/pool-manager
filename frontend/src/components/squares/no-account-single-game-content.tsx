'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { NoAccountSquaresGrid, type NoAccountSquare } from './no-account-squares-grid'
import { NoAccountPoolSettings } from './no-account-pool-settings'
import { AssignNameDialog } from './assign-name-dialog'
import { BulkAssignDialog } from './bulk-assign-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  q1_home_score: number | null
  q1_away_score: number | null
  q3_home_score: number | null
  q3_away_score: number | null
  status: string | null
  round: string
}

interface SqWinner {
  id: string
  square_id: string | null
  win_type: string
  payout: number | null
  winner_name: string | null
  sq_game_id: string
}

interface ScoreChange {
  id: string
  home_score: number
  away_score: number
  change_order: number
  sq_game_id: string | null
}

interface NoAccountSingleGameContentProps {
  sqPoolId: string
  poolId: string
  publicSlug: string | null
  numbersLocked: boolean
  reverseScoring: boolean
  rowNumbers: number[] | null
  colNumbers: number[] | null
  mode: string | null
  scoringMode: string | null
  poolStatus: string
  squares: NoAccountSquare[]
  games: SqGame[]
  winners: SqWinner[]
  scoreChanges: ScoreChange[]
  isCommissioner: boolean
}

// Simple Game Score Display Component
function SimpleGameScoreCard({
  game,
  scoringMode
}: {
  game: SqGame
  scoringMode: string
}) {
  const hasScores = game.home_score !== null && game.away_score !== null
  const isFinal = game.status === 'final'

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{game.game_name}</span>
        <Badge variant={isFinal ? 'secondary' : game.status === 'in_progress' ? 'default' : 'outline'}>
          {isFinal ? 'Final' : game.status === 'in_progress' ? 'Live' : 'Scheduled'}
        </Badge>
      </div>
      <div className="flex items-center justify-center gap-4">
        <div className="text-center flex-1">
          <div className="text-sm font-medium truncate">{game.away_team}</div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {hasScores ? game.away_score : '-'}
          </div>
        </div>
        <div className="text-muted-foreground">@</div>
        <div className="text-center flex-1">
          <div className="text-sm font-medium truncate">{game.home_team}</div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {hasScores ? game.home_score : '-'}
          </div>
        </div>
      </div>
      {/* Quarter scores for quarter mode */}
      {scoringMode === 'quarter' && (
        <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-2 text-xs text-center">
          <div>
            <div className="text-muted-foreground">Q1</div>
            <div className="font-mono">
              {game.q1_away_score ?? '-'} - {game.q1_home_score ?? '-'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Half</div>
            <div className="font-mono">
              {game.halftime_away_score ?? '-'} - {game.halftime_home_score ?? '-'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Q3</div>
            <div className="font-mono">
              {game.q3_away_score ?? '-'} - {game.q3_home_score ?? '-'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Final</div>
            <div className="font-mono font-bold">
              {game.away_score ?? '-'} - {game.home_score ?? '-'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Simple Score Entry Component for No-Account Mode
function NoAccountScoreEntry({
  game,
  sqPoolId,
  scoringMode,
  reverseScoring,
  squares,
  rowNumbers,
  colNumbers,
  scoreChanges,
}: {
  game: SqGame
  sqPoolId: string
  scoringMode: string
  reverseScoring: boolean
  squares: NoAccountSquare[]
  rowNumbers: number[]
  colNumbers: number[]
  scoreChanges: ScoreChange[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Score change mode state
  const [newScoreHome, setNewScoreHome] = useState('')
  const [newScoreAway, setNewScoreAway] = useState('')

  const sortedScoreChanges = [...scoreChanges].sort((a, b) => a.change_order - b.change_order)
  const lastScoreChange = sortedScoreChanges[sortedScoreChanges.length - 1]
  const lastHomeScore = lastScoreChange?.home_score ?? 0
  const lastAwayScore = lastScoreChange?.away_score ?? 0

  const handleOpen = () => {
    setNewScoreHome(lastHomeScore.toString())
    setNewScoreAway(lastAwayScore.toString())
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

  const handleAddScoreChange = async () => {
    if (newScoreHome === '' || newScoreAway === '') {
      setError('Please enter both scores')
      return
    }

    const homeScore = parseInt(newScoreHome, 10)
    const awayScore = parseInt(newScoreAway, 10)

    if (homeScore < lastHomeScore) {
      setError(`${game.home_team} score cannot be less than ${lastHomeScore}`)
      return
    }
    if (awayScore < lastAwayScore) {
      setError(`${game.away_team} score cannot be less than ${lastAwayScore}`)
      return
    }

    const homeChanged = homeScore !== lastHomeScore
    const awayChanged = awayScore !== lastAwayScore

    if (homeChanged && awayChanged) {
      setError('Only one team can score at a time')
      return
    }
    if (!homeChanged && !awayChanged) {
      setError('Score must change from the previous entry')
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const nextOrder = scoreChanges.length + 1

    // Insert score change
    const { error: insertError } = await supabase
      .from('sq_score_changes')
      .insert({
        sq_game_id: game.id,
        home_score: homeScore,
        away_score: awayScore,
        change_order: nextOrder,
      })

    if (insertError) {
      setError(insertError.message)
      setIsLoading(false)
      return
    }

    // Update game
    await supabase
      .from('sq_games')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'in_progress',
      })
      .eq('id', game.id)

    // Create winners
    const forwardWinnerName = getWinnerName(homeScore, awayScore, false)
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10
    const forwardRowIndex = rowNumbers.findIndex((n) => n === homeDigit)
    const forwardColIndex = colNumbers.findIndex((n) => n === awayDigit)
    const forwardSquare = squares.find((s) => s.row_index === forwardRowIndex && s.col_index === forwardColIndex)

    if (forwardSquare?.id) {
      await supabase.from('sq_winners').insert({
        sq_game_id: game.id,
        square_id: forwardSquare.id,
        win_type: 'score_change',
        payout: nextOrder,
        winner_name: forwardWinnerName,
      })
    }

    if (reverseScoring) {
      const reverseWinnerName = getWinnerName(homeScore, awayScore, true)
      const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
      const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)
      const reverseSquare = squares.find((s) => s.row_index === reverseRowIndex && s.col_index === reverseColIndex)

      if (reverseSquare?.id) {
        await supabase.from('sq_winners').insert({
          sq_game_id: game.id,
          square_id: reverseSquare.id,
          win_type: 'score_change_reverse',
          payout: nextOrder,
          winner_name: reverseWinnerName,
        })
      }
    }

    setNewScoreHome(homeScore.toString())
    setNewScoreAway(awayScore.toString())
    setIsLoading(false)
    router.refresh()
  }

  const handleAddZeroZero = async () => {
    setIsLoading(true)
    setError(null)
    const supabase = createClient()

    await supabase.from('sq_score_changes').insert({
      sq_game_id: game.id,
      home_score: 0,
      away_score: 0,
      change_order: 1,
    })

    await supabase.from('sq_games').update({
      home_score: 0,
      away_score: 0,
      status: 'in_progress',
    }).eq('id', game.id)

    // Create 0-0 winners
    const winnerName = getWinnerName(0, 0, false)
    const zeroRowIndex = rowNumbers.findIndex((n) => n === 0)
    const zeroColIndex = colNumbers.findIndex((n) => n === 0)
    const forwardSquare = squares.find((s) => s.row_index === zeroRowIndex && s.col_index === zeroColIndex)

    if (forwardSquare?.id) {
      await supabase.from('sq_winners').insert({
        sq_game_id: game.id,
        square_id: forwardSquare.id,
        win_type: 'score_change',
        payout: 1,
        winner_name: winnerName,
      })
    }

    if (reverseScoring && forwardSquare?.id) {
      await supabase.from('sq_winners').insert({
        sq_game_id: game.id,
        square_id: forwardSquare.id,
        win_type: 'score_change_reverse',
        payout: 1,
        winner_name: winnerName,
      })
    }

    setIsLoading(false)
    router.refresh()
  }

  const handleMarkFinal = async () => {
    setIsLoading(true)
    const supabase = createClient()

    await supabase.from('sq_games').update({ status: 'final' }).eq('id', game.id)

    if (lastScoreChange) {
      const homeScore = lastScoreChange.home_score
      const awayScore = lastScoreChange.away_score
      const homeDigit = homeScore % 10
      const awayDigit = awayScore % 10

      const forwardWinnerName = getWinnerName(homeScore, awayScore, false)
      const forwardRowIndex = rowNumbers.findIndex((n) => n === homeDigit)
      const forwardColIndex = colNumbers.findIndex((n) => n === awayDigit)
      const forwardSquare = squares.find((s) => s.row_index === forwardRowIndex && s.col_index === forwardColIndex)

      if (forwardSquare?.id) {
        await supabase.from('sq_winners').insert({
          sq_game_id: game.id,
          square_id: forwardSquare.id,
          win_type: 'score_change_final',
          winner_name: forwardWinnerName,
        })
      }

      if (reverseScoring) {
        const reverseWinnerName = getWinnerName(homeScore, awayScore, true)
        const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
        const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)
        const reverseSquare = squares.find((s) => s.row_index === reverseRowIndex && s.col_index === reverseColIndex)

        if (reverseSquare?.id) {
          await supabase.from('sq_winners').insert({
            sq_game_id: game.id,
            square_id: reverseSquare.id,
            win_type: 'score_change_final_reverse',
            winner_name: reverseWinnerName,
          })
        }
      }
    }

    setIsLoading(false)
    setIsOpen(false)
    router.refresh()
  }

  const isFinal = game.status === 'final'

  if (scoringMode !== 'score_change') {
    return null // Quarter mode not yet implemented for no-account
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={handleOpen}>
          {isFinal ? 'View Scores' : 'Enter Scores'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enter Scores</DialogTitle>
          <DialogDescription>
            {game.game_name} - {game.away_team} @ {game.home_team}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current score */}
          <div className="text-center py-2 bg-muted rounded-md">
            <div className="text-xs text-muted-foreground">Current Score</div>
            <div className="text-2xl font-bold">
              {game.away_score ?? 0} - {game.home_score ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">
              {scoreChanges.length} score change{scoreChanges.length !== 1 ? 's' : ''}
            </div>
          </div>

          {scoreChanges.length === 0 && !isFinal && (
            <Button onClick={handleAddZeroZero} disabled={isLoading} className="w-full" variant="outline">
              Start Game (0-0)
            </Button>
          )}

          {scoreChanges.length > 0 && !isFinal && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Add Score Change</Label>
                <span className="text-xs text-muted-foreground">Only one team can score at a time</span>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">{game.away_team}</div>
                  <Input
                    type="number"
                    min={lastAwayScore}
                    value={newScoreAway}
                    onChange={(e) => setNewScoreAway(e.target.value)}
                    className="text-center text-lg font-bold"
                  />
                </div>
                <div className="text-center text-muted-foreground pt-5">-</div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">{game.home_team}</div>
                  <Input
                    type="number"
                    min={lastHomeScore}
                    value={newScoreHome}
                    onChange={(e) => setNewScoreHome(e.target.value)}
                    className="text-center text-lg font-bold"
                  />
                </div>
              </div>
              <Button onClick={handleAddScoreChange} disabled={isLoading} className="w-full">
                Add Score Change
              </Button>
            </div>
          )}

          {scoreChanges.length > 0 && !isFinal && (
            <Button onClick={handleMarkFinal} disabled={isLoading} variant="secondary" className="w-full">
              Mark Game Final
            </Button>
          )}

          {isFinal && (
            <div className="text-center py-4 text-muted-foreground">
              Game is final. No more score changes can be added.
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Simple Score Change Log for No-Account Mode
function SimpleScoreChangeLog({
  scoreChanges,
  squares,
  rowNumbers,
  colNumbers,
  reverseScoring,
  winners,
}: {
  scoreChanges: ScoreChange[]
  squares: NoAccountSquare[]
  rowNumbers: number[]
  colNumbers: number[]
  reverseScoring: boolean
  winners: SqWinner[]
}) {
  // Group winners by change_order (stored in payout)
  const winnersByChangeOrder = new Map<number, SqWinner[]>()
  for (const w of winners) {
    if (w.win_type === 'score_change' || w.win_type === 'score_change_reverse') {
      const order = w.payout ?? 0
      if (!winnersByChangeOrder.has(order)) {
        winnersByChangeOrder.set(order, [])
      }
      winnersByChangeOrder.get(order)!.push(w)
    }
  }

  return (
    <div className="space-y-2">
      {scoreChanges
        .sort((a, b) => b.change_order - a.change_order)
        .map((change) => {
          const changeWinners = winnersByChangeOrder.get(change.change_order) || []
          const homeDigit = change.home_score % 10
          const awayDigit = change.away_score % 10

          return (
            <div key={change.id} className="p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    #{change.change_order}
                  </Badge>
                  <div className="font-mono text-lg font-bold">
                    {change.away_score} - {change.home_score}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    [{awayDigit}-{homeDigit}]
                  </span>
                </div>
              </div>

              {changeWinners.length > 0 && (
                <div className="mt-2 pt-2 border-t border-dashed flex flex-wrap gap-2">
                  {changeWinners.map((winner) => (
                    <div
                      key={winner.id}
                      className={`text-xs px-2 py-1 rounded ${
                        winner.win_type === 'score_change_reverse'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {winner.win_type === 'score_change_reverse' && <span className="mr-1">(R)</span>}
                      {winner.winner_name || 'Unclaimed'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

      {scoreChanges.length === 0 && (
        <div className="text-center py-6 text-muted-foreground text-sm">
          No score changes recorded yet.
        </div>
      )}
    </div>
  )
}

export function NoAccountSingleGameContent({
  sqPoolId,
  poolId,
  publicSlug,
  numbersLocked,
  reverseScoring,
  rowNumbers,
  colNumbers,
  mode,
  scoringMode,
  poolStatus,
  squares: initialSquares,
  games,
  winners,
  scoreChanges,
  isCommissioner,
}: NoAccountSingleGameContentProps) {
  // Local state for squares with realtime updates
  const [squares, setSquares] = useState<NoAccountSquare[]>(initialSquares)

  // Realtime subscription for instant updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`commissioner-squares-${sqPoolId}`)
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

  // Build winning squares map
  const winningSquareRounds = new Map<string, WinningRound>()

  if (numbersLocked) {
    for (const winner of winners) {
      if (winner.square_id) {
        let round: WinningRound = null

        if (winner.win_type === 'score_change_final_both') {
          round = 'score_change_final_both'
        } else if (winner.win_type === 'score_change_final_reverse') {
          round = 'score_change_final_reverse'
        } else if (winner.win_type === 'score_change_final') {
          round = 'score_change_final'
        } else if (winner.win_type === 'score_change_reverse') {
          const alsoForward = winners.some(
            (w) => w.square_id === winner.square_id && w.win_type === 'score_change'
          )
          round = alsoForward ? 'score_change_both' : 'score_change_reverse'
        } else if (winner.win_type === 'score_change') {
          const alsoReverse = winners.some(
            (w) => w.square_id === winner.square_id && w.win_type === 'score_change_reverse'
          )
          round = alsoReverse ? 'score_change_both' : 'score_change_forward'
        } else if (winner.win_type === 'q1' || winner.win_type === 'q3' || winner.win_type === 'halftime' || winner.win_type === 'final') {
          round = 'single_game'
        }

        if (round) {
          const existing = winningSquareRounds.get(winner.square_id)
          if (!existing) {
            winningSquareRounds.set(winner.square_id, round)
          }
        }
      }
    }
  }

  // Calculate payouts by participant name (count wins, not payout amounts)
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

  // Get first game for labels
  const firstGame = games[0] ?? null
  const homeTeamLabel = firstGame?.home_team ?? 'Home'
  const awayTeamLabel = firstGame?.away_team ?? 'Away'

  const legendMode = scoringMode === 'score_change' ? 'score_change' : 'single_game'

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
        {/* Main content - Grid and Games */}
        <div className="lg:col-span-3 space-y-6">
          {/* Grid */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Squares Grid</CardTitle>
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
                homeTeamLabel={homeTeamLabel}
                awayTeamLabel={awayTeamLabel}
                legendMode={legendMode}
                onSquareClick={handleSquareClick}
              />
            </CardContent>
          </Card>

          {/* Game - only show after numbers locked */}
          {numbersLocked && firstGame && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Game</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SimpleGameScoreCard
                  game={firstGame}
                  scoringMode={scoringMode ?? 'quarter'}
                />

                {/* Commissioner score entry */}
                {isCommissioner && scoringMode === 'score_change' && (
                  <NoAccountScoreEntry
                    game={firstGame}
                    sqPoolId={sqPoolId}
                    scoringMode={scoringMode}
                    reverseScoring={reverseScoring}
                    squares={squares}
                    rowNumbers={rowNumbers ?? []}
                    colNumbers={colNumbers ?? []}
                    scoreChanges={scoreChanges}
                  />
                )}

                {/* Score change log for score_change mode */}
                {scoringMode === 'score_change' && scoreChanges.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="font-medium mb-2">Score Changes</h3>
                    <SimpleScoreChangeLog
                      scoreChanges={scoreChanges}
                      squares={squares}
                      rowNumbers={rowNumbers ?? []}
                      colNumbers={colNumbers ?? []}
                      reverseScoring={reverseScoring}
                      winners={winners}
                    />
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
              scoringMode={scoringMode}
              poolStatus={poolStatus}
              onBulkAssignClick={() => setBulkDialogOpen(true)}
            />
          )}

          {/* Payouts/Wins */}
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
