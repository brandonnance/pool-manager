'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Square } from '../squares-grid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { replaceGameWinners, type WinnerInsert } from '@/lib/squares/winners'
import { validateScoreChange, validateScoreValue, validateStageProgression } from '@/lib/squares'
import type { SqGame, SqWinner, ScoreChange } from './types'

// Score Entry Component
export function ScoreEntry({
  game,
  sqPoolId,
  scoringMode,
  reverseScoring,
  squares,
  rowNumbers,
  colNumbers,
  scoreChanges,
  onWinnersCreated,
  onWinnersReplaced,
  onGameScoreUpdated,
  onScoreChangeCreated,
  onScoreChangeUpdated,
}: {
  game: SqGame
  sqPoolId: string
  scoringMode: string
  reverseScoring: boolean
  squares: Square[]
  rowNumbers: number[]
  colNumbers: number[]
  scoreChanges: ScoreChange[]
  onWinnersCreated: (winners: SqWinner[]) => void
  onWinnersReplaced: (payout: number, winners: SqWinner[]) => void
  onGameScoreUpdated: (homeScore: number, awayScore: number, status?: string) => void
  onScoreChangeCreated: (scoreChange: ScoreChange) => void
  onScoreChangeUpdated: (scoreChange: ScoreChange) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Local state for score changes - initialized from props when dialog opens
  const [localScoreChanges, setLocalScoreChanges] = useState<ScoreChange[]>(scoreChanges)

  // Track if we have pending local changes that shouldn't be overwritten
  const hasLocalChanges = useRef(false)

  // Sync from props when they change (unless we have pending local changes while dialog is open)
  useEffect(() => {
    // Always sync when dialog is closed - props are the source of truth
    if (!isOpen) {
      setLocalScoreChanges(scoreChanges)
      hasLocalChanges.current = false
    } else if (!hasLocalChanges.current) {
      // Dialog is open but no pending changes - safe to sync
      setLocalScoreChanges(scoreChanges)
    }
  }, [isOpen, scoreChanges])

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

  const isHybridMode = scoringMode === 'hybrid'
  const isScoreChangeMode = scoringMode === 'score_change'

  const sortedScoreChanges = [...localScoreChanges].sort((a, b) => a.change_order - b.change_order)
  const lastScoreChange = sortedScoreChanges[sortedScoreChanges.length - 1]
  const lastHomeScore = lastScoreChange?.home_score ?? 0
  const lastAwayScore = lastScoreChange?.away_score ?? 0

  // Track which quarters are marked (for hybrid mode)
  const quartersMarked = {
    q1: localScoreChanges.some((sc) => sc.quarter_marker?.includes('q1')),
    halftime: localScoreChanges.some((sc) => sc.quarter_marker?.includes('halftime')),
    q3: localScoreChanges.some((sc) => sc.quarter_marker?.includes('q3')),
    final: localScoreChanges.some((sc) => sc.quarter_marker?.includes('final')),
  }

  const handleOpen = () => {
    if (scoringMode === 'score_change' || scoringMode === 'hybrid') {
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

    for (const [value, label] of [
      [homeScore, `${game.home_team ?? 'Home'} score`],
      [awayScore, `${game.away_team ?? 'Away'} score`],
    ] as Array<[number, string]>) {
      const valueResult = validateScoreValue(value, label)
      if (!valueResult.isValid) {
        setError(valueResult.error)
        return
      }
    }

    const changeResult = validateScoreChange(
      homeScore,
      awayScore,
      lastHomeScore,
      lastAwayScore,
      game.home_team ?? 'Home',
      game.away_team ?? 'Away'
    )
    if (!changeResult.isValid) {
      setError(changeResult.error)
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

    // Immediately update local state
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
    // Notify parent for instant UI update outside the modal
    onScoreChangeCreated(newScoreChange)

    // Update game
    await supabase
      .from('sq_games')
      .update({
        home_score: homeScore,
        away_score: awayScore,
        status: 'in_progress',
      })
      .eq('id', game.id)

    // Notify parent of game score update for instant UI update
    onGameScoreUpdated(homeScore, awayScore, 'in_progress')

    // Create winners and track them locally
    const forwardWinnerName = getWinnerName(homeScore, awayScore, false)
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10
    const forwardRowIndex = rowNumbers.findIndex((n) => n === homeDigit)
    const forwardColIndex = colNumbers.findIndex((n) => n === awayDigit)
    const forwardSquare = squares.find((s) => s.row_index === forwardRowIndex && s.col_index === forwardColIndex)
    const newWinners: SqWinner[] = []

    if (forwardSquare?.id) {
      await supabase.from('sq_winners').insert({
        sq_game_id: game.id,
        square_id: forwardSquare.id,
        win_type: 'score_change',
        payout: nextOrder,
        winner_name: forwardWinnerName,
      })
      newWinners.push({
        id: crypto.randomUUID(),
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
        newWinners.push({
          id: crypto.randomUUID(),
          sq_game_id: game.id,
          square_id: reverseSquare.id,
          win_type: 'score_change_reverse',
          payout: nextOrder,
          winner_name: reverseWinnerName,
        })
      }
    }

    // Notify parent of new winners for instant UI update
    onWinnersCreated(newWinners)

    setNewScoreHome(homeScore.toString())
    setNewScoreAway(awayScore.toString())
    setIsLoading(false)
    // Don't router.refresh() here - local state already updated
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

    // Immediately update local state
    const newScoreChange: ScoreChange = {
      id: crypto.randomUUID(),
      sq_game_id: game.id,
      home_score: 0,
      away_score: 0,
      change_order: 1,
      quarter_marker: null,
    }
    hasLocalChanges.current = true
    setLocalScoreChanges((prev) => [...prev, newScoreChange])
    // Notify parent for instant UI update outside the modal
    onScoreChangeCreated(newScoreChange)

    await supabase.from('sq_games').update({
      home_score: 0,
      away_score: 0,
      status: 'in_progress',
    }).eq('id', game.id)

    // Notify parent of game score update for instant UI update
    onGameScoreUpdated(0, 0, 'in_progress')

    // Create 0-0 winners and track them locally
    const winnerName = getWinnerName(0, 0, false)
    const zeroRowIndex = rowNumbers.findIndex((n) => n === 0)
    const zeroColIndex = colNumbers.findIndex((n) => n === 0)
    const forwardSquare = squares.find((s) => s.row_index === zeroRowIndex && s.col_index === zeroColIndex)
    const newWinners: SqWinner[] = []

    if (forwardSquare?.id) {
      await supabase.from('sq_winners').insert({
        sq_game_id: game.id,
        square_id: forwardSquare.id,
        win_type: 'score_change',
        payout: 1,
        winner_name: winnerName,
      })
      newWinners.push({
        id: crypto.randomUUID(),
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
      newWinners.push({
        id: crypto.randomUUID(),
        sq_game_id: game.id,
        square_id: forwardSquare.id,
        win_type: 'score_change_reverse',
        payout: 1,
        winner_name: winnerName,
      })
    }

    // Notify parent of new winners for instant UI update
    onWinnersCreated(newWinners)

    // Pre-populate score inputs for next entry
    setNewScoreHome('0')
    setNewScoreAway('0')

    setIsLoading(false)
    // Don't router.refresh() here - local state already updated
  }

  const handleMarkFinal = async () => {
    setIsLoading(true)
    const supabase = createClient()

    await supabase.from('sq_games').update({ status: 'final' }).eq('id', game.id)

    // Notify parent of game status update
    if (lastScoreChange) {
      onGameScoreUpdated(lastScoreChange.home_score, lastScoreChange.away_score, 'final')
    }

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
    // Uses game_id + change_order (reliable) instead of id (may be temp UUID)
    const { error: markerError } = await supabase.rpc('update_quarter_marker', {
      p_sq_game_id: game.id,
      p_change_order: lastScoreChange.change_order,
      p_quarters: newMarkers,
    })

    if (markerError) {
      setError(markerError.message)
      setIsLoading(false)
      return
    }

    // Immediately update local state so UI reflects the quarter markers (match by change_order since local IDs may be temporary)
    hasLocalChanges.current = true
    const updatedScoreChange = { ...lastScoreChange, quarter_marker: newMarkers }
    setLocalScoreChanges((prev) =>
      prev.map((sc) =>
        sc.change_order === lastScoreChange.change_order ? updatedScoreChange : sc
      )
    )
    // Notify parent for instant UI update outside the modal
    onScoreChangeUpdated(updatedScoreChange)

    // 2+3. Atomically swap this change_order's score_change winners for quarter winners
    //      (payout stores the change_order for grouping)
    const homeScore = lastScoreChange.home_score
    const awayScore = lastScoreChange.away_score
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10
    const winType = `hybrid_${quarter}`
    const reverseWinType = `hybrid_${quarter}_reverse`

    const forwardWinnerName = getWinnerName(homeScore, awayScore, false)
    const forwardRowIndex = rowNumbers.findIndex((n) => n === homeDigit)
    const forwardColIndex = colNumbers.findIndex((n) => n === awayDigit)
    const forwardSquare = squares.find((s) => s.row_index === forwardRowIndex && s.col_index === forwardColIndex)
    const newWinners: SqWinner[] = []

    if (forwardSquare?.id) {
      newWinners.push({
        id: crypto.randomUUID(),
        sq_game_id: game.id,
        square_id: forwardSquare.id,
        win_type: winType,
        payout: lastScoreChange.change_order,
        winner_name: forwardWinnerName,
      })
    }

    if (reverseScoring) {
      const reverseWinnerName = getWinnerName(homeScore, awayScore, true)
      const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
      const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)
      const reverseSquare = squares.find((s) => s.row_index === reverseRowIndex && s.col_index === reverseColIndex)

      if (reverseSquare?.id) {
        newWinners.push({
          id: crypto.randomUUID(),
          sq_game_id: game.id,
          square_id: reverseSquare.id,
          win_type: reverseWinType,
          payout: lastScoreChange.change_order,
          winner_name: reverseWinnerName,
        })
      }
    }

    const { error: swapError } = await replaceGameWinners(
      supabase,
      game.id,
      newWinners.map((w) => ({
        square_id: w.square_id!,
        win_type: w.win_type,
        winner_name: w.winner_name,
        payout: w.payout ?? undefined,
      })),
      {
        payout: lastScoreChange.change_order,
        winTypes: ['score_change', 'score_change_reverse'],
      }
    )
    if (swapError) {
      setError(swapError.message)
      setIsLoading(false)
      return
    }

    // Notify parent to replace old score_change winners with new hybrid winners
    onWinnersReplaced(lastScoreChange.change_order, newWinners)

    // 4. If marking final, also set game status and close dialog
    if (quarter === 'final') {
      await supabase
        .from('sq_games')
        .update({ status: 'final' })
        .eq('id', game.id)
      // Notify parent of game status update
      onGameScoreUpdated(homeScore, awayScore, 'final')
      setIsOpen(false)
      // router.refresh() will be called by handleOpenChange when dialog closes
    }

    setIsLoading(false)
    // Don't refresh while dialog is open - local state is the source of truth
  }

  // Quarter mode submit handler
  const handleQuarterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate entered scores before writing anything
    const scoreFields: Array<[string, string]> = [
      [q1Home, `${game.home_team ?? 'Home'} Q1 score`],
      [q1Away, `${game.away_team ?? 'Away'} Q1 score`],
      [halfHome, `${game.home_team ?? 'Home'} halftime score`],
      [halfAway, `${game.away_team ?? 'Away'} halftime score`],
      [q3Home, `${game.home_team ?? 'Home'} Q3 score`],
      [q3Away, `${game.away_team ?? 'Away'} Q3 score`],
      [finalHome, `${game.home_team ?? 'Home'} final score`],
      [finalAway, `${game.away_team ?? 'Away'} final score`],
    ]
    for (const [value, label] of scoreFields) {
      if (value === '') continue
      const result = validateScoreValue(parseInt(value, 10), label)
      if (!result.isValid) {
        setError(result.error)
        return
      }
    }

    // Cumulative scores: each stage must be >= the previous one
    const stage = (home: string, away: string, label: string) =>
      home !== '' && away !== ''
        ? { label, home: parseInt(home, 10), away: parseInt(away, 10) }
        : null
    const progression = validateStageProgression([
      stage(q1Home, q1Away, 'Q1'),
      stage(halfHome, halfAway, 'Halftime'),
      stage(q3Home, q3Away, 'Q3'),
      stage(finalHome, finalAway, 'Final'),
    ])
    if (!progression.isValid) {
      setError(progression.error)
      return
    }

    setIsLoading(true)

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

    // Recompute the full winner set and replace atomically (single transaction)
    const newWinners: WinnerInsert[] = []

    const collectWinner = (
      homeScore: number,
      awayScore: number,
      winType: string,
      reverseWinType: string
    ) => {
      const forwardSquareId = getSquareId(homeScore, awayScore, false)

      if (forwardSquareId) {
        newWinners.push({
          square_id: forwardSquareId,
          win_type: winType,
          winner_name: getWinnerName(homeScore, awayScore, false),
        })
      }

      if (reverseScoring) {
        const reverseSquareId = getSquareId(homeScore, awayScore, true)

        // Only add reverse if different from forward
        if (reverseSquareId && reverseSquareId !== forwardSquareId) {
          newWinners.push({
            square_id: reverseSquareId,
            win_type: reverseWinType,
            winner_name: getWinnerName(homeScore, awayScore, true),
          })
        }
      }
    }

    // Calculate winners for each quarter that has scores
    if (q1Home !== '' && q1Away !== '') {
      collectWinner(parseInt(q1Home, 10), parseInt(q1Away, 10), 'q1', 'q1_reverse')
    }
    if (halfHome !== '' && halfAway !== '') {
      collectWinner(parseInt(halfHome, 10), parseInt(halfAway, 10), 'halftime', 'halftime_reverse')
    }
    if (q3Home !== '' && q3Away !== '') {
      collectWinner(parseInt(q3Home, 10), parseInt(q3Away, 10), 'q3', 'q3_reverse')
    }
    if (status === 'final' && finalHome !== '' && finalAway !== '') {
      // Use score_change_final types (DB constraint doesn't allow 'final'/'final_reverse')
      collectWinner(parseInt(finalHome, 10), parseInt(finalAway, 10), 'score_change_final', 'score_change_final_reverse')
    }

    const { error: winnersError } = await replaceGameWinners(supabase, game.id, newWinners)
    if (winnersError) {
      setError(winnersError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setIsOpen(false)
    // router.refresh() will be called by handleOpenChange when dialog closes
  }

  const isFinal = game.status === 'final'
  const isQuarterMode = scoringMode === 'quarter'

  // Handle dialog close - refresh data when closing
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Refresh server data when dialog closes
      router.refresh()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
                {localScoreChanges.length} score change{localScoreChanges.length !== 1 ? 's' : ''}
              </div>
            </div>

            {localScoreChanges.length === 0 && !isFinal && (
              <Button onClick={handleAddZeroZero} disabled={isLoading} className="w-full" variant="outline">
                Start Game (0-0)
              </Button>
            )}

            {localScoreChanges.length > 0 && !isFinal && (
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
