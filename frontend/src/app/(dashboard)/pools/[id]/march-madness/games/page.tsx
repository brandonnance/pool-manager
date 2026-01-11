/**
 * @fileoverview March Madness score entry page
 * @route /pools/[id]/march-madness/games
 * @auth Commissioner only
 * @layout Dashboard layout
 *
 * @description
 * Commissioner page for entering game scores and spreads.
 * Games are organized by tournament round (R64 → Final).
 * Marking games final triggers entry elimination and bracket progression.
 *
 * @features
 * - Games grouped by round (Round of 64, 32, Sweet 16, Elite 8, Final Four, Championship)
 * - Score entry dialog for each game
 * - Spread entry for betting line tracking
 * - Game status badges (Scheduled, Live, Final)
 * - Progress indicator (X/63 games complete)
 * - Winner highlighting (green text on winning team)
 * - Seed display and spread indicators
 *
 * @components
 * - EnterScoreDialog: Modal to enter/update scores and mark final
 * - EnterSpreadDialog: Modal to set betting spread before game starts
 *
 * @data_fetching
 * - mm_pools: Draw status check
 * - mm_games: All 63 tournament games with scores/status
 * - mm_pool_teams: Team details for display (name, seed, abbrev)
 *
 * @game_flow
 * When a game is marked final:
 * 1. Losing entry is marked eliminated
 * 2. Spread covering team is calculated
 * 3. Winning entry advances to next round game
 * 4. Payouts are calculated based on payout percentages
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EnterScoreDialog, EnterSpreadDialog } from '@/components/march-madness'

interface PageProps {
  params: Promise<{ id: string }>
}

/** Order of tournament rounds from first to last */
const ROUND_ORDER = ['R64', 'R32', 'S16', 'E8', 'F4', 'Final']

/** Human-readable labels for each round */
const ROUND_LABELS: Record<string, string> = {
  'R64': 'Round of 64',
  'R32': 'Round of 32',
  'S16': 'Sweet 16',
  'E8': 'Elite 8',
  'F4': 'Final Four',
  'Final': 'Championship',
}

export default async function MarchMadnessGamesPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get pool
  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, type, status, org_id')
    .eq('id', id)
    .single()

  if (!pool || pool.type !== 'march_madness') {
    notFound()
  }

  // Check commissioner access
  const { data: poolMembership } = await supabase
    .from('pool_memberships')
    .select('role')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .single()

  const { data: orgMembership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', pool.org_id)
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.is_super_admin ?? false
  const isOrgAdmin = orgMembership?.role === 'admin' || isSuperAdmin
  const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin

  if (!isPoolCommissioner) {
    redirect(`/pools/${id}/march-madness`)
  }

  // Get mm_pool config
  const { data: mmPool } = await supabase
    .from('mm_pools')
    .select('*')
    .eq('pool_id', id)
    .single()

  if (!mmPool) {
    notFound()
  }

  // Get all games
  const { data: games } = await supabase
    .from('mm_games')
    .select('*')
    .eq('mm_pool_id', mmPool.id)
    .order('round')
    .order('region')
    .order('game_number')

  // Get pool teams for team names
  const { data: poolTeams } = await supabase
    .from('mm_pool_teams')
    .select('*, bb_teams (id, name, abbrev)')
    .eq('mm_pool_id', mmPool.id)

  const teamById = new Map(poolTeams?.map(t => [t.id, t]) ?? [])

  // Group games by round
  const gamesByRound = ROUND_ORDER.map(round => ({
    round,
    label: ROUND_LABELS[round],
    games: (games ?? []).filter(g => g.round === round),
  })).filter(r => r.games.length > 0)

  // Count stats
  const totalGames = games?.length ?? 0
  const completedGames = games?.filter(g => g.status === 'final').length ?? 0
  const inProgressGames = games?.filter(g => g.status === 'in_progress').length ?? 0

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4">
        <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
          <li>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/pools/${id}`} className="hover:text-foreground transition-colors">
              {pool.name}
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/pools/${id}/march-madness`} className="hover:text-foreground transition-colors">
              March Madness
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground font-medium">Games</li>
        </ol>
      </nav>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Enter Scores</h1>
          <p className="text-muted-foreground">
            Enter game scores and mark games as final
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {completedGames}/{totalGames} Complete
          </Badge>
          {inProgressGames > 0 && (
            <Badge className="bg-amber-500 text-sm px-3 py-1">
              {inProgressGames} Live
            </Badge>
          )}
        </div>
      </div>

      {!mmPool.draw_completed && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="py-4">
            <p className="text-amber-800">
              <strong>Note:</strong> The team draw has not been completed yet.
              Run the draw first before entering scores.
            </p>
          </CardContent>
        </Card>
      )}

      {totalGames === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No games have been created yet. Complete the team draw to generate games.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {gamesByRound.map(({ round, label, games: roundGames }) => (
            <Card key={round}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span>{label}</span>
                  <Badge variant="outline">
                    {roundGames.filter(g => g.status === 'final').length}/{roundGames.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {roundGames.map((game) => {
                    const higherTeam = game.higher_seed_team_id ? teamById.get(game.higher_seed_team_id) : undefined
                    const lowerTeam = game.lower_seed_team_id ? teamById.get(game.lower_seed_team_id) : undefined

                    const isFinal = game.status === 'final'
                    const isLive = game.status === 'in_progress'
                    const hasScores = game.higher_seed_score !== null && game.lower_seed_score !== null

                    const higherWins = hasScores && game.higher_seed_score! > game.lower_seed_score!
                    const lowerWins = hasScores && game.lower_seed_score! > game.higher_seed_score!

                    return (
                      <div
                        key={game.id}
                        className={`rounded-lg border p-3 ${
                          isFinal
                            ? 'bg-muted/30'
                            : isLive
                            ? 'border-amber-300 bg-amber-50'
                            : 'bg-card'
                        }`}
                      >
                        {/* Game header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            {game.region ? `${game.region} Region` : 'Final Four'}
                          </span>
                          <Badge
                            variant={isFinal ? 'secondary' : isLive ? 'default' : 'outline'}
                            className={isLive ? 'bg-amber-500' : ''}
                          >
                            {isFinal ? 'Final' : isLive ? 'Live' : 'Scheduled'}
                          </Badge>
                        </div>

                        {/* Teams */}
                        <div className="space-y-2 mb-3">
                          {/* Higher seed (favorite) */}
                          <div className={`flex items-center justify-between ${
                            higherWins && isFinal ? 'font-semibold text-emerald-700' : ''
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">
                                {higherTeam?.seed}
                              </span>
                              <span className="truncate text-sm">
                                {higherTeam?.bb_teams?.abbrev || higherTeam?.bb_teams?.name || 'TBD'}
                              </span>
                              {game.spread !== null && (
                                <span className="text-xs text-muted-foreground">
                                  ({game.spread > 0 ? '+' : ''}{game.spread})
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-bold">
                              {game.higher_seed_score ?? '-'}
                            </span>
                          </div>

                          {/* Lower seed */}
                          <div className={`flex items-center justify-between ${
                            lowerWins && isFinal ? 'font-semibold text-emerald-700' : ''
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">
                                {lowerTeam?.seed}
                              </span>
                              <span className="truncate text-sm">
                                {lowerTeam?.bb_teams?.abbrev || lowerTeam?.bb_teams?.name || 'TBD'}
                              </span>
                            </div>
                            <span className="font-mono font-bold">
                              {game.lower_seed_score ?? '-'}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {game.spread === null && game.status === 'scheduled' && (
                            <EnterSpreadDialog
                              gameId={game.id}
                              higherSeedTeamName={higherTeam?.bb_teams?.name || 'Higher Seed'}
                              lowerSeedTeamName={lowerTeam?.bb_teams?.name || 'Lower Seed'}
                              currentSpread={game.spread}
                            />
                          )}
                          <EnterScoreDialog
                            gameId={game.id}
                            higherSeedTeamName={higherTeam?.bb_teams?.name || 'Higher Seed'}
                            lowerSeedTeamName={lowerTeam?.bb_teams?.name || 'Lower Seed'}
                            higherSeedSeed={higherTeam?.seed || 0}
                            lowerSeedSeed={lowerTeam?.seed || 0}
                            currentHigherScore={game.higher_seed_score}
                            currentLowerScore={game.lower_seed_score}
                            currentStatus={game.status}
                            spread={game.spread}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
