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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trash2 } from 'lucide-react'

interface SqPool {
  id: string
  pool_id: string
  reverse_scoring: boolean | null
  row_numbers: number[] | null
  col_numbers: number[] | null
  scoring_mode: string | null
}

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
}

interface ScoreChange {
  id: string
  sq_game_id: string | null
  home_score: number
  away_score: number
  change_order: number
}

interface SingleGameScoreEntryProps {
  game: SqGame
  sqPool: SqPool
  scoreChanges: ScoreChange[]
}

export function SingleGameScoreEntry({ game, sqPool, scoreChanges }: SingleGameScoreEntryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isQuarterMode = sqPool.scoring_mode === 'quarter'
  const isScoreChangeMode = sqPool.scoring_mode === 'score_change'

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

  // Score change mode state
  const [newScoreHome, setNewScoreHome] = useState('')
  const [newScoreAway, setNewScoreAway] = useState('')

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [scoreChangeToDelete, setScoreChangeToDelete] = useState<ScoreChange | null>(null)

  // Get the last score change for pre-population
  const sortedScoreChanges = [...scoreChanges].sort((a, b) => a.change_order - b.change_order)
  const lastScoreChange = sortedScoreChanges[sortedScoreChanges.length - 1]
  const lastHomeScore = lastScoreChange?.home_score ?? 0
  const lastAwayScore = lastScoreChange?.away_score ?? 0

  const handleOpen = () => {
    setQ1Home(game.q1_home_score?.toString() ?? '')
    setQ1Away(game.q1_away_score?.toString() ?? '')
    setHalfHome(game.halftime_home_score?.toString() ?? '')
    setHalfAway(game.halftime_away_score?.toString() ?? '')
    setQ3Home(game.q3_home_score?.toString() ?? '')
    setQ3Away(game.q3_away_score?.toString() ?? '')
    setFinalHome(game.home_score?.toString() ?? '')
    setFinalAway(game.away_score?.toString() ?? '')
    setStatus(game.status ?? 'scheduled')
    // Pre-populate with last scores
    setNewScoreHome(lastHomeScore.toString())
    setNewScoreAway(lastAwayScore.toString())
    setError(null)
    setIsOpen(true)
  }

  // Quarter mode submit
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

    // Calculate winners for each quarter that has scores
    if (sqPool.row_numbers && sqPool.col_numbers) {
      await calculateQuarterWinners(
        supabase,
        game.id,
        sqPool.id,
        {
          q1Home: q1Home !== '' ? parseInt(q1Home, 10) : null,
          q1Away: q1Away !== '' ? parseInt(q1Away, 10) : null,
          halfHome: halfHome !== '' ? parseInt(halfHome, 10) : null,
          halfAway: halfAway !== '' ? parseInt(halfAway, 10) : null,
          q3Home: q3Home !== '' ? parseInt(q3Home, 10) : null,
          q3Away: q3Away !== '' ? parseInt(q3Away, 10) : null,
          finalHome: status === 'final' && finalHome !== '' ? parseInt(finalHome, 10) : null,
          finalAway: status === 'final' && finalAway !== '' ? parseInt(finalAway, 10) : null,
        },
        sqPool.row_numbers,
        sqPool.col_numbers,
        sqPool.reverse_scoring ?? true
      )
    }

    setIsLoading(false)
    setIsOpen(false)
    router.refresh()
  }

  // Score change mode - add new score
  const handleAddScoreChange = async () => {
    if (newScoreHome === '' || newScoreAway === '') {
      setError('Please enter both scores')
      return
    }

    const homeScore = parseInt(newScoreHome, 10)
    const awayScore = parseInt(newScoreAway, 10)

    // Validation: scores cannot decrease
    if (homeScore < lastHomeScore) {
      setError(`${game.home_team} score cannot be less than ${lastHomeScore}`)
      return
    }
    if (awayScore < lastAwayScore) {
      setError(`${game.away_team} score cannot be less than ${lastAwayScore}`)
      return
    }

    // Validation: only one team's score can change at a time
    const homeChanged = homeScore !== lastHomeScore
    const awayChanged = awayScore !== lastAwayScore
    if (homeChanged && awayChanged) {
      setError('Only one team can score at a time')
      return
    }

    // Validation: at least one score must change
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

    // Update game with current score
    const { error: updateError } = await supabase
      .from('sq_games')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'in_progress',
      })
      .eq('id', game.id)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    // Calculate winner for this score change
    if (sqPool.row_numbers && sqPool.col_numbers) {
      await calculateScoreChangeWinner(
        supabase,
        game.id,
        sqPool.id,
        homeScore,
        awayScore,
        nextOrder,
        sqPool.row_numbers,
        sqPool.col_numbers,
        sqPool.reverse_scoring ?? true
      )
    }

    // Reset to new scores for next entry
    setNewScoreHome(homeScore.toString())
    setNewScoreAway(awayScore.toString())
    setIsLoading(false)
    router.refresh()
  }

  // Mark game as final (score change mode)
  const handleMarkFinal = async () => {
    setIsLoading(true)
    setError(null)
    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('sq_games')
      .update({ status: 'final' })
      .eq('id', game.id)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    // Create final score winners
    if (sqPool.row_numbers && sqPool.col_numbers && lastScoreChange) {
      await calculateFinalScoreWinner(
        supabase,
        game.id,
        sqPool.id,
        lastScoreChange.home_score,
        lastScoreChange.away_score,
        sqPool.row_numbers,
        sqPool.col_numbers,
        sqPool.reverse_scoring ?? true
      )
    }

    setIsLoading(false)
    setIsOpen(false)
    router.refresh()
  }

  // Add 0-0 as first score (score change mode)
  const handleAddZeroZero = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // Insert 0-0 score change
    const { error: insertError } = await supabase
      .from('sq_score_changes')
      .insert({
        sq_game_id: game.id,
        home_score: 0,
        away_score: 0,
        change_order: 1,
      })

    if (insertError) {
      setError(insertError.message)
      setIsLoading(false)
      return
    }

    // Update game
    const { error: updateError } = await supabase
      .from('sq_games')
      .update({
        home_score: 0,
        away_score: 0,
        status: 'in_progress',
      })
      .eq('id', game.id)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    // Calculate winner for 0-0
    if (sqPool.row_numbers && sqPool.col_numbers) {
      await calculateScoreChangeWinner(
        supabase,
        game.id,
        sqPool.id,
        0,
        0,
        1,
        sqPool.row_numbers,
        sqPool.col_numbers,
        sqPool.reverse_scoring ?? true
      )
    }

    setIsLoading(false)
    router.refresh()
  }

  // Delete score change handler
  const handleDeleteScoreChange = (scoreChange: ScoreChange) => {
    setScoreChangeToDelete(scoreChange)
    setDeleteConfirmOpen(true)
  }

  const confirmDeleteScoreChange = async () => {
    if (!scoreChangeToDelete) return

    setIsLoading(true)
    setError(null)
    const supabase = createClient()

    // Get all score changes that need to be deleted (this one and all after it)
    const changesToDelete = sortedScoreChanges.filter(
      (sc) => sc.change_order >= scoreChangeToDelete.change_order
    )
    const changeOrdersToDelete = changesToDelete.map((sc) => sc.change_order)

    // Delete winners for all affected score changes
    // Winners with payout matching the change_order
    for (const order of changeOrdersToDelete) {
      await supabase
        .from('sq_winners')
        .delete()
        .eq('sq_game_id', game.id)
        .eq('payout', order)
        .in('win_type', ['score_change', 'score_change_reverse'])
    }

    // Delete the score changes
    const idsToDelete = changesToDelete.map((sc) => sc.id)
    const { error: deleteError } = await supabase
      .from('sq_score_changes')
      .delete()
      .in('id', idsToDelete)

    if (deleteError) {
      setError(deleteError.message)
      setIsLoading(false)
      setDeleteConfirmOpen(false)
      return
    }

    // Update game with the previous score (before deleted one)
    const remainingChanges = sortedScoreChanges.filter(
      (sc) => sc.change_order < scoreChangeToDelete.change_order
    )
    const newLastChange = remainingChanges[remainingChanges.length - 1]

    if (newLastChange) {
      await supabase
        .from('sq_games')
        .update({
          home_score: newLastChange.home_score,
          away_score: newLastChange.away_score,
        })
        .eq('id', game.id)
    } else {
      // No more score changes, reset game
      await supabase
        .from('sq_games')
        .update({
          home_score: null,
          away_score: null,
          status: 'scheduled',
        })
        .eq('id', game.id)
    }

    setIsLoading(false)
    setDeleteConfirmOpen(false)
    setScoreChangeToDelete(null)
    router.refresh()
  }

  const isFinal = game.status === 'final'
  const isLastScoreChange = (sc: ScoreChange) =>
    sc.change_order === sortedScoreChanges[sortedScoreChanges.length - 1]?.change_order
  const deletesMultiple = scoreChangeToDelete
    ? sortedScoreChanges.filter((sc) => sc.change_order >= scoreChangeToDelete.change_order).length > 1
    : false

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={handleOpen}>
          {isFinal ? 'Edit Scores' : 'Enter Scores'}
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
              {/* Quarter score inputs */}
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="all">All Quarters</TabsTrigger>
                  <TabsTrigger value="quick">Quick Entry</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="space-y-4 mt-4">
                  {/* Q1 */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">End of Q1</Label>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <Input
                        type="number"
                        min="0"
                        value={q1Away}
                        onChange={(e) => setQ1Away(e.target.value)}
                        placeholder={game.away_team}
                        className="text-center"
                      />
                      <div className="text-center text-muted-foreground text-sm">-</div>
                      <Input
                        type="number"
                        min="0"
                        value={q1Home}
                        onChange={(e) => setQ1Home(e.target.value)}
                        placeholder={game.home_team}
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
                        placeholder={game.away_team}
                        className="text-center"
                      />
                      <div className="text-center text-muted-foreground text-sm">-</div>
                      <Input
                        type="number"
                        min="0"
                        value={halfHome}
                        onChange={(e) => setHalfHome(e.target.value)}
                        placeholder={game.home_team}
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
                        placeholder={game.away_team}
                        className="text-center"
                      />
                      <div className="text-center text-muted-foreground text-sm">-</div>
                      <Input
                        type="number"
                        min="0"
                        value={q3Home}
                        onChange={(e) => setQ3Home(e.target.value)}
                        placeholder={game.home_team}
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
                        placeholder={game.away_team}
                        className="text-center text-lg font-bold"
                      />
                      <div className="text-center text-muted-foreground">-</div>
                      <Input
                        type="number"
                        min="0"
                        value={finalHome}
                        onChange={(e) => setFinalHome(e.target.value)}
                        placeholder={game.home_team}
                        className="text-center text-lg font-bold"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="quick" className="mt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter just the final score and status. Use &quot;All Quarters&quot; tab to enter quarter-by-quarter scores.
                  </p>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Final Score</Label>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <Input
                        type="number"
                        min="0"
                        value={finalAway}
                        onChange={(e) => setFinalAway(e.target.value)}
                        placeholder={game.away_team}
                        className="text-center text-xl font-bold h-14"
                      />
                      <div className="text-center text-muted-foreground text-lg">@</div>
                      <Input
                        type="number"
                        min="0"
                        value={finalHome}
                        onChange={(e) => setFinalHome(e.target.value)}
                        placeholder={game.home_team}
                        className="text-center text-xl font-bold h-14"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

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

            {/* Start game button (adds 0-0) */}
            {scoreChanges.length === 0 && (
              <Button
                onClick={handleAddZeroZero}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                Start Game (0-0)
              </Button>
            )}

            {/* Score Change Log with delete buttons (newest first) */}
            {sortedScoreChanges.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Score Log (newest first)</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-2 bg-muted/30">
                  {[...sortedScoreChanges].reverse().map((sc) => (
                    <div
                      key={sc.id}
                      className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">#{sc.change_order}</span>
                        <span className="font-mono font-medium">
                          {sc.away_score} - {sc.home_score}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          [{sc.away_score % 10}-{sc.home_score % 10}]
                        </span>
                      </div>
                      {!isFinal && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteScoreChange(sc)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add new score change */}
            {scoreChanges.length > 0 && !isFinal && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Add Score Change</Label>
                  <span className="text-xs text-muted-foreground">
                    Only one team can score at a time
                  </span>
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
                <Button
                  onClick={handleAddScoreChange}
                  disabled={isLoading}
                  className="w-full"
                >
                  Add Score Change
                </Button>
              </div>
            )}

            {/* Mark final button */}
            {scoreChanges.length > 0 && !isFinal && (
              <Button
                onClick={handleMarkFinal}
                disabled={isLoading}
                variant="secondary"
                className="w-full"
              >
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

    {/* Delete confirmation dialog */}
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {deletesMultiple ? 'Delete Multiple Score Changes?' : 'Delete Score Change?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deletesMultiple ? (
              <>
                Deleting score #{scoreChangeToDelete?.change_order} will also delete all{' '}
                <strong>
                  {sortedScoreChanges.filter(
                    (sc) => sc.change_order > (scoreChangeToDelete?.change_order ?? 0)
                  ).length}{' '}
                  score changes after it
                </strong>{' '}
                and their associated winners. This cannot be undone.
              </>
            ) : (
              <>
                This will delete score #{scoreChangeToDelete?.change_order} (
                {scoreChangeToDelete?.away_score}-{scoreChangeToDelete?.home_score}) and its
                associated winners. This cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDeleteScoreChange}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Deleting...' : deletesMultiple ? 'Delete All' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  )
}

// Helper: Calculate winners for quarter mode
async function calculateQuarterWinners(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  sqPoolId: string,
  scores: {
    q1Home: number | null
    q1Away: number | null
    halfHome: number | null
    halfAway: number | null
    q3Home: number | null
    q3Away: number | null
    finalHome: number | null
    finalAway: number | null
  },
  rowNumbers: number[],
  colNumbers: number[],
  reverseScoring: boolean
) {
  // Delete existing winners for this game
  await supabase.from('sq_winners').delete().eq('sq_game_id', gameId)

  const recordWinner = async (
    homeScore: number,
    awayScore: number,
    winType: string,
    reverseWinType: string
  ) => {
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10

    const rowIndex = rowNumbers.findIndex((n) => n === homeDigit)
    const colIndex = colNumbers.findIndex((n) => n === awayDigit)

    const { data: normalSquare } = await supabase
      .from('sq_squares')
      .select('id')
      .eq('sq_pool_id', sqPoolId)
      .eq('row_index', rowIndex)
      .eq('col_index', colIndex)
      .single()

    if (normalSquare) {
      await supabase.from('sq_winners').insert({
        sq_game_id: gameId,
        square_id: normalSquare.id,
        win_type: winType,
      })
    }

    if (reverseScoring) {
      const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
      const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)

      if (reverseRowIndex !== rowIndex || reverseColIndex !== colIndex) {
        const { data: reverseSquare } = await supabase
          .from('sq_squares')
          .select('id')
          .eq('sq_pool_id', sqPoolId)
          .eq('row_index', reverseRowIndex)
          .eq('col_index', reverseColIndex)
          .single()

        if (reverseSquare) {
          await supabase.from('sq_winners').insert({
            sq_game_id: gameId,
            square_id: reverseSquare.id,
            win_type: reverseWinType,
          })
        }
      }
    }
  }

  // Q1 winners
  if (scores.q1Home !== null && scores.q1Away !== null) {
    await recordWinner(scores.q1Home, scores.q1Away, 'q1', 'q1_reverse')
  }

  // Halftime winners
  if (scores.halfHome !== null && scores.halfAway !== null) {
    await recordWinner(scores.halfHome, scores.halfAway, 'halftime', 'halftime_reverse')
  }

  // Q3 winners
  if (scores.q3Home !== null && scores.q3Away !== null) {
    await recordWinner(scores.q3Home, scores.q3Away, 'q3', 'q3_reverse')
  }

  // Final winners
  if (scores.finalHome !== null && scores.finalAway !== null) {
    await recordWinner(scores.finalHome, scores.finalAway, 'normal', 'reverse')
  }
}

// Helper: Calculate winner for a single score change
async function calculateScoreChangeWinner(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  sqPoolId: string,
  homeScore: number,
  awayScore: number,
  changeOrder: number,
  rowNumbers: number[],
  colNumbers: number[],
  reverseScoring: boolean
) {
  const homeDigit = homeScore % 10
  const awayDigit = awayScore % 10

  const rowIndex = rowNumbers.findIndex((n) => n === homeDigit)
  const colIndex = colNumbers.findIndex((n) => n === awayDigit)

  const { data: normalSquare } = await supabase
    .from('sq_squares')
    .select('id')
    .eq('sq_pool_id', sqPoolId)
    .eq('row_index', rowIndex)
    .eq('col_index', colIndex)
    .single()

  if (normalSquare) {
    await supabase.from('sq_winners').insert({
      sq_game_id: gameId,
      square_id: normalSquare.id,
      win_type: 'score_change',
      payout: changeOrder, // Store change_order in payout for reference
    })
  }

  if (reverseScoring) {
    const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
    const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)

    // Always create reverse winner (even if same square as forward)
    // This allows the UI to show the "both" gradient for squares that win both ways
    const { data: reverseSquare } = await supabase
      .from('sq_squares')
      .select('id')
      .eq('sq_pool_id', sqPoolId)
      .eq('row_index', reverseRowIndex)
      .eq('col_index', reverseColIndex)
      .single()

    if (reverseSquare) {
      await supabase.from('sq_winners').insert({
        sq_game_id: gameId,
        square_id: reverseSquare.id,
        win_type: 'score_change_reverse',
        payout: changeOrder,
      })
    }
  }
}

// Helper: Calculate winner for final score (purple highlighting)
async function calculateFinalScoreWinner(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  sqPoolId: string,
  homeScore: number,
  awayScore: number,
  rowNumbers: number[],
  colNumbers: number[],
  reverseScoring: boolean
) {
  const homeDigit = homeScore % 10
  const awayDigit = awayScore % 10

  const rowIndex = rowNumbers.findIndex((n) => n === homeDigit)
  const colIndex = colNumbers.findIndex((n) => n === awayDigit)

  const { data: normalSquare } = await supabase
    .from('sq_squares')
    .select('id')
    .eq('sq_pool_id', sqPoolId)
    .eq('row_index', rowIndex)
    .eq('col_index', colIndex)
    .single()

  if (normalSquare) {
    await supabase.from('sq_winners').insert({
      sq_game_id: gameId,
      square_id: normalSquare.id,
      win_type: 'score_change_final',
    })
  }

  if (reverseScoring) {
    const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
    const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)

    // Always create reverse winner (even if same square as forward)
    const { data: reverseSquare } = await supabase
      .from('sq_squares')
      .select('id')
      .eq('sq_pool_id', sqPoolId)
      .eq('row_index', reverseRowIndex)
      .eq('col_index', reverseColIndex)
      .single()

    if (reverseSquare) {
      await supabase.from('sq_winners').insert({
        sq_game_id: gameId,
        square_id: reverseSquare.id,
        win_type: 'score_change_final_reverse',
      })
    }
  }
}
