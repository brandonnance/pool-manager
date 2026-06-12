'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SquaresGrid, type Square } from './squares-grid'
import { PublicParticipantList } from './public-participant-list'
import { buildWinningRoundsMap } from '@/lib/squares'
import type { Winner, Game } from '@/lib/squares'

interface PublicRealtimeGridProps {
  sqPoolId: string
  initialSquares: Square[]
  initialGames: Game[]
  initialWinners: Winner[]
  rowNumbers: number[] | null
  colNumbers: number[] | null
  numbersLocked: boolean
  reverseScoring: boolean
  homeTeamLabel: string
  awayTeamLabel: string
  legendMode: 'full_playoff' | 'single_game' | 'score_change' | 'march_madness'
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
  initialWinners,
  rowNumbers,
  colNumbers,
  numbersLocked,
  reverseScoring,
  homeTeamLabel,
  awayTeamLabel,
  legendMode,
}: PublicRealtimeGridProps) {
  const router = useRouter()
  const [squares, setSquares] = useState<Square[]>(initialSquares)
  const [games, setGames] = useState<Game[]>(initialGames ?? [])
  const [winners, setWinners] = useState<Winner[]>(initialWinners ?? [])
  const [selectedParticipantName, setSelectedParticipantName] = useState<string | null>(null)

  // Game IDs for this pool - used to filter the table-wide winners subscription
  // (sq_winners has no sq_pool_id column, so server-side filtering isn't possible)
  const gameIds = useMemo(
    () => new Set(initialGames.map((g) => g.id)),
    [initialGames]
  )

  // Winning square highlights, recomputed whenever winners change
  const winningSquareRounds = useMemo(
    () => buildWinningRoundsMap(winners, games),
    [winners, games]
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

  // Subscribe to winners changes and patch state directly - avoids a full
  // router.refresh() for every viewer each time winners are recorded
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
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newWinner = payload.new as Database['public']['Tables']['sq_winners']['Row']
            if (!gameIds.has(newWinner.sq_game_id)) return
            setWinners((prev) =>
              prev.some((w) => w.id === newWinner.id) ? prev : [...prev, newWinner]
            )
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Database['public']['Tables']['sq_winners']['Row']
            if (!gameIds.has(updated.sq_game_id)) return
            setWinners((prev) =>
              prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w))
            )
          } else if (payload.eventType === 'DELETE') {
            // DELETE payloads only carry the primary key; ids from other
            // pools simply won't match anything in state
            const deleted = payload.old as { id: string }
            setWinners((prev) => prev.filter((w) => w.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sqPoolId, numbersLocked, gameIds])

  // Final winner banner (single-game modes record score_change_final/hybrid_final)
  const firstGame = games[0] ?? null
  const finalWinner = winners.find(
    (w) => w.win_type === 'score_change_final' || w.win_type === 'hybrid_final'
  )
  const finalReverseWinner = winners.find(
    (w) => w.win_type === 'score_change_final_reverse' || w.win_type === 'hybrid_final_reverse'
  )
  const showFinalBanner =
    numbersLocked &&
    firstGame?.status === 'final' &&
    Boolean(finalWinner || finalReverseWinner)

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Squares Grid</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Final Winner Banner */}
      {showFinalBanner && (
        <div className="rounded-lg border-2 border-purple-300 bg-purple-50 p-6">
          <div className="text-center space-y-3">
            <div className="text-sm font-medium text-purple-600 uppercase tracking-wide">
              Final Winner{reverseScoring ? 's' : ''}
            </div>
            <div className="flex items-center justify-center gap-8">
              {finalWinner && (
                <div className="text-center">
                  {reverseScoring && (
                    <div className="text-xs text-muted-foreground mb-1">Forward</div>
                  )}
                  <div className="text-2xl font-bold text-purple-700">
                    {finalWinner.winner_name || 'Unclaimed'}
                  </div>
                </div>
              )}
              {reverseScoring && finalReverseWinner && (
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Reverse</div>
                  <div className="text-2xl font-bold text-fuchsia-700">
                    {finalReverseWinner.winner_name || 'Unclaimed'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
