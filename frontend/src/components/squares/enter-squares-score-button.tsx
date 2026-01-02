'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

interface EnterSquaresScoreButtonProps {
  gameId: string
  sqPoolId: string
  gameName: string
  homeTeam: string
  awayTeam: string
  currentHomeScore: number | null
  currentAwayScore: number | null
  currentHalftimeHomeScore: number | null
  currentHalftimeAwayScore: number | null
  currentStatus: string | null
  paysHalftime: boolean
  reverseScoring: boolean
  rowNumbers: number[] | null
  colNumbers: number[] | null
}

export function EnterSquaresScoreButton({
  gameId,
  sqPoolId,
  gameName,
  homeTeam,
  awayTeam,
  currentHomeScore,
  currentAwayScore,
  currentHalftimeHomeScore,
  currentHalftimeAwayScore,
  currentStatus,
  paysHalftime,
  reverseScoring,
  rowNumbers,
  colNumbers,
}: EnterSquaresScoreButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [homeScore, setHomeScore] = useState(currentHomeScore?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(currentAwayScore?.toString() ?? '')
  const [halftimeHomeScore, setHalftimeHomeScore] = useState(
    currentHalftimeHomeScore?.toString() ?? ''
  )
  const [halftimeAwayScore, setHalftimeAwayScore] = useState(
    currentHalftimeAwayScore?.toString() ?? ''
  )
  const [status, setStatus] = useState(currentStatus ?? 'scheduled')

  const handleOpen = () => {
    setHomeScore(currentHomeScore?.toString() ?? '')
    setAwayScore(currentAwayScore?.toString() ?? '')
    setHalftimeHomeScore(currentHalftimeHomeScore?.toString() ?? '')
    setHalftimeAwayScore(currentHalftimeAwayScore?.toString() ?? '')
    setStatus(currentStatus ?? 'scheduled')
    setError(null)
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate scores if status is final
    if (status === 'final') {
      if (homeScore === '' || awayScore === '') {
        setError('Please enter both final scores')
        setIsLoading(false)
        return
      }
      if (paysHalftime && (halftimeHomeScore === '' || halftimeAwayScore === '')) {
        setError('Please enter halftime scores for this game')
        setIsLoading(false)
        return
      }
    }

    const supabase = createClient()

    const updates: Record<string, unknown> = {
      status,
      home_score: homeScore !== '' ? parseInt(homeScore, 10) : null,
      away_score: awayScore !== '' ? parseInt(awayScore, 10) : null,
      halftime_home_score: halftimeHomeScore !== '' ? parseInt(halftimeHomeScore, 10) : null,
      halftime_away_score: halftimeAwayScore !== '' ? parseInt(halftimeAwayScore, 10) : null,
    }

    const { error: updateError } = await supabase
      .from('sq_games')
      .update(updates)
      .eq('id', gameId)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    // Calculate and record winners
    if (rowNumbers && colNumbers) {
      // Record halftime winners if halftime scores are entered (even if game not final)
      const hasHalftimeScores = paysHalftime && halftimeHomeScore !== '' && halftimeAwayScore !== ''
      // Record final winners only when game is final
      const hasFinalScores = status === 'final' && homeScore !== '' && awayScore !== ''

      if (hasHalftimeScores || hasFinalScores) {
        await calculateAndRecordWinners(
          supabase,
          gameId,
          sqPoolId,
          hasFinalScores ? parseInt(homeScore, 10) : null,
          hasFinalScores ? parseInt(awayScore, 10) : null,
          hasHalftimeScores ? parseInt(halftimeHomeScore, 10) : null,
          hasHalftimeScores ? parseInt(halftimeAwayScore, 10) : null,
          rowNumbers,
          colNumbers,
          reverseScoring
        )
      }
    }

    setIsLoading(false)
    setIsOpen(false)
    router.refresh()
  }

  const isFinal = currentStatus === 'final'

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleOpen}>
          {isFinal ? 'Edit Score' : 'Enter Score'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Score</DialogTitle>
          <DialogDescription>{gameName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Final Score Entry */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Final Score</Label>
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-center">
                  <Label className="block mb-2 text-xs text-muted-foreground">{awayTeam}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    className="text-2xl font-bold text-center h-14"
                    placeholder="0"
                  />
                </div>

                <div className="text-center text-muted-foreground text-lg font-medium pt-6">@</div>

                <div className="text-center">
                  <Label className="block mb-2 text-xs text-muted-foreground">{homeTeam}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    className="text-2xl font-bold text-center h-14"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Halftime Score Entry (if pays halftime) */}
            {paysHalftime && (
              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">Halftime Score</Label>
                <div className="grid grid-cols-3 gap-4 items-center">
                  <div className="text-center">
                    <Input
                      type="number"
                      min="0"
                      value={halftimeAwayScore}
                      onChange={(e) => setHalftimeAwayScore(e.target.value)}
                      className="text-xl font-bold text-center h-12"
                      placeholder="0"
                    />
                  </div>

                  <div className="text-center text-muted-foreground text-sm">Halftime</div>

                  <div className="text-center">
                    <Input
                      type="number"
                      min="0"
                      value={halftimeHomeScore}
                      onChange={(e) => setHalftimeHomeScore(e.target.value)}
                      className="text-xl font-bold text-center h-12"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

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

            {/* Winner Preview (if final and numbers locked) */}
            {status === 'final' && homeScore && awayScore && rowNumbers && colNumbers && (
              <div className="bg-muted rounded-md p-3 text-sm">
                <div className="font-medium mb-1">Winners Preview:</div>
                <div className="space-y-1 text-muted-foreground">
                  <div>
                    Normal: Square {parseInt(awayScore) % 10}-{parseInt(homeScore) % 10}
                  </div>
                  {reverseScoring && (
                    <div>
                      Reverse: Square {parseInt(homeScore) % 10}-{parseInt(awayScore) % 10}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
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

// Helper function to get winner name from square
async function getWinnerName(
  supabase: ReturnType<typeof createClient>,
  userId: string | null
): Promise<string> {
  if (!userId) return 'Abandoned'

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', userId)
    .single()

  return profile?.display_name || profile?.email || 'Unknown'
}

// Helper function to find winning square and record winners
async function calculateAndRecordWinners(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  sqPoolId: string,
  homeScore: number | null,
  awayScore: number | null,
  halftimeHomeScore: number | null,
  halftimeAwayScore: number | null,
  rowNumbers: number[],
  colNumbers: number[],
  reverseScoring: boolean
) {
  // Delete existing winners for this game
  await supabase.from('sq_winners').delete().eq('sq_game_id', gameId)

  // Final score winners (only if we have final scores)
  if (homeScore !== null && awayScore !== null) {
    // Find the row/col indices for the winning numbers
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10

    // Find row index where the number matches homeDigit
    const rowIndex = rowNumbers.findIndex((n) => n === homeDigit)
    // Find col index where the number matches awayDigit
    const colIndex = colNumbers.findIndex((n) => n === awayDigit)

    // Get the winning square with user_id
    const { data: normalSquare } = await supabase
      .from('sq_squares')
      .select('id, user_id')
      .eq('sq_pool_id', sqPoolId)
      .eq('row_index', rowIndex)
      .eq('col_index', colIndex)
      .single()

    if (normalSquare) {
      const winnerName = await getWinnerName(supabase, normalSquare.user_id)
      await supabase.from('sq_winners').insert({
        sq_game_id: gameId,
        square_id: normalSquare.id,
        win_type: 'normal',
        winner_name: winnerName,
      })
    }

    // Reverse winner (if different square)
    if (reverseScoring) {
      const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
      const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)

      if (reverseRowIndex !== rowIndex || reverseColIndex !== colIndex) {
        const { data: reverseSquare } = await supabase
          .from('sq_squares')
          .select('id, user_id')
          .eq('sq_pool_id', sqPoolId)
          .eq('row_index', reverseRowIndex)
          .eq('col_index', reverseColIndex)
          .single()

        if (reverseSquare) {
          const winnerName = await getWinnerName(supabase, reverseSquare.user_id)
          await supabase.from('sq_winners').insert({
            sq_game_id: gameId,
            square_id: reverseSquare.id,
            win_type: 'reverse',
            winner_name: winnerName,
          })
        }
      }
    }
  }

  // Halftime winners (if applicable)
  if (halftimeHomeScore !== null && halftimeAwayScore !== null) {
    const htHomeDigit = halftimeHomeScore % 10
    const htAwayDigit = halftimeAwayScore % 10

    const htRowIndex = rowNumbers.findIndex((n) => n === htHomeDigit)
    const htColIndex = colNumbers.findIndex((n) => n === htAwayDigit)

    const { data: halftimeSquare } = await supabase
      .from('sq_squares')
      .select('id, user_id')
      .eq('sq_pool_id', sqPoolId)
      .eq('row_index', htRowIndex)
      .eq('col_index', htColIndex)
      .single()

    if (halftimeSquare) {
      const winnerName = await getWinnerName(supabase, halftimeSquare.user_id)
      await supabase.from('sq_winners').insert({
        sq_game_id: gameId,
        square_id: halftimeSquare.id,
        win_type: 'halftime',
        winner_name: winnerName,
      })
    }

    // Halftime reverse
    if (reverseScoring) {
      const htReverseRowIndex = rowNumbers.findIndex((n) => n === htAwayDigit)
      const htReverseColIndex = colNumbers.findIndex((n) => n === htHomeDigit)

      if (htReverseRowIndex !== htRowIndex || htReverseColIndex !== htColIndex) {
        const { data: htReverseSquare } = await supabase
          .from('sq_squares')
          .select('id, user_id')
          .eq('sq_pool_id', sqPoolId)
          .eq('row_index', htReverseRowIndex)
          .eq('col_index', htReverseColIndex)
          .single()

        if (htReverseSquare) {
          const winnerName = await getWinnerName(supabase, htReverseSquare.user_id)
          await supabase.from('sq_winners').insert({
            sq_game_id: gameId,
            square_id: htReverseSquare.id,
            win_type: 'halftime_reverse',
            winner_name: winnerName,
          })
        }
      }
    }
  }
}
