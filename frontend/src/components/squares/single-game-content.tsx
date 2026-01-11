'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { SquaresGrid, type NoAccountSquare } from './squares-grid'
import { PoolSettings } from './pool-settings'
import { AssignNameDialog } from './assign-name-dialog'
import { BulkAssignDialog } from './bulk-assign-dialog'
import { EditGameTeamsButton } from './edit-game-teams-button'
import { ParticipantSummaryPanel } from './participant-summary-panel'
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
  espn_game_id: string | null
  current_period: number | null
  current_clock: string | null
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
  isSuperAdmin?: boolean
}

// Simple Game Score Display Component
function SimpleGameScoreCard({
  game,
  scoringMode
}: {
  game: SqGame
  scoringMode: string
}) {
  const isFinal = game.status === 'final'
  const isLive = game.status === 'in_progress'

  // For quarter mode, show the most recent available score
  // Priority: final > q3 > halftime > q1
  let displayHomeScore: number | null = null
  let displayAwayScore: number | null = null
  let currentPeriod = ''

  if (scoringMode === 'quarter') {
    if (game.home_score !== null && game.away_score !== null) {
      displayHomeScore = game.home_score
      displayAwayScore = game.away_score
      currentPeriod = 'Final'
    } else if (game.q3_home_score !== null && game.q3_away_score !== null) {
      displayHomeScore = game.q3_home_score
      displayAwayScore = game.q3_away_score
      currentPeriod = 'End Q3'
    } else if (game.halftime_home_score !== null && game.halftime_away_score !== null) {
      displayHomeScore = game.halftime_home_score
      displayAwayScore = game.halftime_away_score
      currentPeriod = 'Halftime'
    } else if (game.q1_home_score !== null && game.q1_away_score !== null) {
      displayHomeScore = game.q1_home_score
      displayAwayScore = game.q1_away_score
      currentPeriod = 'End Q1'
    }
  } else {
    // Score change mode uses game.home_score/away_score directly
    displayHomeScore = game.home_score
    displayAwayScore = game.away_score
  }

  const hasScores = displayHomeScore !== null && displayAwayScore !== null

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{game.game_name}</span>
        <div className="flex items-center gap-2">
          {scoringMode === 'quarter' && isLive && currentPeriod && (
            <span className="text-xs text-muted-foreground">{currentPeriod}</span>
          )}
          <Badge variant={isFinal ? 'secondary' : isLive ? 'default' : 'outline'}>
            {isFinal ? 'Final' : isLive ? 'Live' : 'Scheduled'}
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4">
        <div className="text-center flex-1">
          <div className="text-sm font-medium truncate">{game.away_team}</div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {hasScores ? displayAwayScore : '-'}
          </div>
        </div>
        <div className="text-muted-foreground">@</div>
        <div className="text-center flex-1">
          <div className="text-sm font-medium truncate">{game.home_team}</div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {hasScores ? displayHomeScore : '-'}
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

  // Quarter mode state
  const [q1Home, setQ1Home] = useState(game.q1_home_score?.toString() ?? '')
  const [q1Away, setQ1Away] = useState(game.q1_away_score?.toString() ?? '')
  const [halfHome, setHalfHome] = useState(game.halftime_home_score?.toString() ?? '')
  const [halfAway, setHalfAway] = useState(game.halftime_away_score?.toString() ?? '')
  const [q3Home, setQ3Home] = useState(game.q3_home_score?.toString() ?? '')
  const [q3Away, setQ3Away] = useState(game.q3_away_score?.toString() ?? '')
  const [finalHome, setFinalHome] = useState(game.home_score?.toString() ?? '')
  const [finalAway, setFinalAway] = useState(game.away_score?.toString() ?? '')
  const [status, setStatus] = useState(game.status ?? 'scheduled')

  const sortedScoreChanges = [...scoreChanges].sort((a, b) => a.change_order - b.change_order)
  const lastScoreChange = sortedScoreChanges[sortedScoreChanges.length - 1]
  const lastHomeScore = lastScoreChange?.home_score ?? 0
  const lastAwayScore = lastScoreChange?.away_score ?? 0

  const handleOpen = () => {
    if (scoringMode === 'score_change') {
      setNewScoreHome(lastHomeScore.toString())
      setNewScoreAway(lastAwayScore.toString())
    } else {
      // Quarter mode - reset to current values
      setQ1Home(game.q1_home_score?.toString() ?? '')
      setQ1Away(game.q1_away_score?.toString() ?? '')
      setHalfHome(game.halftime_home_score?.toString() ?? '')
      setHalfAway(game.halftime_away_score?.toString() ?? '')
      setQ3Home(game.q3_home_score?.toString() ?? '')
      setQ3Away(game.q3_away_score?.toString() ?? '')
      setFinalHome(game.home_score?.toString() ?? '')
      setFinalAway(game.away_score?.toString() ?? '')
      setStatus(game.status ?? 'scheduled')
    }
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

  // Quarter mode submit handler
  const handleQuarterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // Update game with quarter scores
    const updates: Record<string, unknown> = {
      status,
      q1_home_score: q1Home !== '' ? parseInt(q1Home, 10) : null,
      q1_away_score: q1Away !== '' ? parseInt(q1Away, 10) : null,
      halftime_home_score: halfHome !== '' ? parseInt(halfHome, 10) : null,
      halftime_away_score: halfAway !== '' ? parseInt(halfAway, 10) : null,
      q3_home_score: q3Home !== '' ? parseInt(q3Home, 10) : null,
      q3_away_score: q3Away !== '' ? parseInt(q3Away, 10) : null,
      home_score: finalHome !== '' ? parseInt(finalHome, 10) : null,
      away_score: finalAway !== '' ? parseInt(finalAway, 10) : null,
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

    // Helper to record a winner for a quarter
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

        // Only add reverse if different from forward
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

    // Calculate winners for each quarter that has scores
    if (q1Home !== '' && q1Away !== '') {
      await recordWinner(parseInt(q1Home, 10), parseInt(q1Away, 10), 'q1', 'q1_reverse')
    }
    if (halfHome !== '' && halfAway !== '') {
      await recordWinner(parseInt(halfHome, 10), parseInt(halfAway, 10), 'halftime', 'halftime_reverse')
    }
    if (q3Home !== '' && q3Away !== '') {
      await recordWinner(parseInt(q3Home, 10), parseInt(q3Away, 10), 'q3', 'q3_reverse')
    }
    if (status === 'final' && finalHome !== '' && finalAway !== '') {
      // Use score_change_final types (DB constraint doesn't allow 'final'/'final_reverse')
      await recordWinner(parseInt(finalHome, 10), parseInt(finalAway, 10), 'score_change_final', 'score_change_final_reverse')
    }

    setIsLoading(false)
    setIsOpen(false)
    router.refresh()
  }

  const isFinal = game.status === 'final'
  const isQuarterMode = scoringMode === 'quarter'

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

        {isQuarterMode ? (
          <form onSubmit={handleQuarterSubmit}>
            <div className="space-y-4 py-4">
              {/* Team labels row */}
              <div className="grid grid-cols-3 gap-2 items-center">
                <div className="text-center text-xs text-muted-foreground truncate">{game.away_team}</div>
                <div></div>
                <div className="text-center text-xs text-muted-foreground truncate">{game.home_team}</div>
              </div>

              {/* Q1 */}
              <div>
                <Label className="text-sm font-medium mb-2 block">End of Q1</Label>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Input
                    type="number"
                    min="0"
                    value={q1Away}
                    onChange={(e) => setQ1Away(e.target.value)}
                    className="text-center"
                  />
                  <div className="text-center text-muted-foreground text-sm">-</div>
                  <Input
                    type="number"
                    min="0"
                    value={q1Home}
                    onChange={(e) => setQ1Home(e.target.value)}
                    className="text-center"
                  />
                </div>
              </div>

              {/* Halftime */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Halftime</Label>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Input
                    type="number"
                    min="0"
                    value={halfAway}
                    onChange={(e) => setHalfAway(e.target.value)}
                    className="text-center"
                  />
                  <div className="text-center text-muted-foreground text-sm">-</div>
                  <Input
                    type="number"
                    min="0"
                    value={halfHome}
                    onChange={(e) => setHalfHome(e.target.value)}
                    className="text-center"
                  />
                </div>
              </div>

              {/* Q3 */}
              <div>
                <Label className="text-sm font-medium mb-2 block">End of Q3</Label>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Input
                    type="number"
                    min="0"
                    value={q3Away}
                    onChange={(e) => setQ3Away(e.target.value)}
                    className="text-center"
                  />
                  <div className="text-center text-muted-foreground text-sm">-</div>
                  <Input
                    type="number"
                    min="0"
                    value={q3Home}
                    onChange={(e) => setQ3Home(e.target.value)}
                    className="text-center"
                  />
                </div>
              </div>

              {/* Final */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Final Score</Label>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <Input
                    type="number"
                    min="0"
                    value={finalAway}
                    onChange={(e) => setFinalAway(e.target.value)}
                    className="text-center text-lg font-bold"
                  />
                  <div className="text-center text-muted-foreground">-</div>
                  <Input
                    type="number"
                    min="0"
                    value={finalHome}
                    onChange={(e) => setFinalHome(e.target.value)}
                    className="text-center text-lg font-bold"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2 pt-2">
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
                {isLoading ? 'Saving...' : 'Save Scores'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Score Change Mode */
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
        )}
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

export function SingleGameContent({
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
  isSuperAdmin = false,
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

  // Define hierarchy for quarter/score_change mode (higher number = higher priority display)
  const roundHierarchy: Record<string, number> = {
    score_change_forward: 1,
    score_change_reverse: 1,
    score_change_both: 2,
    score_change_final: 3,
    score_change_final_reverse: 3,
    score_change_final_both: 4,
  }

  if (numbersLocked) {
    for (const winner of winners) {
      if (winner.square_id) {
        let round: WinningRound = null

        // Score change mode win types
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
        }
        // Quarter mode - q1, halftime, q3 (forward)
        // Note: Quarter mode final scores use score_change_final types (handled above) due to DB constraint
        else if (winner.win_type === 'q1' || winner.win_type === 'halftime' || winner.win_type === 'q3') {
          const reverseType = `${winner.win_type}_reverse`
          const alsoReverse = winners.some(
            (w) => w.square_id === winner.square_id && w.win_type === reverseType
          )
          round = alsoReverse ? 'score_change_both' : 'score_change_forward'
        }
        // Quarter mode - q1_reverse, halftime_reverse, q3_reverse
        else if (winner.win_type === 'q1_reverse' || winner.win_type === 'halftime_reverse' || winner.win_type === 'q3_reverse') {
          const forwardType = winner.win_type.replace('_reverse', '')
          const alsoForward = winners.some(
            (w) => w.square_id === winner.square_id && w.win_type === forwardType
          )
          round = alsoForward ? 'score_change_both' : 'score_change_reverse'
        }

        if (round) {
          const existing = winningSquareRounds.get(winner.square_id)
          const existingRank = existing ? roundHierarchy[existing] ?? 0 : 0
          const newRank = roundHierarchy[round] ?? 0

          // Use hierarchy: final > both > forward/reverse
          if (newRank >= existingRank) {
            winningSquareRounds.set(winner.square_id, round)
          }
        }
      }
    }
  }

  // Calculate live winning squares from in-progress games
  const liveWinningSquareIds = new Set<string>()
  if (numbersLocked && rowNumbers && colNumbers) {
    // Create a map of squares by position for quick lookup
    const squaresByPosition = new Map<string, NoAccountSquare>()
    for (const sq of squares) {
      squaresByPosition.set(`${sq.row_index}-${sq.col_index}`, sq)
    }

    // Check each in-progress game
    for (const game of games) {
      if (game.status !== 'in_progress') continue
      if (game.home_score === null || game.away_score === null) continue

      const homeDigit = game.home_score % 10
      const awayDigit = game.away_score % 10

      // Find row/col indices that match these digits
      const homeRowIdx = rowNumbers.indexOf(homeDigit)
      const awayColIdx = colNumbers.indexOf(awayDigit)

      if (homeRowIdx !== -1 && awayColIdx !== -1) {
        // Forward scoring square
        const forwardSquare = squaresByPosition.get(`${homeRowIdx}-${awayColIdx}`)
        if (forwardSquare?.id) {
          liveWinningSquareIds.add(forwardSquare.id)
        }

        // Reverse scoring square (if enabled)
        if (reverseScoring) {
          const reverseHomeRowIdx = rowNumbers.indexOf(awayDigit)
          const reverseAwayColIdx = colNumbers.indexOf(homeDigit)
          if (reverseHomeRowIdx !== -1 && reverseAwayColIdx !== -1) {
            const reverseSquare = squaresByPosition.get(`${reverseHomeRowIdx}-${reverseAwayColIdx}`)
            if (reverseSquare?.id) {
              liveWinningSquareIds.add(reverseSquare.id)
            }
          }
        }
      }
    }
  }

  // Calculate payouts by participant name (count wins, not payout amounts)
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

  // Get first game for labels
  const firstGame = games[0] ?? null
  const homeTeamLabel = firstGame?.home_team ?? 'Home'
  const awayTeamLabel = firstGame?.away_team ?? 'Away'

  // Both score_change and quarter modes use the same color scheme now
  const legendMode = 'score_change'

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
              <SquaresGrid
                sqPoolId={sqPoolId}
                squares={squares}
                rowNumbers={rowNumbers}
                colNumbers={colNumbers}
                numbersLocked={numbersLocked}
                isCommissioner={isCommissioner}
                winningSquareRounds={winningSquareRounds}
                liveWinningSquareIds={liveWinningSquareIds}
                homeTeamLabel={homeTeamLabel}
                awayTeamLabel={awayTeamLabel}
                legendMode={legendMode}
                onSquareClick={handleSquareClick}
              />
            </CardContent>
          </Card>

          {/* Participant Summary - Commissioner only */}
          {isCommissioner && (
            <ParticipantSummaryPanel sqPoolId={sqPoolId} />
          )}

          {/* Game - only show after numbers locked */}
          {numbersLocked && firstGame && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Game</CardTitle>
                  {isCommissioner && (
                    <EditGameTeamsButton
                      gameId={firstGame.id}
                      gameName={firstGame.game_name}
                      homeTeam={firstGame.home_team}
                      awayTeam={firstGame.away_team}
                      espnGameId={firstGame.espn_game_id}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <SimpleGameScoreCard
                  game={firstGame}
                  scoringMode={scoringMode ?? 'quarter'}
                />

                {/* Final Winner Display */}
                {firstGame.status === 'final' && (() => {
                  // Both score_change and quarter modes use score_change_final types (DB constraint)
                  const finalWinner = winners.find(w => w.win_type === 'score_change_final')
                  const finalReverseWinner = winners.find(w => w.win_type === 'score_change_final_reverse')

                  if (!finalWinner && !finalReverseWinner) return null

                  return (
                    <div className="rounded-lg border-2 border-purple-300 bg-purple-50 p-4">
                      <div className="text-center space-y-2">
                        <div className="text-xs font-medium text-purple-600 uppercase tracking-wide">
                          Final Winner{reverseScoring ? 's' : ''}
                        </div>
                        <div className="flex items-center justify-center gap-6">
                          {finalWinner && (
                            <div className="text-center">
                              {reverseScoring && (
                                <div className="text-xs text-muted-foreground mb-1">Forward</div>
                              )}
                              <div className="text-xl font-bold text-purple-700">
                                {finalWinner.winner_name || 'Unclaimed'}
                              </div>
                            </div>
                          )}
                          {reverseScoring && finalReverseWinner && (
                            <div className="text-center">
                              <div className="text-xs text-muted-foreground mb-1">Reverse</div>
                              <div className="text-xl font-bold text-fuchsia-700">
                                {finalReverseWinner.winner_name || 'Unclaimed'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Commissioner score entry */}
                {isCommissioner && (
                  <NoAccountScoreEntry
                    game={firstGame}
                    sqPoolId={sqPoolId}
                    scoringMode={scoringMode ?? 'quarter'}
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
            <PoolSettings
              sqPoolId={sqPoolId}
              poolId={poolId}
              publicSlug={publicSlug}
              numbersLocked={numbersLocked}
              reverseScoring={reverseScoring}
              mode={mode}
              scoringMode={scoringMode}
              poolStatus={poolStatus}
              onBulkAssignClick={() => setBulkDialogOpen(true)}
              isSuperAdmin={isSuperAdmin}
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
