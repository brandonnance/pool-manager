import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AddGameButton } from '@/components/games/add-game-button'
import { RemoveGameButton } from '@/components/games/remove-game-button'

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
  const isCommissioner = orgMembership?.role === 'commissioner' || isSuperAdmin

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
    .select('id, name, abbrev')
    .order('name')

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
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {game.away_team?.name ?? 'TBD'} @ {game.home_team?.name ?? 'TBD'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <RemoveGameButton poolGameId={pg.id} gameName={game.game_name || 'this game'} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
