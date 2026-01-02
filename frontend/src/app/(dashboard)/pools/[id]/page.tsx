import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PoolSettings } from '@/components/pools/pool-settings'
import { JoinPoolButton } from '@/components/pools/join-pool-button'
import { SuperAdminJoinPoolButton } from '@/components/pools/super-admin-join-pool-button'
import { CreateEntryButton } from '@/components/pools/create-entry-button'
import { PoolStandings } from '@/components/standings/pool-standings'
import { PlayoffSquaresContent } from '@/components/squares/playoff-squares-content'
import { SingleGameSquaresContent } from '@/components/squares/single-game-squares-content'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PoolDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get pool with org info
  const { data: pool } = await supabase
    .from('pools')
    .select(`
      id,
      name,
      type,
      status,
      season_label,
      settings,
      visibility,
      demo_mode,
      created_at,
      created_by,
      org_id,
      organizations (
        id,
        name
      )
    `)
    .eq('id', id)
    .single()

  if (!pool) {
    notFound()
  }

  // Check if user is pool member (including role)
  const { data: poolMembership } = await supabase
    .from('pool_memberships')
    .select('id, status, role')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .single()

  // Check if org admin
  const { data: orgMembership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', pool.org_id)
    .eq('user_id', user.id)
    .single()

  // Check if super admin and get display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin, display_name')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.is_super_admin ?? false
  const isOrgAdmin = orgMembership?.role === 'admin' || isSuperAdmin
  // Pool commissioner = explicit pool role OR org admin (implicit commissioner rights)
  const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin
  // Keep isCommissioner as alias for backward compatibility in this file
  const isCommissioner = isPoolCommissioner

  const isMember = poolMembership?.status === 'approved'
  const isPending = poolMembership?.status === 'pending'

  // Get pool games with status for completion tracking
  const { data: poolGamesData, count: gamesCount } = await supabase
    .from('bb_pool_games')
    .select(`
      id,
      bb_games (status)
    `, { count: 'exact' })
    .eq('pool_id', id)

  // Calculate how many games are final
  const finalGamesCount = poolGamesData?.filter(pg => pg.bb_games?.status === 'final').length ?? 0
  const totalGamesCount = gamesCount ?? 0
  const allGamesFinal = totalGamesCount > 0 && finalGamesCount === totalGamesCount

  // Get member count
  const { count: memberCount } = await supabase
    .from('pool_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', id)
    .eq('status', 'approved')

  // Get pending member count for commissioners
  const { count: pendingMemberCount } = await supabase
    .from('pool_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', id)
    .eq('status', 'pending')

  // Get user's entry if they have one (Bowl Buster only)
  const { data: entry } = pool.type === 'bowl_buster'
    ? await supabase
        .from('bb_entries')
        .select('id')
        .eq('pool_id', id)
        .eq('user_id', user.id)
        .single()
    : { data: null }

  // ============================================
  // PLAYOFF SQUARES DATA FETCHING
  // ============================================
  let sqPoolData = null
  let sqSquaresData: Array<{
    id: string
    row_index: number
    col_index: number
    user_id: string | null
  }> = []
  let sqGamesData: Array<{
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
    round: string
    status: string | null
    pays_halftime: boolean | null
    display_order: number | null
  }> = []
  let sqScoreChangesData: Array<{
    id: string
    sq_game_id: string | null
    home_score: number
    away_score: number
    change_order: number
    created_at: string | null
  }> = []
  let sqWinnersData: Array<{
    id: string
    sq_game_id: string
    square_id: string | null
    win_type: string
    payout: number | null
    winner_name: string | null
  }> = []
  let sqOwnerProfiles = new Map<string, string | null>()

  if (pool.type === 'playoff_squares') {
    // Get sq_pool config
    const { data: sqPool } = await supabase
      .from('sq_pools')
      .select('*')
      .eq('pool_id', id)
      .single()
    sqPoolData = sqPool

    if (sqPool) {
      // Get all squares
      const { data: squares } = await supabase
        .from('sq_squares')
        .select('id, row_index, col_index, user_id')
        .eq('sq_pool_id', sqPool.id)
      sqSquaresData = squares ?? []

      // Get owner profiles
      const ownerIds = [...new Set(sqSquaresData.filter(s => s.user_id).map(s => s.user_id!))]
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ownerIds)
        profiles?.forEach(p => sqOwnerProfiles.set(p.id, p.display_name))
      }

      // Get all games
      const { data: games } = await supabase
        .from('sq_games')
        .select('*')
        .eq('sq_pool_id', sqPool.id)
        .order('display_order', { ascending: true })
      sqGamesData = games ?? []

      // Get all winners
      const gameIds = sqGamesData.map((g) => g.id)
      if (gameIds.length > 0) {
        const { data: winners } = await supabase
          .from('sq_winners')
          .select('*')
          .in('sq_game_id', gameIds)
        sqWinnersData = winners ?? []

        // Get score changes (for single_game mode with score_change scoring)
        if (sqPool.mode === 'single_game' && sqPool.scoring_mode === 'score_change') {
          const { data: scoreChanges } = await supabase
            .from('sq_score_changes')
            .select('*')
            .in('sq_game_id', gameIds)
            .order('change_order', { ascending: true })
          sqScoreChangesData = scoreChanges ?? []
        }
      }
    }
  }

  // Transform squares data for component
  const squaresForGrid = sqSquaresData.map((sq) => {
    const displayName = sq.user_id ? sqOwnerProfiles.get(sq.user_id) : null
    // Generate initials from display name (e.g., "John Doe" -> "JD")
    const initials = displayName
      ? displayName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : null
    return {
      id: sq.id,
      row_index: sq.row_index,
      col_index: sq.col_index,
      user_id: sq.user_id,
      owner_name: displayName ?? null,
      owner_initials: initials,
    }
  })

  // ============================================
  // BOWL BUSTER DATA FETCHING
  // ============================================

  // Calculate standings - get all entries with their picks and game results
  const { data: entriesData } = await supabase
    .from('bb_entries')
    .select(`
      id,
      user_id,
      bb_bowl_picks (
        id,
        picked_team_id,
        pool_game_id,
        bb_pool_games (
          id,
          kind,
          bb_games (
            status,
            home_score,
            away_score,
            home_team_id,
            away_team_id
          )
        )
      )
    `)
    .eq('pool_id', id)

  // Get profiles for all entry users
  const userIds = (entriesData ?? []).map(e => e.user_id)
  const { data: profilesData } = userIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)
    : { data: [] }

  const profilesMap = new Map((profilesData ?? []).map(p => [p.id, p.display_name]))

  // Process standings data to calculate scores
  interface EntryStanding {
    entry_id: string
    display_name: string
    total_score: number
    correct_picks: number
    wrong_picks: number
    pending_picks: number
  }

  const standings: EntryStanding[] = (entriesData ?? []).map((entry) => {
    let total_score = 0
    let correct_picks = 0
    let wrong_picks = 0
    let pending_picks = 0

    const picks = entry.bb_bowl_picks ?? []
    for (const pick of picks) {
      const poolGame = pick.bb_pool_games
      if (!poolGame || poolGame.kind !== 'bowl') continue

      const game = poolGame.bb_games
      if (!game) continue

      if (game.status !== 'final' || game.home_score === null || game.away_score === null) {
        pending_picks++
        continue
      }

      const margin = Math.abs(game.home_score - game.away_score)
      let winnerId: string | null = null

      if (game.home_score > game.away_score) {
        winnerId = game.home_team_id
      } else if (game.away_score > game.home_score) {
        winnerId = game.away_team_id
      }

      if (winnerId === null) {
        // Tie game - no points
        continue
      }

      if (pick.picked_team_id === winnerId) {
        total_score += margin
        correct_picks++
      } else {
        total_score -= margin
        wrong_picks++
      }
    }

    return {
      entry_id: entry.id,
      display_name: profilesMap.get(entry.user_id) ?? 'Unknown',
      total_score,
      correct_picks,
      wrong_picks,
      pending_picks,
    }
  })

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4">
        <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
          <li>
            <Link href="/orgs" className="hover:text-foreground transition-colors">
              Organizations
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/orgs/${pool.org_id}`} className="hover:text-foreground transition-colors">
              {pool.organizations?.name}
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground font-medium">{pool.name}</li>
        </ol>
      </nav>

      {/* Pool Header */}
      <Card className="mb-6 border-l-4 border-l-primary">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{pool.name}</h1>
                <Badge
                  variant={
                    pool.status === 'open' ? 'default' :
                    pool.status === 'completed' ? 'secondary' :
                    'outline'
                  }
                  className={
                    pool.status === 'open' ? 'bg-primary' :
                    pool.status === 'draft' ? 'border-amber-500 text-amber-600' :
                    ''
                  }
                >
                  {pool.status === 'completed' ? 'Completed' : pool.status}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {pool.type === 'bowl_buster' ? 'Bowl Buster' : pool.type === 'playoff_squares' || pool.type === 'single_game_squares' ? 'Squares' : pool.type}
                {pool.season_label && ` - ${pool.season_label}`}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {memberCount} member{memberCount !== 1 ? 's' : ''}
                {pool.type === 'bowl_buster' && <> &middot; {gamesCount ?? 0} game{(gamesCount ?? 0) !== 1 ? 's' : ''}</>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isCommissioner && (
                <>
                  <Link href={`/pools/${id}/members`}>
                    <Button variant="outline" size="sm">
                      Manage Members
                      {(pendingMemberCount ?? 0) > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center size-5 rounded-full bg-amber-500 text-white text-xs font-medium">
                          {pendingMemberCount}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Commissioner
                  </Badge>
                </>
              )}
              {/* Super admin not yet a member - show special join button */}
              {isSuperAdmin && !poolMembership && (
                <SuperAdminJoinPoolButton
                  poolId={id}
                  orgId={pool.org_id}
                  hasOrgMembership={!!orgMembership}
                />
              )}
              {/* Regular users can request to join */}
              {!isSuperAdmin && !isMember && !isPending && !isCommissioner && <JoinPoolButton poolId={id} />}
              {isPending && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">
                  Pending Approval
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Conditional based on pool type */}
      {pool.type === 'playoff_squares' && sqPoolData && sqPoolData.mode === 'single_game' ? (
        <SingleGameSquaresContent
          pool={{
            id: pool.id,
            name: pool.name,
            status: pool.status,
            visibility: pool.visibility,
          }}
          sqPool={{
            id: sqPoolData.id,
            pool_id: sqPoolData.pool_id,
            reverse_scoring: sqPoolData.reverse_scoring,
            max_squares_per_player: sqPoolData.max_squares_per_player,
            numbers_locked: sqPoolData.numbers_locked,
            row_numbers: sqPoolData.row_numbers,
            col_numbers: sqPoolData.col_numbers,
            mode: sqPoolData.mode,
            scoring_mode: sqPoolData.scoring_mode,
            q1_payout: sqPoolData.q1_payout,
            halftime_payout: sqPoolData.halftime_payout,
            q3_payout: sqPoolData.q3_payout,
            final_payout: sqPoolData.final_payout,
            per_change_payout: sqPoolData.per_change_payout,
            final_bonus_payout: sqPoolData.final_bonus_payout,
          }}
          squares={squaresForGrid}
          game={sqGamesData[0]}
          winners={sqWinnersData}
          scoreChanges={sqScoreChangesData}
          currentUserId={user.id}
          isCommissioner={isCommissioner}
          isMember={isMember}
        />
      ) : pool.type === 'playoff_squares' && sqPoolData ? (
        <PlayoffSquaresContent
          pool={{
            id: pool.id,
            name: pool.name,
            status: pool.status,
            visibility: pool.visibility,
          }}
          sqPool={{
            id: sqPoolData.id,
            pool_id: sqPoolData.pool_id,
            reverse_scoring: sqPoolData.reverse_scoring,
            max_squares_per_player: sqPoolData.max_squares_per_player,
            numbers_locked: sqPoolData.numbers_locked,
            row_numbers: sqPoolData.row_numbers,
            col_numbers: sqPoolData.col_numbers,
          }}
          squares={squaresForGrid}
          games={sqGamesData}
          winners={sqWinnersData}
          currentUserId={user.id}
          isCommissioner={isCommissioner}
          isMember={isMember}
        />
      ) : pool.type === 'playoff_squares' && !sqPoolData ? (
        <Card>
          <CardContent className="py-8 text-center">
            <h2 className="text-lg font-semibold text-foreground mb-2">Pool Not Configured</h2>
            <p className="text-muted-foreground">
              This Playoff Squares pool hasn&apos;t been set up yet.
            </p>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Games/Picks */}
        <div className="lg:col-span-2 space-y-6">
          {pool.status === 'draft' && isCommissioner ? (
            <Card>
              <CardHeader>
                <CardTitle>Pool Setup</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  This pool is in draft mode. Add games and configure settings before activating.
                </p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pools/${id}/games`}>
                      Manage Bowl Games
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pools/${id}/cfp`}>
                      Manage CFP Bracket
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pools/${id}/settings`}>
                      Pool Settings
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : pool.status === 'draft' ? (
            <Card>
              <CardContent className="py-8 text-center">
                <h2 className="text-lg font-semibold text-foreground mb-2">Pool Not Active</h2>
                <p className="text-muted-foreground">
                  This pool is still being set up. Check back soon!
                </p>
              </CardContent>
            </Card>
          ) : isMember || isCommissioner ? (
            <Card>
              <CardHeader>
                <CardTitle>Bowl Picks</CardTitle>
              </CardHeader>
              <CardContent>
                {gamesCount === 0 ? (
                  <p className="text-muted-foreground">No games have been added to this pool yet.</p>
                ) : entry ? (
                  <div>
                    <p className="text-muted-foreground mb-4">Make your picks for each bowl game.</p>
                    <Button asChild>
                      <Link href={`/pools/${id}/picks`}>
                        View/Edit Picks
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div>
                    <p className="text-muted-foreground mb-4">Create an entry to start making picks.</p>
                    <CreateEntryButton poolId={id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <h2 className="text-lg font-semibold text-foreground mb-2">Join to View Picks</h2>
                <p className="text-muted-foreground mb-4">
                  You need to be a member of this pool to view and make picks.
                </p>
                <JoinPoolButton poolId={id} />
              </CardContent>
            </Card>
          )}

          {/* Standings */}
          {(isMember || isCommissioner) && (pool.status === 'open' || pool.status === 'completed') && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {pool.status === 'completed' ? 'Final Standings' : 'Standings'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PoolStandings
                  standings={standings}
                  currentUserId={profile?.display_name ?? user.email ?? undefined}
                  isCompleted={pool.status === 'completed'}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Pool Info */}
        <div className="space-y-6">
          {isCommissioner && (
            <PoolSettings
              pool={pool}
              allGamesFinal={allGamesFinal}
              finalGamesCount={finalGamesCount}
              totalGamesCount={totalGamesCount}
            />
          )}

          {/* Commissioner Tools - shown when pool is open */}
          {isCommissioner && pool.status === 'open' && (
            <Card>
              <CardHeader>
                <CardTitle>Commissioner Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/pools/${id}/games`}>
                    Manage Games & Scores
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/pools/${id}/cfp`}>
                    Manage CFP Bracket
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Members */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Members</CardTitle>
              {isCommissioner && (
                <Link
                  href={`/pools/${id}/members`}
                  className="text-sm text-primary hover:text-primary/80 flex items-center gap-2"
                >
                  Manage
                  {(pendingMemberCount ?? 0) > 0 && (
                    <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">
                      {pendingMemberCount} pending
                    </Badge>
                  )}
                </Link>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{memberCount} approved member{memberCount !== 1 ? 's' : ''}</p>
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  )
}
