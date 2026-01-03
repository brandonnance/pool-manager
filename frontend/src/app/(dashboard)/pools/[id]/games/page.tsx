import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AddGameButton } from '@/components/games/add-game-button'
import { RemoveGameButton } from '@/components/games/remove-game-button'
import { EditSpreadButton } from '@/components/games/edit-spread-button'
import { EnterScoreButton } from '@/components/games/enter-score-button'

function formatMatchupWithSpread(
  awayTeam: string,
  homeTeam: string,
  homeSpread: number | null,
  awaySeed?: number,
  homeSeed?: number
): string {
  const awayDisplay = awaySeed ? `#${awaySeed} ${awayTeam}` : awayTeam
  const homeDisplay = homeSeed ? `#${homeSeed} ${homeTeam}` : homeTeam

  if (homeSpread === null || homeSpread === undefined) {
    return `${awayDisplay} @ ${homeDisplay}`
  }
  if (homeSpread === 0) {
    return `${awayDisplay} @ ${homeDisplay} (EVEN)`
  }
  if (homeSpread < 0) {
    // Home team favored
    return `${awayDisplay} @ ${homeDisplay} (${homeSpread})`
  }
  // Away team favored (positive home_spread means home is underdog)
  return `${awayDisplay} (${-homeSpread}) @ ${homeDisplay}`
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PoolGamesPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get pool
  const { data: pool } = await supabase
    .from('pools')
    .select(`
      id,
      name,
      org_id,
      status,
      organizations (name)
    `)
    .eq('id', id)
    .single()

  if (!pool) {
    notFound()
  }

  // Check if commissioner
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
  const isCommissioner = orgMembership?.role === 'admin' || isSuperAdmin

  if (!isCommissioner) {
    notFound()
  }

  // Get pool games with game details
  const { data: poolGames } = await supabase
    .from('bb_pool_games')
    .select(`
      id,
      kind,
      label,
      game_id,
      bb_games (
        id,
        game_name,
        kickoff_at,
        status,
        home_score,
        away_score,
        home_spread,
        home_team_id,
        away_team_id,
        home_team:bb_teams!bb_games_home_team_id_fkey (id, name, abbrev),
        away_team:bb_teams!bb_games_away_team_id_fkey (id, name, abbrev)
      )
    `)
    .eq('pool_id', id)
    .order('created_at', { ascending: true })

  // Get all teams for the add game form
  const { data: teams } = await supabase
    .from('bb_teams')
    .select('id, name, abbrev, logo_url, color')
    .order('name')

  // Get CFP seed information for this pool
  const { data: cfpByes } = await supabase
    .from('bb_cfp_pool_byes')
    .select('seed, team_id')
    .eq('pool_id', id)

  const { data: cfpRound1 } = await supabase
    .from('bb_cfp_pool_round1')
    .select('slot_key, team_a_id, team_b_id')
    .eq('pool_id', id)

  // Build seed map: team_id -> seed number
  const seedMap = new Map<string, number>()

  // Add bye seeds (1-4)
  cfpByes?.forEach((bye) => {
    if (bye.team_id) {
      seedMap.set(bye.team_id, bye.seed)
    }
  })

  // Add R1 seeds based on slot
  // R1A: #8 vs #9 (plays seed 1), R1B: #7 vs #10 (plays seed 2), R1C: #6 vs #11 (plays seed 3), R1D: #5 vs #12 (plays seed 4)
  const r1Seeds: Record<string, { a: number; b: number }> = {
    R1A: { a: 8, b: 9 },
    R1B: { a: 7, b: 10 },
    R1C: { a: 6, b: 11 },
    R1D: { a: 5, b: 12 },
  }

  cfpRound1?.forEach((r1) => {
    const seeds = r1Seeds[r1.slot_key]
    if (seeds) {
      if (r1.team_a_id) seedMap.set(r1.team_a_id, seeds.a)
      if (r1.team_b_id) seedMap.set(r1.team_b_id, seeds.b)
    }
  })

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li>
            <Link href="/orgs" className="hover:text-gray-700">
              Organizations
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/orgs/${pool.org_id}`} className="hover:text-gray-700">
              {pool.organizations?.name}
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/pools/${id}`} className="hover:text-gray-700">
              {pool.name}
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 font-medium">Manage Games</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Games</h1>
          <p className="text-gray-600 mt-1">
            Add bowl games to this pool. {poolGames?.length ?? 0} games added.
          </p>
        </div>
        <AddGameButton poolId={id} teams={teams ?? []} />
      </div>

      {/* Games List */}
      {!poolGames || poolGames.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No games yet</h3>
          <p className="text-gray-600 mb-4">Add bowl games for participants to make picks on.</p>
          <AddGameButton poolId={id} teams={teams ?? []} />
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {poolGames.map((pg) => {
              const game = pg.bb_games
              if (!game) return null

              return (
                <div key={pg.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">
                        {game.game_name || pg.label || 'Bowl Game'}
                      </div>
                      <div className="text-xs text-muted-foreground">{pg.kind}</div>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      game.status === 'final'
                        ? 'bg-gray-100 text-gray-800'
                        : game.status === 'in_progress'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {game.status}
                    </span>
                  </div>

                  <div className="text-sm">
                    <div className="text-gray-900">
                      {formatMatchupWithSpread(
                        game.away_team?.name ?? 'TBD',
                        game.home_team?.name ?? 'TBD',
                        game.home_spread,
                        pg.kind === 'cfp' && game.away_team_id ? seedMap.get(game.away_team_id) : undefined,
                        pg.kind === 'cfp' && game.home_team_id ? seedMap.get(game.home_team_id) : undefined
                      )}
                    </div>
                    {game.home_spread === null && pg.kind === 'bowl' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Needs Spread
                      </span>
                    )}
                    {game.status === 'final' && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Final: {game.away_score} - {game.home_score}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {game.kickoff_at
                      ? new Date(game.kickoff_at).toLocaleString()
                      : 'Kickoff TBD'}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <EnterScoreButton
                      gameId={game.id}
                      gameName={game.game_name || 'Bowl Game'}
                      homeTeamName={
                        pg.kind === 'cfp' && game.home_team_id && seedMap.get(game.home_team_id)
                          ? `#${seedMap.get(game.home_team_id)} ${game.home_team?.name ?? 'Home'}`
                          : game.home_team?.name ?? 'Home'
                      }
                      awayTeamName={
                        pg.kind === 'cfp' && game.away_team_id && seedMap.get(game.away_team_id)
                          ? `#${seedMap.get(game.away_team_id)} ${game.away_team?.name ?? 'Away'}`
                          : game.away_team?.name ?? 'Away'
                      }
                      currentHomeScore={game.home_score}
                      currentAwayScore={game.away_score}
                      currentStatus={game.status}
                    />
                    <EditSpreadButton
                      gameId={game.id}
                      poolGameId={pg.id}
                      poolId={id}
                      kind={pg.kind as 'bowl' | 'cfp'}
                      currentSpread={game.home_spread}
                      gameName={game.game_name || 'this game'}
                      currentGameName={game.game_name}
                      currentHomeTeamId={game.home_team_id}
                      currentAwayTeamId={game.away_team_id}
                      currentKickoffAt={game.kickoff_at}
                      teams={teams ?? []}
                    />
                    <RemoveGameButton poolGameId={pg.id} gameName={game.game_name || 'this game'} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Game
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Matchup
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kickoff
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {poolGames.map((pg) => {
                  const game = pg.bb_games
                  if (!game) return null

                  return (
                    <tr key={pg.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {game.game_name || pg.label || 'Bowl Game'}
                        </div>
                        <div className="text-xs text-gray-500">{pg.kind}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 flex items-center gap-2 flex-wrap">
                          <span className="whitespace-nowrap">
                            {formatMatchupWithSpread(
                              game.away_team?.name ?? 'TBD',
                              game.home_team?.name ?? 'TBD',
                              game.home_spread,
                              pg.kind === 'cfp' && game.away_team_id ? seedMap.get(game.away_team_id) : undefined,
                              pg.kind === 'cfp' && game.home_team_id ? seedMap.get(game.home_team_id) : undefined
                            )}
                          </span>
                          {game.home_spread === null && pg.kind === 'bowl' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 whitespace-nowrap">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Needs Spread
                            </span>
                          )}
                        </div>
                        {game.status === 'final' && (
                          <div className="text-xs text-gray-500">
                            {game.away_score} - {game.home_score}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {game.kickoff_at
                          ? new Date(game.kickoff_at).toLocaleString()
                          : 'TBD'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          game.status === 'final'
                            ? 'bg-gray-100 text-gray-800'
                            : game.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {game.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex flex-col gap-1 items-start">
                          <EnterScoreButton
                            gameId={game.id}
                            gameName={game.game_name || 'Bowl Game'}
                            homeTeamName={
                              pg.kind === 'cfp' && game.home_team_id && seedMap.get(game.home_team_id)
                                ? `#${seedMap.get(game.home_team_id)} ${game.home_team?.name ?? 'Home'}`
                                : game.home_team?.name ?? 'Home'
                            }
                            awayTeamName={
                              pg.kind === 'cfp' && game.away_team_id && seedMap.get(game.away_team_id)
                                ? `#${seedMap.get(game.away_team_id)} ${game.away_team?.name ?? 'Away'}`
                                : game.away_team?.name ?? 'Away'
                            }
                            currentHomeScore={game.home_score}
                            currentAwayScore={game.away_score}
                            currentStatus={game.status}
                          />
                          <EditSpreadButton
                            gameId={game.id}
                            poolGameId={pg.id}
                            poolId={id}
                            kind={pg.kind as 'bowl' | 'cfp'}
                            currentSpread={game.home_spread}
                            gameName={game.game_name || 'this game'}
                            currentGameName={game.game_name}
                            currentHomeTeamId={game.home_team_id}
                            currentAwayTeamId={game.away_team_id}
                            currentKickoffAt={game.kickoff_at}
                            teams={teams ?? []}
                          />
                          <RemoveGameButton poolGameId={pg.id} gameName={game.game_name || 'this game'} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Back to Pool */}
      <div className="mt-6">
        <Link
          href={`/pools/${id}`}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          &larr; Back to Pool
        </Link>
      </div>
    </div>
  )
}
