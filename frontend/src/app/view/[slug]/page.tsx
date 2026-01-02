import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { PublicRealtimeGrid } from '@/components/squares/public-realtime-grid'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WinningRound } from '@/components/squares/square-cell'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Create an anonymous Supabase client for public access
function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function PublicViewPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = createAnonClient()

  // Look up pool by public_slug
  const { data: sqPool } = await supabase
    .from('sq_pools')
    .select(`
      id,
      pool_id,
      no_account_mode,
      public_slug,
      numbers_locked,
      row_numbers,
      col_numbers,
      mode,
      scoring_mode,
      reverse_scoring
    `)
    .eq('public_slug', slug)
    .eq('no_account_mode', true)
    .single()

  if (!sqPool) {
    notFound()
  }

  // Get pool name
  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, status')
    .eq('id', sqPool.pool_id)
    .single()

  if (!pool) {
    notFound()
  }

  // Get squares - exclude verified column for public view
  const { data: squaresData } = await supabase
    .from('sq_squares')
    .select('id, row_index, col_index, participant_name')
    .eq('sq_pool_id', sqPool.id)

  const squares = squaresData ?? []

  // Get games if numbers are locked
  let games: Array<{
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
  }> = []
  let winners: Array<{
    id: string
    square_id: string | null
    win_type: string
    payout: number | null
    winner_name: string | null
    sq_game_id: string
  }> = []
  let scoreChanges: Array<{
    id: string
    home_score: number
    away_score: number
    change_order: number
    sq_game_id: string | null
  }> = []

  if (sqPool.numbers_locked) {
    // Fetch games
    const { data: gamesData } = await supabase
      .from('sq_games')
      .select('*')
      .eq('sq_pool_id', sqPool.id)
      .order('display_order')

    games = gamesData ?? []

    // Fetch winners
    if (games.length > 0) {
      const gameIds = games.map((g) => g.id)
      const { data: winnersData } = await supabase
        .from('sq_winners')
        .select('*')
        .in('sq_game_id', gameIds)

      winners = winnersData ?? []

      // Fetch score changes for score_change mode
      if (sqPool.scoring_mode === 'score_change') {
        const { data: scoreChangesData } = await supabase
          .from('sq_score_changes')
          .select('*')
          .in('sq_game_id', gameIds)
          .order('change_order', { ascending: false })

        scoreChanges = scoreChangesData ?? []
      }
    }
  }

  // Build winning squares map for grid highlighting
  // Use an array of tuples for serialization (Maps can't be passed to client components)
  const winningSquareRoundsMap = new Map<string, WinningRound>()

  if (sqPool.numbers_locked) {
    for (const winner of winners) {
      if (winner.square_id) {
        // Determine winning round based on win_type
        let round: WinningRound = null
        if (winner.win_type === 'normal' || winner.win_type === 'reverse') {
          const game = games.find((g) => g.id === winner.sq_game_id)
          if (game) {
            round = game.round as WinningRound
          }
        } else if (winner.win_type.startsWith('score_change')) {
          // Score change mode winning types
          if (winner.win_type === 'score_change_final_both') {
            round = 'score_change_final_both'
          } else if (winner.win_type === 'score_change_final_reverse') {
            round = 'score_change_final_reverse'
          } else if (winner.win_type === 'score_change_final') {
            round = 'score_change_final'
          } else if (winner.win_type === 'score_change_reverse') {
            // Check if also forward winner for "both"
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
        } else if (winner.win_type === 'halftime') {
          round = 'super_bowl_halftime'
        }

        if (round) {
          // Don't overwrite with a lesser win type
          const existing = winningSquareRoundsMap.get(winner.square_id)
          if (!existing) {
            winningSquareRoundsMap.set(winner.square_id, round)
          }
        }
      }
    }
  }

  // Convert Map to array for serialization to client component
  const winningSquareRoundsArray = Array.from(winningSquareRoundsMap.entries())

  // Calculate wins by participant name for leaderboard
  const winsByName = new Map<string, number>()
  for (const winner of winners) {
    if (winner.winner_name) {
      const current = winsByName.get(winner.winner_name) ?? 0
      winsByName.set(winner.winner_name, current + 1)
    }
  }

  const leaderboardEntries = Array.from(winsByName.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)

  // Get first game for team labels
  const firstGame = games[0] ?? null
  const homeTeamLabel = firstGame?.home_team ?? 'Home'
  const awayTeamLabel = firstGame?.away_team ?? 'Away'

  // Determine legend mode based on pool settings
  const legendMode = sqPool.mode === 'single_game'
    ? sqPool.scoring_mode === 'score_change'
      ? 'score_change'
      : 'single_game'
    : 'full_playoff'

  // Group winners by change_order for score change log
  const winnersByChangeOrder = new Map<number, typeof winners>()
  for (const w of winners) {
    if (w.win_type === 'score_change' || w.win_type === 'score_change_reverse') {
      const order = w.payout ?? 0
      if (!winnersByChangeOrder.has(order)) {
        winnersByChangeOrder.set(order, [])
      }
      winnersByChangeOrder.get(order)!.push(w)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pool.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {sqPool.mode === 'single_game' ? 'Single Game Squares' : 'NFL Playoff Squares'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {sqPool.numbers_locked ? (
                <Badge variant="default">Numbers Locked</Badge>
              ) : (
                <Badge variant="secondary">Collecting Squares</Badge>
              )}
              {sqPool.reverse_scoring && (
                <Badge variant="outline">Reverse Scoring</Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Grid - with realtime updates */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Squares Grid</CardTitle>
          </CardHeader>
          <CardContent>
            <PublicRealtimeGrid
              sqPoolId={sqPool.id}
              initialSquares={squares.map((s) => ({
                id: s.id,
                row_index: s.row_index,
                col_index: s.col_index,
                participant_name: s.participant_name,
                verified: false, // Public view never shows verified status
              }))}
              rowNumbers={sqPool.row_numbers}
              colNumbers={sqPool.col_numbers}
              numbersLocked={sqPool.numbers_locked ?? false}
              winningSquareRoundsArray={winningSquareRoundsArray}
              homeTeamLabel={homeTeamLabel}
              awayTeamLabel={awayTeamLabel}
              legendMode={legendMode}
            />
          </CardContent>
        </Card>

        {/* Games and Scores - only show after lock */}
        {sqPool.numbers_locked && games.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Games Column */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-semibold">Games</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {games.map((game) => {
                  const hasScores = game.home_score !== null && game.away_score !== null
                  const isFinal = game.status === 'final'

                  return (
                    <div key={game.id} className="bg-white rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">{game.game_name}</span>
                        <Badge variant={isFinal ? 'secondary' : game.status === 'in_progress' ? 'default' : 'outline'}>
                          {isFinal ? 'Final' : game.status === 'in_progress' ? 'Live' : 'Scheduled'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center flex-1">
                          <div className="text-sm font-medium truncate">{game.away_team}</div>
                          <div className="text-3xl font-bold tabular-nums mt-1">
                            {hasScores ? game.away_score : '-'}
                          </div>
                        </div>
                        <div className="text-muted-foreground">@</div>
                        <div className="text-center flex-1">
                          <div className="text-sm font-medium truncate">{game.home_team}</div>
                          <div className="text-3xl font-bold tabular-nums mt-1">
                            {hasScores ? game.home_score : '-'}
                          </div>
                        </div>
                      </div>
                      {/* Quarter scores for quarter mode */}
                      {sqPool.scoring_mode === 'quarter' && (
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
                    </div>
                  )
                })}
              </div>

              {/* Score Change Log for score_change mode */}
              {sqPool.scoring_mode === 'score_change' && scoreChanges.length > 0 && (
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
                                </div>
                              </div>

                              {changeWinners.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-dashed flex flex-wrap gap-2">
                                  {changeWinners.map((winner) => (
                                    <div
                                      key={winner.id}
                                      className={`text-xs px-2 py-1 rounded ${
                                        winner.win_type === 'score_change_reverse'
                                          ? 'bg-rose-100 text-rose-700'
                                          : 'bg-emerald-100 text-emerald-700'
                                      }`}
                                    >
                                      {winner.win_type === 'score_change_reverse' && <span className="mr-1">(R)</span>}
                                      {winner.winner_name || 'Unclaimed'}
                                    </div>
                                  ))}
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

            {/* Leaderboard Column */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Wins</h2>
              {leaderboardEntries.length > 0 ? (
                <Card>
                  <CardContent className="pt-4">
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
                          <span className="font-bold tabular-nums">{entry.total}</span>
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
        )}

        {/* Info when not locked */}
        {!sqPool.numbers_locked && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                The grid is still being filled. Check back once the commissioner locks the numbers
                to see games and scores.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 py-6 text-center text-sm text-muted-foreground border-t bg-white">
        <p>Powered by BN Pools</p>
      </footer>
    </div>
  )
}
