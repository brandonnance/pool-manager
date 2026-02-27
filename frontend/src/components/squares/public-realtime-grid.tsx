'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { SquaresGrid, type Square } from './squares-grid'
import { PublicParticipantList } from './public-participant-list'
import type { WinningRound } from './square-cell'

interface Game {
  id: string
  home_score: number | null
  away_score: number | null
  status: string | null
}

interface PublicRealtimeGridProps {
  sqPoolId: string
  initialSquares: Square[]
  initialGames: Game[]
  rowNumbers: number[] | null
  colNumbers: number[] | null
  numbersLocked: boolean
  reverseScoring: boolean
  // Array format for serialization from server component
  winningSquareRoundsArray: Array<[string, WinningRound]>
  homeTeamLabel: string
  awayTeamLabel: string
  legendMode: 'full_playoff' | 'single_game' | 'score_change'
}

// Create anonymous client for realtime
function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function PublicRealtimeGrid({
  sqPoolId,
  initialSquares,
  initialGames,
  rowNumbers,
  colNumbers,
  numbersLocked,
  reverseScoring,
  winningSquareRoundsArray,
  homeTeamLabel,
  awayTeamLabel,
  legendMode,
}: PublicRealtimeGridProps) {
  const router = useRouter()
  const [squares, setSquares] = useState<Square[]>(initialSquares)
  const [games, setGames] = useState<Game[]>(initialGames ?? [])
  const [selectedParticipantName, setSelectedParticipantName] = useState<string | null>(null)

  // Convert array back to Map
  const winningSquareRounds = useMemo(
    () => new Map(winningSquareRoundsArray),
    [winningSquareRoundsArray]
  )

  // Calculate live winning squares from in-progress games
  const liveWinningSquareIds = useMemo(() => {
    if (!numbersLocked || !rowNumbers || !colNumbers) return new Set<string>()

    const liveIds = new Set<string>()

    // Create a map of squares by position for quick lookup
    const squaresByPosition = new Map<string, Square>()
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
          liveIds.add(forwardSquare.id)
        }

        // Reverse scoring square (if enabled)
        if (reverseScoring) {
          const reverseHomeRowIdx = rowNumbers.indexOf(awayDigit)
          const reverseAwayColIdx = colNumbers.indexOf(homeDigit)
          if (reverseHomeRowIdx !== -1 && reverseAwayColIdx !== -1) {
            const reverseSquare = squaresByPosition.get(`${reverseHomeRowIdx}-${reverseAwayColIdx}`)
            if (reverseSquare?.id) {
              liveIds.add(reverseSquare.id)
            }
          }
        }
      }
    }

    return liveIds
  }, [squares, games, numbersLocked, rowNumbers, colNumbers, reverseScoring])

  // Subscribe to pool changes (for numbers_locked updates)
  useEffect(() => {
    // Only subscribe if numbers aren't locked yet
    if (numbersLocked) return

    const supabase = createAnonClient()

    const channel = supabase
      .channel(`public-pool-${sqPoolId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sq_pools',
          filter: `id=eq.${sqPoolId}`,
        },
        (payload) => {
          const updated = payload.new as Database['public']['Tables']['sq_pools']['Row']
          // If numbers just got locked, refresh the page to get all the new data
          if (updated.numbers_locked) {
            router.refresh()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sqPoolId, numbersLocked, router])

  // Subscribe to squares changes
  useEffect(() => {
    const supabase = createAnonClient()

    const channel = supabase
      .channel(`public-squares-${sqPoolId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
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
                verified: false, // Public view never shows verified
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

  // Subscribe to game updates (for live score tracking)
  useEffect(() => {
    if (!numbersLocked) return

    const supabase = createAnonClient()

    const channel = supabase
      .channel(`public-games-grid-${sqPoolId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sq_games',
          filter: `sq_pool_id=eq.${sqPoolId}`,
        },
        (payload) => {
          const updated = payload.new as Database['public']['Tables']['sq_games']['Row']
          setGames((prev) =>
            prev.map((g) =>
              g.id === updated.id
                ? {
                    ...g,
                    home_score: updated.home_score,
                    away_score: updated.away_score,
                    status: updated.status,
                  }
                : g
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sqPoolId, numbersLocked])

  // Subscribe to winners changes to refresh grid highlighting
  useEffect(() => {
    if (!numbersLocked) return

    const supabase = createAnonClient()

    const channel = supabase
      .channel(`public-winners-grid-${sqPoolId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sq_winners',
        },
        () => {
          // Refresh page to update winning square highlights
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sqPoolId, numbersLocked, router])

  return (
    <div className="space-y-4">
      <PublicParticipantList
        squares={squares}
        selectedParticipantName={selectedParticipantName}
        onSelectParticipant={setSelectedParticipantName}
      />
      <SquaresGrid
        sqPoolId={sqPoolId}
        squares={squares}
        rowNumbers={rowNumbers}
        colNumbers={colNumbers}
        numbersLocked={numbersLocked}
        isCommissioner={false}
        winningSquareRounds={winningSquareRounds}
        liveWinningSquareIds={liveWinningSquareIds}
        homeTeamLabel={homeTeamLabel}
        awayTeamLabel={awayTeamLabel}
        legendMode={legendMode}
        controlledParticipantName={selectedParticipantName}
        onParticipantSelect={setSelectedParticipantName}
      />
    </div>
  )
}
