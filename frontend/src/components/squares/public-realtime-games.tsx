'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Game {
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
  current_period: number | null
  current_clock: string | null
}

// Format quarter/period display
function formatGameClock(period: number | null, clock: string | null): string | null {
  if (period === null || clock === null) return null

  const periodLabel = period <= 4 ? `Q${period}` : period === 5 ? 'OT' : `OT${period - 4}`
  return `${periodLabel} ${clock}`
}

interface Winner {
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
  quarter_marker?: string[] | null
}

interface Square {
  id: string
  row_index: number
  col_index: number
  participant_name: string | null
}

interface PublicRealtimeGamesProps {
  sqPoolId: string
  initialGames: Game[]
  initialWinners: Winner[]
  initialScoreChanges: ScoreChange[]
  initialSquares: Square[]
  rowNumbers: number[] | null
  colNumbers: number[] | null
  reverseScoring: boolean
  scoringMode: string | null
}

function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function PublicRealtimeGames({
  sqPoolId,
  initialGames,
  initialWinners,
  initialScoreChanges,
  initialSquares,
  rowNumbers,
  colNumbers,
  reverseScoring,
  scoringMode,
}: PublicRealtimeGamesProps) {
  const [games, setGames] = useState<Game[]>(initialGames)
  const [winners, setWinners] = useState<Winner[]>(initialWinners)
  const [scoreChanges, setScoreChanges] = useState<ScoreChange[]>(initialScoreChanges)
  const [squares] = useState<Square[]>(initialSquares ?? [])

  // Stable game IDs for subscription filtering - only changes when initialGames changes
  const gameIds = useMemo(() => initialGames.map((g) => g.id), [initialGames])

  // Create a lookup map for squares by position
  const squaresByPosition = useMemo(() => {
    const map = new Map<string, Square>()
    for (const sq of squares) {
      map.set(`${sq.row_index}-${sq.col_index}`, sq)
    }
    return map
  }, [squares])

  // Helper to get winner name for a given score
  const getWinnerForScore = (homeScore: number, awayScore: number, isReverse: boolean) => {
    if (!rowNumbers || !colNumbers) return null

    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10

    let rowIdx: number
    let colIdx: number

    if (isReverse) {
      rowIdx = rowNumbers.indexOf(awayDigit)
      colIdx = colNumbers.indexOf(homeDigit)
    } else {
      rowIdx = rowNumbers.indexOf(homeDigit)
      colIdx = colNumbers.indexOf(awayDigit)
    }

    if (rowIdx === -1 || colIdx === -1) return null

    const square = squaresByPosition.get(`${rowIdx}-${colIdx}`)
    return square?.participant_name ?? 'Unclaimed'
  }

  // Subscribe to game changes
  useEffect(() => {
    const supabase = createAnonClient()

    const channel = supabase
      .channel(`public-games-${sqPoolId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sq_games',
          filter: `sq_pool_id=eq.${sqPoolId}`,
        },
        (payload) => {
          console.log('[Realtime] Game update received:', payload)
          const updated = payload.new as Database['public']['Tables']['sq_games']['Row']
          setGames((prev) =>
            prev.map((g) =>
              g.id === updated.id
                ? {
                    ...g,
                    home_score: updated.home_score,
                    away_score: updated.away_score,
                    halftime_home_score: updated.halftime_home_score,
                    halftime_away_score: updated.halftime_away_score,
                    q1_home_score: updated.q1_home_score,
                    q1_away_score: updated.q1_away_score,
                    q3_home_score: updated.q3_home_score,
                    q3_away_score: updated.q3_away_score,
                    status: updated.status,
                    home_team: updated.home_team,
                    away_team: updated.away_team,
                    game_name: updated.game_name,
                    current_period: updated.current_period,
                    current_clock: updated.current_clock,
                  }
                : g
            )
          )
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Games subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sqPoolId])

  // Subscribe to winner changes
  useEffect(() => {
    if (gameIds.length === 0) return

    const supabase = createAnonClient()

    const channel = supabase
      .channel(`public-winners-${sqPoolId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sq_winners',
        },
        (payload) => {
          console.log('[Realtime] Winner change received:', payload)
          if (payload.eventType === 'INSERT') {
            const newWinner = payload.new as Database['public']['Tables']['sq_winners']['Row']
            if (gameIds.includes(newWinner.sq_game_id)) {
              setWinners((prev) => [...prev, newWinner as Winner])
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setWinners((prev) => prev.filter((w) => w.id !== deleted.id))
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Winners subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sqPoolId, gameIds])

  // Subscribe to score changes (for score_change and hybrid modes)
  useEffect(() => {
    if (scoringMode !== 'score_change' && scoringMode !== 'hybrid') return
    if (gameIds.length === 0) return

    const supabase = createAnonClient()

    const channel = supabase
      .channel(`public-score-changes-${sqPoolId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sq_score_changes',
        },
        (payload) => {
          console.log('[Realtime] Score change received:', payload)
          if (payload.eventType === 'INSERT') {
            const newChange = payload.new as Database['public']['Tables']['sq_score_changes']['Row']
            if (newChange.sq_game_id && gameIds.includes(newChange.sq_game_id)) {
              setScoreChanges((prev) => [...prev, newChange as ScoreChange])
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Database['public']['Tables']['sq_score_changes']['Row']
            if (updated.sq_game_id && gameIds.includes(updated.sq_game_id)) {
              setScoreChanges((prev) =>
                prev.map((sc) => (sc.id === updated.id ? { ...sc, ...updated } as ScoreChange : sc))
              )
            }
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setScoreChanges((prev) => prev.filter((sc) => sc.id !== deleted.id))
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Score changes subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sqPoolId, gameIds, scoringMode])

  // Group winners by change_order for score change log - includes both score_change and hybrid types
  const winnersByChangeOrder = new Map<number, Winner[]>()
  for (const w of winners) {
    if (w.win_type === 'score_change' || w.win_type === 'score_change_reverse' ||
        w.win_type.startsWith('hybrid_')) {
      const order = w.payout ?? 0
      if (!winnersByChangeOrder.has(order)) {
        winnersByChangeOrder.set(order, [])
      }
      winnersByChangeOrder.get(order)!.push(w)
    }
  }

  // Calculate wins by participant name for leaderboard with round breakdown
  interface RoundWins {
    total: number
    wc: number // wild card
    d: number // divisional
    c: number // conference
    sbh: number // super bowl halftime
    sb: number // super bowl final
  }
  const winsByName = new Map<string, RoundWins>()

  // Create game lookup for round info
  const gamesById = new Map(games.map((g) => [g.id, g]))

  for (const winner of winners) {
    if (winner.winner_name) {
      const current = winsByName.get(winner.winner_name) ?? {
        total: 0,
        wc: 0,
        d: 0,
        c: 0,
        sbh: 0,
        sb: 0,
      }

      current.total++

      // Get the round from the game
      const game = gamesById.get(winner.sq_game_id)
      if (game) {
        const isHalftime = winner.win_type === 'halftime' || winner.win_type === 'halftime_reverse'
        switch (game.round) {
          case 'wild_card':
            current.wc++
            break
          case 'divisional':
            current.d++
            break
          case 'conference':
            current.c++
            break
          case 'super_bowl':
            if (isHalftime) current.sbh++
            else current.sb++
            break
        }
      }

      winsByName.set(winner.winner_name, current)
    }
  }

  const leaderboardEntries = Array.from(winsByName.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.total - a.total)

  // Helper to format round wins as compact string (e.g., "1WC, 2D, 1C")
  const formatRoundWins = (entry: RoundWins): string => {
    const parts: string[] = []
    if (entry.wc > 0) parts.push(`${entry.wc}WC`)
    if (entry.d > 0) parts.push(`${entry.d}D`)
    if (entry.c > 0) parts.push(`${entry.c}C`)
    if (entry.sbh > 0) parts.push(`${entry.sbh}SBH`)
    if (entry.sb > 0) parts.push(`${entry.sb}SB`)
    return parts.join(', ')
  }

  // Check if this is a playoff pool (has rounds other than single_game)
  const isPlayoffPool = games.some((g) => g.round !== 'single_game')

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Games Column */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-lg font-semibold">Games</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {games.map((game) => {
            const isFinal = game.status === 'final'
            const isLive = game.status === 'in_progress'
            const isScheduled = !isFinal && !isLive

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
              <div
                key={game.id}
                className={cn(
                  'rounded-lg border p-4 transition-all duration-300',
                  // Scheduled: subtle, muted
                  isScheduled && 'bg-muted/30 border-muted',
                  // In Progress: highlighted with glow animation
                  isLive && 'bg-amber-50 border-amber-300 animate-game-live',
                  // Final: clean completion state
                  isFinal && 'bg-white border-emerald-200'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={cn(
                    'text-sm font-medium',
                    isScheduled && 'text-muted-foreground',
                    isLive && 'text-amber-900',
                    isFinal && 'text-foreground'
                  )}>
                    {game.game_name}
                  </span>
                  <div className="flex items-center gap-2">
                    {scoringMode === 'quarter' && isLive && currentPeriod && (
                      <span className="text-xs text-amber-700">{currentPeriod}</span>
                    )}
                    <Badge
                      variant={isFinal ? 'secondary' : isLive ? 'default' : 'outline'}
                      className={cn(
                        isLive && 'bg-amber-500 hover:bg-amber-500 text-white animate-pulse',
                        isFinal && 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      )}
                    >
                      {isFinal
                        ? '✓ Final'
                        : isLive
                        ? `● ${formatGameClock(game.current_period, game.current_clock) || 'Live'}`
                        : 'Scheduled'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center flex-1">
                    <div className={cn(
                      'text-sm font-medium truncate',
                      isScheduled && 'text-muted-foreground'
                    )}>
                      {game.away_team}
                    </div>
                    <div className={cn(
                      'text-3xl font-bold tabular-nums mt-1',
                      isScheduled && 'text-muted-foreground/50',
                      isLive && 'text-amber-900'
                    )}>
                      {hasScores ? displayAwayScore : '-'}
                    </div>
                  </div>
                  <div className={cn(
                    isScheduled ? 'text-muted-foreground/50' : 'text-muted-foreground'
                  )}>
                    @
                  </div>
                  <div className="text-center flex-1">
                    <div className={cn(
                      'text-sm font-medium truncate',
                      isScheduled && 'text-muted-foreground'
                    )}>
                      {game.home_team}
                    </div>
                    <div className={cn(
                      'text-3xl font-bold tabular-nums mt-1',
                      isScheduled && 'text-muted-foreground/50',
                      isLive && 'text-amber-900'
                    )}>
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

                {/* Current winners based on score */}
                {hasScores && (isLive || isFinal) && (
                  <div className={cn(
                    'mt-3 pt-3 border-t text-xs',
                    isLive && 'border-amber-200',
                    isFinal && 'border-emerald-100'
                  )}>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {/* Forward winner */}
                      <div className={cn(
                        'px-2 py-1 rounded-full',
                        isLive && 'bg-emerald-100 text-emerald-700',
                        isFinal && 'bg-emerald-50 text-emerald-600'
                      )}>
                        <span className="font-medium">
                          {getWinnerForScore(game.home_score!, game.away_score!, false)}
                        </span>
                      </div>
                      {/* Reverse winner (if enabled and different) */}
                      {reverseScoring && (() => {
                        const forwardWinner = getWinnerForScore(game.home_score!, game.away_score!, false)
                        const reverseWinner = getWinnerForScore(game.home_score!, game.away_score!, true)
                        if (reverseWinner && reverseWinner !== forwardWinner) {
                          return (
                            <div className={cn(
                              'px-2 py-1 rounded-full',
                              isLive && 'bg-rose-100 text-rose-700',
                              isFinal && 'bg-rose-50 text-rose-600'
                            )}>
                              <span className="text-[10px] opacity-70 mr-1">(R)</span>
                              <span className="font-medium">{reverseWinner}</span>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Score Change Log for score_change and hybrid modes */}
        {(scoringMode === 'score_change' || scoringMode === 'hybrid') && scoreChanges.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Score Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scoreChanges
                  .filter((sc) => sc.sq_game_id === games[0]?.id)
                  .sort((a, b) => b.change_order - a.change_order)
                  .map((change) => {
                    const changeWinners = winnersByChangeOrder.get(change.change_order) || []
                    const homeDigit = change.home_score % 10
                    const awayDigit = change.away_score % 10

                    // Get quarter badge color
                    const getQuarterBadgeStyle = (quarter: string) => {
                      switch (quarter) {
                        case 'q1': return 'bg-amber-100 text-amber-700'
                        case 'halftime': return 'bg-blue-100 text-blue-700'
                        case 'q3': return 'bg-teal-100 text-teal-700'
                        case 'final': return 'bg-purple-100 text-purple-700'
                        default: return 'bg-gray-100 text-gray-700'
                      }
                    }

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
                            {change.quarter_marker && change.quarter_marker.length > 0 && (
                              <>
                                {change.quarter_marker.map((qm) => (
                                  <span key={qm} className={`text-xs px-1.5 py-0.5 rounded font-medium ${getQuarterBadgeStyle(qm)}`}>
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
                        </div>

                        {changeWinners.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-dashed flex flex-wrap gap-2">
                            {changeWinners.map((winner) => {
                              // Get appropriate color based on win type
                              const getWinnerBadgeStyle = (winType: string) => {
                                if (winType.includes('_reverse')) {
                                  if (winType.startsWith('hybrid_q1')) return 'bg-orange-100 text-orange-700'
                                  if (winType.startsWith('hybrid_halftime')) return 'bg-cyan-100 text-cyan-700'
                                  if (winType.startsWith('hybrid_q3')) return 'bg-green-100 text-green-700'
                                  if (winType.startsWith('hybrid_final')) return 'bg-fuchsia-100 text-fuchsia-700'
                                  return 'bg-rose-100 text-rose-700'
                                }
                                if (winType.startsWith('hybrid_q1')) return 'bg-amber-100 text-amber-700'
                                if (winType.startsWith('hybrid_halftime')) return 'bg-blue-100 text-blue-700'
                                if (winType.startsWith('hybrid_q3')) return 'bg-teal-100 text-teal-700'
                                if (winType.startsWith('hybrid_final')) return 'bg-purple-100 text-purple-700'
                                return 'bg-emerald-100 text-emerald-700'
                              }

                              return (
                                <div
                                  key={winner.id}
                                  className={`text-xs px-2 py-1 rounded ${getWinnerBadgeStyle(winner.win_type)}`}
                                >
                                  {winner.win_type.includes('_reverse') && <span className="mr-1">(R)</span>}
                                  {winner.winner_name || 'Unclaimed'}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Winners Column */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Winners</h2>
        {leaderboardEntries.length > 0 ? (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                {leaderboardEntries.map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between text-sm px-2 py-1.5 rounded hover:bg-muted/50"
                  >
                    <span className="truncate">{entry.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                      {isPlayoffPool ? formatRoundWins(entry) : `${entry.total} win${entry.total !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No winners yet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
