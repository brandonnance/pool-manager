'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react'
import type { SyncScoreResponse } from '@/app/api/squares/sync-score/route'

interface LiveScoringControlProps {
  gameId: string
  sqPoolId: string
  espnGameId: string | null
  currentStatus: string | null
  paysHalftime: boolean
  reverseScoring: boolean
  rowNumbers: number[] | null
  colNumbers: number[] | null
}

// Helper function to get winner name from square
async function getWinnerName(
  supabase: ReturnType<typeof createClient>,
  sqPoolId: string,
  rowIndex: number,
  colIndex: number
): Promise<{ squareId: string; winnerName: string } | null> {
  const { data: square } = await supabase
    .from('sq_squares')
    .select('id, user_id, participant_name')
    .eq('sq_pool_id', sqPoolId)
    .eq('row_index', rowIndex)
    .eq('col_index', colIndex)
    .single()

  if (!square) return null

  // For no-account mode, use participant_name
  if (square.participant_name) {
    return { squareId: square.id, winnerName: square.participant_name }
  }

  // For authenticated mode, look up profile
  if (square.user_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', square.user_id)
      .single()

    return {
      squareId: square.id,
      winnerName: profile?.display_name || profile?.email || 'Unknown',
    }
  }

  return { squareId: square.id, winnerName: 'Unclaimed' }
}

export function LiveScoringControl({
  gameId,
  sqPoolId,
  espnGameId,
  currentStatus,
  paysHalftime,
  reverseScoring,
  rowNumbers,
  colNumbers,
}: LiveScoringControlProps) {
  const router = useRouter()
  const [isPolling, setIsPolling] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Don't allow polling for games without ESPN ID or already final games
  const canPoll = !!espnGameId && currentStatus !== 'final'

  const syncScore = useCallback(async () => {
    if (!espnGameId || !rowNumbers || !colNumbers) return

    setIsSyncing(true)
    setError(null)

    try {
      const response = await fetch(`/api/squares/sync-score?espnGameId=${espnGameId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch score')
      }

      const scoreData: SyncScoreResponse = await response.json()

      const supabase = createClient()

      // Build update object
      const updates: Record<string, unknown> = {
        status: scoreData.status,
        home_score: scoreData.homeScore,
        away_score: scoreData.awayScore,
        current_period: scoreData.period,
        current_clock: scoreData.clock,
      }

      // Add halftime scores if available and game pays halftime
      if (paysHalftime && scoreData.halftimeHomeScore !== null) {
        updates.halftime_home_score = scoreData.halftimeHomeScore
        updates.halftime_away_score = scoreData.halftimeAwayScore
      }

      // Add Q1 and Q3 scores if available (for future quarter-by-quarter scoring)
      if (scoreData.q1HomeScore !== null) {
        updates.q1_home_score = scoreData.q1HomeScore
        updates.q1_away_score = scoreData.q1AwayScore
      }
      if (scoreData.q3HomeScore !== null) {
        updates.q3_home_score = scoreData.q3HomeScore
        updates.q3_away_score = scoreData.q3AwayScore
      }

      // Update the game
      const { error: updateError } = await supabase
        .from('sq_games')
        .update(updates)
        .eq('id', gameId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      // If game is final, calculate and record winners
      if (scoreData.status === 'final' && scoreData.homeScore !== null && scoreData.awayScore !== null) {
        await calculateAndRecordWinners(
          supabase,
          gameId,
          sqPoolId,
          scoreData.homeScore,
          scoreData.awayScore,
          paysHalftime ? scoreData.halftimeHomeScore : null,
          paysHalftime ? scoreData.halftimeAwayScore : null,
          rowNumbers,
          colNumbers,
          reverseScoring
        )

        // Stop polling since game is final
        setIsPolling(false)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }

      setLastSynced(new Date())
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }, [espnGameId, gameId, sqPoolId, paysHalftime, reverseScoring, rowNumbers, colNumbers, router])

  // Start/stop polling
  useEffect(() => {
    if (isPolling && canPoll) {
      // Sync immediately when starting
      syncScore()

      // Then poll every 30 seconds
      intervalRef.current = setInterval(syncScore, 30000)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPolling, canPoll, syncScore])

  // Format last synced time
  const getLastSyncedText = () => {
    if (!lastSynced) return null
    const seconds = Math.floor((Date.now() - lastSynced.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ago`
  }

  // No ESPN ID configured
  if (!espnGameId) {
    return null
  }

  // Game is already final
  if (currentStatus === 'final') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-xs">
          ESPN: {espnGameId}
        </Badge>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="outline" className="text-xs font-mono">
        ESPN: {espnGameId}
      </Badge>

      {isPolling ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPolling(false)}
          className="h-7 text-xs gap-1.5 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
        >
          <Wifi className="h-3 w-3" />
          Live
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPolling(true)}
          disabled={!canPoll}
          className="h-7 text-xs gap-1.5"
        >
          <WifiOff className="h-3 w-3" />
          Start Live
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={syncScore}
        disabled={isSyncing}
        className="h-7 text-xs gap-1"
      >
        <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
        Sync
      </Button>

      {lastSynced && (
        <span className="text-xs text-muted-foreground">
          {getLastSyncedText()}
        </span>
      )}

      {error && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  )
}

// Helper function to calculate and record winners (same as in enter-squares-score-button)
async function calculateAndRecordWinners(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  sqPoolId: string,
  homeScore: number,
  awayScore: number,
  halftimeHomeScore: number | null,
  halftimeAwayScore: number | null,
  rowNumbers: number[],
  colNumbers: number[],
  reverseScoring: boolean
) {
  // Delete existing winners for this game first
  await supabase.from('sq_winners').delete().eq('sq_game_id', gameId)

  // Final score winners
  const homeDigit = homeScore % 10
  const awayDigit = awayScore % 10

  const rowIndex = rowNumbers.findIndex((n) => n === homeDigit)
  const colIndex = colNumbers.findIndex((n) => n === awayDigit)

  const normalWinner = await getWinnerName(supabase, sqPoolId, rowIndex, colIndex)
  if (normalWinner) {
    // Use upsert to handle race conditions (unique constraint on sq_game_id, win_type)
    await supabase.from('sq_winners').upsert(
      {
        sq_game_id: gameId,
        square_id: normalWinner.squareId,
        win_type: 'normal',
        winner_name: normalWinner.winnerName,
      },
      { onConflict: 'sq_game_id,win_type' }
    )
  }

  // Reverse winner
  if (reverseScoring) {
    const reverseRowIndex = rowNumbers.findIndex((n) => n === awayDigit)
    const reverseColIndex = colNumbers.findIndex((n) => n === homeDigit)

    if (reverseRowIndex !== rowIndex || reverseColIndex !== colIndex) {
      const reverseWinner = await getWinnerName(supabase, sqPoolId, reverseRowIndex, reverseColIndex)
      if (reverseWinner) {
        await supabase.from('sq_winners').upsert(
          {
            sq_game_id: gameId,
            square_id: reverseWinner.squareId,
            win_type: 'reverse',
            winner_name: reverseWinner.winnerName,
          },
          { onConflict: 'sq_game_id,win_type' }
        )
      }
    }
  }

  // Halftime winners
  if (halftimeHomeScore !== null && halftimeAwayScore !== null) {
    const htHomeDigit = halftimeHomeScore % 10
    const htAwayDigit = halftimeAwayScore % 10

    const htRowIndex = rowNumbers.findIndex((n) => n === htHomeDigit)
    const htColIndex = colNumbers.findIndex((n) => n === htAwayDigit)

    const halftimeWinner = await getWinnerName(supabase, sqPoolId, htRowIndex, htColIndex)
    if (halftimeWinner) {
      await supabase.from('sq_winners').upsert(
        {
          sq_game_id: gameId,
          square_id: halftimeWinner.squareId,
          win_type: 'halftime',
          winner_name: halftimeWinner.winnerName,
        },
        { onConflict: 'sq_game_id,win_type' }
      )
    }

    // Halftime reverse
    if (reverseScoring) {
      const htReverseRowIndex = rowNumbers.findIndex((n) => n === htAwayDigit)
      const htReverseColIndex = colNumbers.findIndex((n) => n === htHomeDigit)

      if (htReverseRowIndex !== htRowIndex || htReverseColIndex !== htColIndex) {
        const htReverseWinner = await getWinnerName(supabase, sqPoolId, htReverseRowIndex, htReverseColIndex)
        if (htReverseWinner) {
          await supabase.from('sq_winners').upsert(
            {
              sq_game_id: gameId,
              square_id: htReverseWinner.squareId,
              win_type: 'halftime_reverse',
              winner_name: htReverseWinner.winnerName,
            },
            { onConflict: 'sq_game_id,win_type' }
          )
        }
      }
    }
  }
}
