'use client'

import { useState, useEffect, useRef } from 'react'
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
  quarter_marker?: string[] | null
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

  // Local state for score changes - initialized from props when dialog opens
  const [localScoreChanges, setLocalScoreChanges] = useState<ScoreChange[]>(scoreChanges)

  // Track if we have pending local changes that shouldn't be overwritten
  const hasLocalChanges = useRef(false)

  // Only sync local state from props when dialog opens AND we don't have pending changes
  useEffect(() => {
    if (isOpen && !hasLocalChanges.current) {
      setLocalScoreChanges(scoreChanges)
    }
    // Reset the flag when dialog closes
    if (!isOpen) {
      hasLocalChanges.current = false
    }
  }, [isOpen, scoreChanges])

  const isQuarterMode = sqPool.scoring_mode === 'quarter'
  const isScoreChangeMode = sqPool.scoring_mode === 'score_change'
  const isHybridMode = sqPool.scoring_mode === 'hybrid'

  // Derive which quarters are marked (for hybrid mode)
  const quartersMarked = {
    q1: localScoreChanges.some((sc) => sc.quarter_marker?.includes('q1')),
    halftime: localScoreChanges.some((sc) => sc.quarter_marker?.includes('halftime')),
    q3: localScoreChanges.some((sc) => sc.quarter_marker?.includes('q3')),
    final: localScoreChanges.some((sc) => sc.quarter_marker?.includes('final')),
  }

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
  const sortedScoreChanges = [...localScoreChanges].sort((a, b) => a.change_order - b.change_order)
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
    // router.refresh() will be called by handleOpenChange when dialog closes
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
    const nextOrder = localScoreChanges.length + 1

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

    // Immediately update local state with constructed row
    const newScoreChange: ScoreChange = {
      id: crypto.randomUUID(),
      sq_game_id: game.id,
      home_score: homeScore,
      away_score: awayScore,
      change_order: nextOrder,
      quarter_marker: null,
    }
    hasLocalChanges.current = true
    setLocalScoreChanges((prev) => [...prev, newScoreChange])

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
    // Don't call router.refresh() - local state already updated
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
    // router.refresh() will be called by handleOpenChange when dialog closes
  }

  // Mark quarter winner (hybrid mode)
  const handleMarkQuarter = async (quarter: 'q1' | 'halftime' | 'q3' | 'final') => {
    if (!lastScoreChange) return

    setIsLoading(true)
    setError(null)
    const supabase = createClient()

    // Build new quarter_marker array by appending to existing (or creating new array)
    // Ensure we always work with an array (handle legacy string data gracefully)
    const rawMarkers = lastScoreChange.quarter_marker
    const existingMarkers: string[] = Array.isArray(rawMarkers)
      ? rawMarkers
      : rawMarkers
        ? [rawMarkers] // Convert legacy string to array
        : []
    const newMarkers: string[] = existingMarkers.includes(quarter)
      ? existingMarkers // Already has this quarter
      : [...existingMarkers, quarter]

    // 1. Update last score_change with quarter_marker array using RPC
    // (Direct update has issues with PostgreSQL array serialization)
    const { error: markerError } = await supabase.rpc('update_quarter_marker', {
      p_score_change_id: lastScoreChange.id,
      p_quarters: newMarkers,
    })

    if (markerError) {
      setError(markerError.message)
      setIsLoading(false)
      return
    }

    // Immediately update local state so UI reflects the quarter markers
    hasLocalChanges.current = true
    setLocalScoreChanges((prev) =>
      prev.map((sc) =>
        sc.id === lastScoreChange.id ? { ...sc, quarter_marker: newMarkers } : sc
      )
    )

    // 2. Delete score_change winners for this change_order
    await supabase
      .from('sq_winners')
      .delete()
      .eq('sq_game_id', game.id)
      .eq('payout', lastScoreChange.change_order)
      .in('win_type', ['score_change', 'score_change_reverse'])

    // 3. Insert quarter winners instead
    if (sqPool.row_numbers && sqPool.col_numbers) {
      await calculateHybridQuarterWinner(
        supabase,
        game.id,
        sqPool.id,
        lastScoreChange.home_score,
        lastScoreChange.away_score,
        quarter,
        lastScoreChange.change_order,
        sqPool.row_numbers,
        sqPool.col_numbers,
        sqPool.reverse_scoring ?? true
      )
    }

    // 4. If marking final, also set game status and close dialog
    if (quarter === 'final') {
      await supabase
        .from('sq_games')
        .update({ status: 'final' })
        .eq('id', game.id)
      setIsOpen(false)
      // router.refresh() will be called by handleOpenChange when dialog closes
    }

    setIsLoading(false)
    // Don't refresh while dialog is open - local state is the source of truth
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

    // Immediately update local state with constructed row (don't rely on select() return)
    const newScoreChange: ScoreChange = {
      id: crypto.randomUUID(), // Temporary ID for local state
      sq_game_id: game.id,
      home_score: 0,
      away_score: 0,
      change_order: 1,
      quarter_marker: null,
    }
    hasLocalChanges.current = true
    setLocalScoreChanges((prev) => [...prev, newScoreChange])

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
    // Don't call router.refresh() here - local state already updated
    // Will refresh when dialog closes
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

    // Immediately update local state to remove deleted score changes
    hasLocalChanges.current = true
    setLocalScoreChanges((prev) => prev.filter((sc) => !idsToDelete.includes(sc.id)))

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
    // Don't refresh here - local state already updated
    // router.refresh() will be called when dialog closes
  }

  const isFinal = game.status === 'final'
  const isLastScoreChange = (sc: ScoreChange) =>
    sc.change_order === sortedScoreChanges[sortedScoreChanges.length - 1]?.change_order
  const deletesMultiple = scoreChangeToDelete
    ? sortedScoreChanges.filter((sc) => sc.change_order >= scoreChangeToDelete.change_order).length > 1
    : false

  // Handle dialog close - refresh data when closing
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Refresh server data when dialog closes
      router.refresh()
    }
  }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
          /* Score Change Mode OR Hybrid Mode */
          <div className="space-y-4 py-4">
            {/* Current score */}
            <div className="text-center py-2 bg-muted rounded-md">
              <div className="text-xs text-muted-foreground">Current Score</div>
              <div className="text-2xl font-bold">
                {game.away_score ?? 0} - {game.home_score ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">
                {localScoreChanges.length} score change{localScoreChanges.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Start game button (adds 0-0) */}
            {localScoreChanges.length === 0 && (
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
                        {sc.quarter_marker && sc.quarter_marker.length > 0 && (
                          <>
                            {sc.quarter_marker.map((qm) => (
                              <span key={qm} className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                qm === 'q1' ? 'bg-amber-100 text-amber-700' :
                                qm === 'halftime' ? 'bg-blue-100 text-blue-700' :
                                qm === 'q3' ? 'bg-teal-100 text-teal-700' :
                                qm === 'final' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {qm === 'q1' ? 'Q1' :
                                 qm === 'halftime' ? 'HALF' :
                                 qm === 'q3' ? 'Q3' :
                                 qm === 'final' ? 'FINAL' :
                                 qm.toUpperCase()}
                              </span>
                            ))}
                          </>
                        )}
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
            {localScoreChanges.length > 0 && !isFinal && (
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

            {/* Quarter marker buttons (hybrid mode only) */}
            {isHybridMode && localScoreChanges.length > 0 && !isFinal && (
              <div className="space-y-2 border-t pt-4">
                <Label className="text-sm">Mark Quarter Winner</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  Current score ({lastAwayScore}-{lastHomeScore}) will be marked as quarter winner
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    type="button"
                    onClick={() => handleMarkQuarter('q1')}
                    disabled={isLoading || quartersMarked.q1}
                    variant={quartersMarked.q1 ? 'default' : 'outline'}
                    size="sm"
                    className={quartersMarked.q1 ? 'bg-amber-500 hover:bg-amber-500' : ''}
                  >
                    {quartersMarked.q1 ? '✓ Q1' : 'Q1'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleMarkQuarter('halftime')}
                    disabled={isLoading || quartersMarked.halftime || !quartersMarked.q1}
                    variant={quartersMarked.halftime ? 'default' : 'outline'}
                    size="sm"
                    className={quartersMarked.halftime ? 'bg-blue-500 hover:bg-blue-500' : ''}
                  >
                    {quartersMarked.halftime ? '✓ Half' : 'Half'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleMarkQuarter('q3')}
                    disabled={isLoading || quartersMarked.q3 || !quartersMarked.halftime}
                    variant={quartersMarked.q3 ? 'default' : 'outline'}
                    size="sm"
                    className={quartersMarked.q3 ? 'bg-teal-500 hover:bg-teal-500' : ''}
                  >
                    {quartersMarked.q3 ? '✓ Q3' : 'Q3'}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleMarkQuarter('final')}
                    disabled={isLoading || quartersMarked.final || !quartersMarked.q3}
                    variant={quartersMarked.final ? 'default' : 'outline'}
                    size="sm"
                    className={quartersMarked.final ? 'bg-purple-500 hover:bg-purple-500' : ''}
                  >
                    {quartersMarked.final ? '✓ Final' : 'Final'}
                  </Button>
                </div>
              </div>
            )}

            {/* Mark final button (score_change mode only) */}
            {isScoreChangeMode && localScoreChanges.length > 0 && !isFinal && (
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
        win_type: winType,
        winner_name: winnerName,
      })
    }

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
            win_type: reverseWinType,
            winner_name: winnerName,
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
      win_type: 'score_change',
      payout: changeOrder, // Store change_order in payout for reference
      winner_name: winnerName,
    })
  }

  if (reverseScoring) {
    const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
    const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)

    // Always create reverse winner (even if same square as forward)
    // This allows the UI to show the "both" gradient for squares that win both ways
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
        win_type: 'score_change_reverse',
        payout: changeOrder,
        winner_name: winnerName,
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
      win_type: 'score_change_final',
      winner_name: winnerName,
    })
  }

  if (reverseScoring) {
    const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
    const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)

    // Always create reverse winner (even if same square as forward)
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
        win_type: 'score_change_final_reverse',
        winner_name: winnerName,
      })
    }
  }
}

/// Helper: Calculate winner for hybrid quarter marker
async function calculateHybridQuarterWinner(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  sqPoolId: string,
  homeScore: number,
  awayScore: number,
  quarter: 'q1' | 'halftime' | 'q3' | 'final',
  changeOrder: number,
  rowNumbers: number[],
  colNumbers: number[],
  reverseScoring: boolean
) {
  const homeDigit = homeScore % 10
  const awayDigit = awayScore % 10

  const rowIndex = rowNumbers.findIndex((n) => n === homeDigit)
  const colIndex = colNumbers.findIndex((n) => n === awayDigit)

  const winType = `hybrid_${quarter}`
  const reverseWinType = `hybrid_${quarter}_reverse`

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
      win_type: winType,
      payout: changeOrder,
      winner_name: winnerName,
    })
  }

  if (reverseScoring) {
    const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
    const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)

    // Always create reverse winner (even if same square as forward)
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
        win_type: reverseWinType,
        payout: changeOrder,
        winner_name: winnerName,
      })
    }
  }
}
