'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { NoAccountSquaresGrid, type NoAccountSquare } from './no-account-squares-grid'
import type { WinningRound } from './square-cell'

interface PublicRealtimeGridProps {
  sqPoolId: string
  initialSquares: NoAccountSquare[]
  rowNumbers: number[] | null
  colNumbers: number[] | null
  numbersLocked: boolean
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
  rowNumbers,
  colNumbers,
  numbersLocked,
  winningSquareRoundsArray,
  homeTeamLabel,
  awayTeamLabel,
  legendMode,
}: PublicRealtimeGridProps) {
  const [squares, setSquares] = useState<NoAccountSquare[]>(initialSquares)

  // Convert array back to Map
  const winningSquareRounds = useMemo(
    () => new Map(winningSquareRoundsArray),
    [winningSquareRoundsArray]
  )

  useEffect(() => {
    const supabase = createAnonClient()

    // Subscribe to changes on sq_squares for this pool
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

  return (
    <NoAccountSquaresGrid
      sqPoolId={sqPoolId}
      squares={squares}
      rowNumbers={rowNumbers}
      colNumbers={colNumbers}
      numbersLocked={numbersLocked}
      isCommissioner={false}
      winningSquareRounds={winningSquareRounds}
      homeTeamLabel={homeTeamLabel}
      awayTeamLabel={awayTeamLabel}
      legendMode={legendMode}
    />
  )
}
