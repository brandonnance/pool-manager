/**
 * @fileoverview Public squares grid view page
 * @route /view/[slug]
 * @auth Public (no authentication required)
 * @layout Standalone (custom header/footer)
 *
 * @description
 * Public view for NFL Playoff Squares pools.
 * Allows anyone with the slug to view the grid, games, and winners
 * without needing an account. Uses realtime subscriptions for live updates.
 *
 * @features
 * - Anonymous access via public_slug
 * - Realtime grid updates (squares claimed)
 * - Realtime game/score updates
 * - Winner highlighting with round-based colors
 * - Support for multiple scoring modes (full_playoff, single_game, quarter, score_change)
 * - Reverse scoring visualization
 * - Status badges (Numbers Locked, Collecting Squares)
 *
 * @components
 * - PublicRealtimeGrid: Realtime squares grid with winner highlighting
 * - PublicRealtimeGames: Realtime games list with scores and winners
 *
 * @data_fetching
 * - sq_pools: Pool settings by public_slug
 * - pools: Pool name and status
 * - sq_squares: Grid squares with participant names
 * - sq_games: Games with scores (if numbers locked)
 * - sq_winners: Winner records for highlighting
 * - sq_score_changes: Score change history (for score_change mode)
 */
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { PublicRealtimeGrid } from '@/components/squares/public-realtime-grid'
import { PublicRealtimeGames } from '@/components/squares/public-realtime-games'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * Create an anonymous Supabase client for public access
 * Uses anon key which respects RLS policies for public tables
 */
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
      public_slug,
      numbers_locked,
      row_numbers,
      col_numbers,
      mode,
      scoring_mode,
      reverse_scoring,
      event_type
    `)
    .eq('public_slug', slug)
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
    current_period: number | null
    current_clock: string | null
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
    quarter_marker?: string[] | null
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

      // Fetch score changes for score_change and hybrid modes
      if (sqPool.scoring_mode === 'score_change' || sqPool.scoring_mode === 'hybrid') {
        const { data: scoreChangesData } = await supabase
          .from('sq_score_changes')
          .select('*')
          .in('sq_game_id', gameIds)
          .order('change_order', { ascending: false })

        scoreChanges = scoreChangesData ?? []
      }
    }
  }

  // Winning-square highlighting is computed client-side in PublicRealtimeGrid
  // (lib/squares buildWinningRoundsMap) so it can update live as winners change.

  // Get team labels - only use team names for single game mode
  // For playoff mode, teams change per game so use generic labels
  const firstGame = games[0] ?? null
  const isSingleGame = sqPool.mode === 'single_game'
  const homeTeamLabel = isSingleGame && firstGame?.home_team ? firstGame.home_team : 'Home'
  const awayTeamLabel = isSingleGame && firstGame?.away_team ? firstGame.away_team : 'Away'

  // Determine legend mode based on pool settings
  // Both score_change and quarter modes use the same color scheme
  const legendMode = sqPool.mode === 'single_game'
    ? 'score_change'
    : sqPool.event_type === 'march_madness'
      ? 'march_madness'
      : 'full_playoff'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pool.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {sqPool.mode === 'single_game'
                  ? 'Single Game Squares'
                  : sqPool.event_type === 'march_madness'
                    ? 'March Madness Squares'
                    : 'NFL Playoff Squares'}
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
        {/* Grid - with realtime updates (renders its own card + final winner banner) */}
        <PublicRealtimeGrid
          sqPoolId={sqPool.id}
          initialSquares={squares.map((s) => ({
            id: s.id,
            row_index: s.row_index,
            col_index: s.col_index,
            participant_name: s.participant_name,
            verified: false, // Public view never shows verified status
          }))}
          initialGames={games.map((g) => ({
            id: g.id,
            round: g.round,
            home_score: g.home_score,
            away_score: g.away_score,
            status: g.status,
          }))}
          initialWinners={winners.map((w) => ({
            id: w.id,
            sq_game_id: w.sq_game_id,
            square_id: w.square_id,
            win_type: w.win_type,
            payout: w.payout,
            winner_name: w.winner_name,
          }))}
          rowNumbers={sqPool.row_numbers}
          colNumbers={sqPool.col_numbers}
          numbersLocked={sqPool.numbers_locked ?? false}
          reverseScoring={sqPool.reverse_scoring ?? false}
          homeTeamLabel={homeTeamLabel}
          awayTeamLabel={awayTeamLabel}
          legendMode={legendMode}
        />

        {/* Games and Scores - only show after lock */}
        {sqPool.numbers_locked && games.length > 0 && (
          <PublicRealtimeGames
            sqPoolId={sqPool.id}
            initialGames={games}
            initialWinners={winners}
            initialScoreChanges={scoreChanges}
            initialSquares={squares.map((s) => ({
              id: s.id,
              row_index: s.row_index,
              col_index: s.col_index,
              participant_name: s.participant_name,
            }))}
            rowNumbers={sqPool.row_numbers}
            colNumbers={sqPool.col_numbers}
            reverseScoring={sqPool.reverse_scoring ?? false}
            scoringMode={sqPool.scoring_mode}
            eventType={sqPool.event_type ?? 'nfl_playoffs'}
          />
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
