'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { SquaresGrid, type Square } from './squares-grid'
import { PoolSettings } from './pool-settings'
import { AssignNameDialog } from './assign-name-dialog'
import { BulkAssignDialog } from './bulk-assign-dialog'
import { EditGameTeamsButton } from './edit-game-teams-button'
import { ParticipantSummaryPanel } from './participant-summary-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { WinningRound } from './square-cell'
import { deleteScoreChangesFrom } from '@/lib/squares/winners'
import { SimpleGameScoreCard } from './single-game/game-score-card'
import { ScoreEntry } from './single-game/score-entry'
import { SimpleScoreChangeLog } from './single-game/score-change-log'
import type { SqGame, SqWinner, ScoreChange } from './single-game/types'

interface SingleGameContentProps {
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
  squares: Square[]
  games: SqGame[]
  winners: SqWinner[]
  scoreChanges: ScoreChange[]
  isCommissioner: boolean
  isSuperAdmin?: boolean
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
  winners: initialWinners,
  scoreChanges: initialScoreChanges,
  isCommissioner,
  isSuperAdmin = false,
}: SingleGameContentProps) {
  const router = useRouter()

  // Local state for squares with realtime updates
  const [squares, setSquares] = useState<Square[]>(initialSquares)

  // Local state for winners - enables instant UI updates
  const [winners, setWinners] = useState<SqWinner[]>(initialWinners)

  // Local state for current game - enables instant score updates
  const [currentGame, setCurrentGame] = useState<SqGame | null>(games[0] ?? null)

  // Local state for score changes - enables instant UI updates
  const [scoreChanges, setScoreChanges] = useState<ScoreChange[]>(initialScoreChanges)

  // Sync winners from props when they change (e.g., after router.refresh())
  useEffect(() => {
    setWinners(initialWinners)
  }, [initialWinners])

  // Sync game from props when they change (e.g., after router.refresh())
  useEffect(() => {
    setCurrentGame(games[0] ?? null)
  }, [games])

  // Sync score changes from props when they change (e.g., after router.refresh())
  useEffect(() => {
    setScoreChanges(initialScoreChanges)
  }, [initialScoreChanges])

  // Callback for score entry to add new winners instantly
  const handleWinnersCreated = (newWinners: SqWinner[]) => {
    setWinners((prev) => [...prev, ...newWinners])
  }

  // Callback for quarter marking - replaces old winners with new ones for a specific payout
  const handleWinnersReplaced = (payout: number, newWinners: SqWinner[]) => {
    setWinners((prev) => {
      // Remove old score_change winners for this payout
      const filtered = prev.filter(
        (w) =>
          w.payout !== payout ||
          (w.win_type !== 'score_change' && w.win_type !== 'score_change_reverse')
      )
      // Add the new hybrid quarter winners
      return [...filtered, ...newWinners]
    })
  }

  // Callback for score entry to update game score instantly
  const handleGameScoreUpdated = (homeScore: number, awayScore: number, status?: string) => {
    setCurrentGame((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        home_score: homeScore,
        away_score: awayScore,
        status: status ?? prev.status,
      }
    })
  }

  // Callback for score entry to add new score changes instantly
  const handleScoreChangeCreated = (newScoreChange: ScoreChange) => {
    setScoreChanges((prev) => [...prev, newScoreChange])
  }

  // Callback for score entry to update score change (e.g., quarter marker)
  const handleScoreChangeUpdated = (updatedScoreChange: ScoreChange) => {
    setScoreChanges((prev) =>
      prev.map((sc) =>
        sc.change_order === updatedScoreChange.change_order ? updatedScoreChange : sc
      )
    )
  }

  // Handler for deleting score changes from the main page score log
  const handleDeleteScoreChange = async (changeOrder: number) => {
    if (!currentGame) return

    const supabase = createClient()
    const sortedChanges = [...scoreChanges].sort((a, b) => a.change_order - b.change_order)

    // Get all score changes that need to be deleted (this one and all after it)
    const changesToDelete = sortedChanges.filter((sc) => sc.change_order >= changeOrder)
    const changeOrdersToDelete = changesToDelete.map((sc) => sc.change_order)
    const idsToDelete = changesToDelete.map((sc) => sc.id)

    // Atomically delete this score change and all after it, their winners, and
    // (when the deleted range included the final marker) the final-score winners
    const deletingFinal = changesToDelete.some((sc) => sc.quarter_marker?.includes('final'))
    const { error: deleteError } = await deleteScoreChangesFrom(
      supabase,
      currentGame.id,
      changeOrder,
      deletingFinal
    )
    if (deleteError) {
      console.error('Error deleting score changes:', deleteError)
      return
    }

    // Update local state
    setScoreChanges((prev) => prev.filter((sc) => !idsToDelete.includes(sc.id)))
    setWinners((prev) => prev.filter((w) => !changeOrdersToDelete.includes(w.payout ?? -1)))

    // Update game with the previous score (before deleted one)
    const remainingChanges = sortedChanges.filter((sc) => sc.change_order < changeOrder)
    const newLastChange = remainingChanges[remainingChanges.length - 1]

    if (newLastChange) {
      await supabase
        .from('sq_games')
        .update({
          home_score: newLastChange.home_score,
          away_score: newLastChange.away_score,
          status: 'in_progress',
        })
        .eq('id', currentGame.id)

      setCurrentGame((prev) =>
        prev
          ? {
              ...prev,
              home_score: newLastChange.home_score,
              away_score: newLastChange.away_score,
              status: 'in_progress',
            }
          : null
      )
    } else {
      // No remaining changes - reset game
      await supabase
        .from('sq_games')
        .update({
          home_score: null,
          away_score: null,
          status: 'scheduled',
        })
        .eq('id', currentGame.id)

      setCurrentGame((prev) =>
        prev
          ? {
              ...prev,
              home_score: null,
              away_score: null,
              status: 'scheduled',
            }
          : null
      )
    }

    // Refresh to sync with server
    router.refresh()
  }

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
    square: Square | null
  } | null>(null)

  // Build winning squares map
  const winningSquareRounds = new Map<string, WinningRound>()

  // Define hierarchy for quarter/score_change/hybrid mode (higher number = higher priority display)
  const roundHierarchy: Record<string, number> = {
    score_change_forward: 1,
    score_change_reverse: 1,
    score_change_both: 2,
    score_change_final: 3,
    score_change_final_reverse: 3,
    score_change_final_both: 4,
    // Hybrid mode quarters (higher priority than regular score_change)
    hybrid_q1: 5,
    hybrid_q1_reverse: 5,
    hybrid_q1_both: 6,
    hybrid_halftime: 7,
    hybrid_halftime_reverse: 7,
    hybrid_halftime_both: 8,
    hybrid_q3: 9,
    hybrid_q3_reverse: 9,
    hybrid_q3_both: 10,
    hybrid_final: 11,
    hybrid_final_reverse: 11,
    hybrid_final_both: 12,
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
        // Hybrid mode - hybrid_q1, hybrid_halftime, hybrid_q3, hybrid_final (forward)
        else if (winner.win_type === 'hybrid_q1' || winner.win_type === 'hybrid_halftime' || winner.win_type === 'hybrid_q3' || winner.win_type === 'hybrid_final') {
          const reverseType = `${winner.win_type}_reverse`
          const alsoReverse = winners.some(
            (w) => w.square_id === winner.square_id && w.win_type === reverseType
          )
          round = alsoReverse ? `${winner.win_type}_both` as WinningRound : winner.win_type as WinningRound
        }
        // Hybrid mode - hybrid_q1_reverse, hybrid_halftime_reverse, hybrid_q3_reverse, hybrid_final_reverse
        else if (winner.win_type === 'hybrid_q1_reverse' || winner.win_type === 'hybrid_halftime_reverse' || winner.win_type === 'hybrid_q3_reverse' || winner.win_type === 'hybrid_final_reverse') {
          const forwardType = winner.win_type.replace('_reverse', '')
          const alsoForward = winners.some(
            (w) => w.square_id === winner.square_id && w.win_type === forwardType
          )
          round = alsoForward ? `${forwardType}_both` as WinningRound : winner.win_type as WinningRound
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
  // Skip if currentGame is final (state is more up-to-date than games prop)
  const liveWinningSquareIds = new Set<string>()
  if (numbersLocked && rowNumbers && colNumbers && currentGame?.status !== 'final') {
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
  const firstGame = currentGame
  const homeTeamLabel = firstGame?.home_team ?? 'Home'
  const awayTeamLabel = firstGame?.away_team ?? 'Away'

  // Game completion stats (for pool-settings complete button)
  const totalGamesCount = games.length
  const finalGamesCount = games.filter((g) => g.status === 'final').length
  const allGamesFinal = totalGamesCount > 0 && finalGamesCount === totalGamesCount
  const isCompleted = poolStatus === 'completed'

  // Both score_change and quarter modes use the same color scheme now
  const legendMode = 'score_change'

  const handleSquareClick = (rowIndex: number, colIndex: number, square: Square | null) => {
    if (!isCommissioner || isCompleted) return
    setSelectedSquare({ rowIndex, colIndex, square })
    setAssignDialogOpen(true)
  }

  const handleDialogClose = () => {
    setAssignDialogOpen(false)
    setSelectedSquare(null)
  }

  // Resolve the selected square from live realtime state (not the click-time
  // snapshot) so the assign dialog can detect concurrent edits
  const liveSelectedSquare = selectedSquare
    ? squares.find(
        (sq) =>
          sq.row_index === selectedSquare.rowIndex &&
          sq.col_index === selectedSquare.colIndex
      ) ?? null
    : null

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Main content - Grid and Games */}
        {/* min-w-0: keep the wide squares grid scrolling inside its column instead of stretching the page */}
        <div className="lg:col-span-3 space-y-6 min-w-0">
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
                  {isCommissioner && !isCompleted && (
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
                  // Check for both score_change_final types and hybrid_final types
                  const finalWinner = winners.find(w => w.win_type === 'score_change_final' || w.win_type === 'hybrid_final')
                  const finalReverseWinner = winners.find(w => w.win_type === 'score_change_final_reverse' || w.win_type === 'hybrid_final_reverse')

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
                {isCommissioner && !isCompleted && (
                  <ScoreEntry
                    game={firstGame}
                    sqPoolId={sqPoolId}
                    scoringMode={scoringMode ?? 'quarter'}
                    reverseScoring={reverseScoring}
                    squares={squares}
                    rowNumbers={rowNumbers ?? []}
                    colNumbers={colNumbers ?? []}
                    scoreChanges={scoreChanges}
                    onWinnersCreated={handleWinnersCreated}
                    onWinnersReplaced={handleWinnersReplaced}
                    onGameScoreUpdated={handleGameScoreUpdated}
                    onScoreChangeCreated={handleScoreChangeCreated}
                    onScoreChangeUpdated={handleScoreChangeUpdated}
                  />
                )}

                {/* Score change log for score_change and hybrid modes */}
                {(scoringMode === 'score_change' || scoringMode === 'hybrid') && scoreChanges.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="font-medium mb-2">Score Changes</h3>
                    <SimpleScoreChangeLog
                      scoreChanges={scoreChanges}
                      squares={squares}
                      rowNumbers={rowNumbers ?? []}
                      colNumbers={colNumbers ?? []}
                      reverseScoring={reverseScoring}
                      winners={winners}
                      isCommissioner={isCommissioner && !isCompleted}
                      isFinal={currentGame?.status === 'final'}
                      onDeleteScoreChange={handleDeleteScoreChange}
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
              allGamesFinal={allGamesFinal}
              finalGamesCount={finalGamesCount}
              totalGamesCount={totalGamesCount}
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
          currentName={liveSelectedSquare?.participant_name ?? null}
          currentVerified={liveSelectedSquare?.verified ?? false}
          squareId={liveSelectedSquare?.id ?? null}
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
