/**
 * @fileoverview Pool Detail Page - Main hub for all pool types
 * @route /pools/[id]
 * @auth Requires authentication; membership varies by pool visibility
 * @layout Dashboard layout with header/nav
 *
 * @description
 * Central page for viewing and managing any pool type. Dynamically renders
 * content based on pool type (bowl_buster, playoff_squares, march_madness, etc.).
 * Handles membership status, commissioner tools, and type-specific features.
 *
 * @pool_types
 * - bowl_buster: Bowl picks with margin-of-victory scoring
 * - playoff_squares: Football squares (single_game or playoffs mode)
 * - march_madness: 64-player blind draw tournament
 *
 * @features
 * - Pool header with status, member count, commissioner badge
 * - Join/request membership buttons
 * - Type-specific content rendering
 * - Standings display (for bowl_buster)
 * - Commissioner tools sidebar
 * - Pool settings management
 *
 * @permissions
 * - Super Admin: Full access to all pools
 * - Org Admin: Implicit commissioner on all org pools
 * - Pool Commissioner: Manage pool settings, games, members
 * - Member: View content, make picks
 * - Pending: Limited view, awaiting approval
 *
 * @components
 * - PoolSettings: Activate/complete pool controls
 * - SingleGameContent: Squares for single game mode
 * - PlayoffContent: Squares for playoff mode
 * - PoolStandings: Bowl buster standings table
 * - MmPublicUrlCard: March Madness public URL management
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PoolSettings } from '@/components/pools/pool-settings'
import { JoinPoolButton } from '@/components/pools/join-pool-button'
import { SuperAdminJoinPoolButton } from '@/components/pools/super-admin-join-pool-button'
import { CreateEntryButton } from '@/components/pools/create-entry-button'
import { PoolStandings } from '@/components/standings/pool-standings'
import { SingleGameContent } from '@/components/squares/single-game-content'
import { PlayoffContent } from '@/components/squares/playoff-content'
import { MmPublicUrlCard } from '@/components/march-madness/mm-public-url-card'
import { GolfStandingsWrapper } from '@/components/golf/golf-standings-wrapper'
import { GpPublicUrlDisplay } from '@/components/golf/gp-public-url-display'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/** Page props with dynamic route parameters */
interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Pool detail page component (Server Component)
 *
 * @param props.params - Contains the pool id from the URL
 * @returns Dynamic pool page based on pool type
 *
 * @data_fetching
 * - pools: Pool details with org info
 * - pool_memberships: User's membership and role
 * - org_memberships: Org-level permissions
 * - profiles: Super admin status
 * - Type-specific data (sq_pools, mm_pools, bb_entries, etc.)
 */
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
    participant_name: string | null
    verified: boolean | null
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
    espn_game_id: string | null
    current_period: number | null
    current_clock: string | null
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
  const sqOwnerProfiles = new Map<string, string | null>()

  if (pool.type === 'playoff_squares') {
    // Get sq_pool config
    const { data: sqPool } = await supabase
      .from('sq_pools')
      .select('*')
      .eq('pool_id', id)
      .single()
    sqPoolData = sqPool

    if (sqPool) {
      // Get all squares (including no-account fields)
      const { data: squares } = await supabase
        .from('sq_squares')
        .select('id, row_index, col_index, user_id, participant_name, verified')
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

  // ============================================
  // MARCH MADNESS DATA FETCHING
  // ============================================
  let mmPoolData: {
    id: string
    pool_id: string
    tournament_year: number
    draw_completed: boolean
    draw_completed_at: string | null
    sweet16_payout_pct: number
    elite8_payout_pct: number
    final4_payout_pct: number
    runnerup_payout_pct: number
    champion_payout_pct: number
    push_rule: string
    auto_sync_enabled: boolean
    public_slug: string | null
  } | null = null
  let mmEntriesData: Array<{
    id: string
    mm_pool_id: string
    user_id: string | null
    current_team_id: string | null
    original_team_id: string | null
    eliminated: boolean
    eliminated_round: string | null
    display_name: string | null
    total_payout: number
  }> = []
  let mmPoolTeamsData: Array<{
    id: string
    mm_pool_id: string
    team_id: string
    seed: number
    region: string
    eliminated: boolean
    eliminated_round: string | null
    bb_teams: { id: string; name: string; abbrev: string | null } | null
  }> = []
  let mmGamesData: Array<{
    id: string
    mm_pool_id: string
    round: string
    region: string | null
    game_number: number | null
    higher_seed_team_id: string | null
    lower_seed_team_id: string | null
    spread: number | null
    higher_seed_score: number | null
    lower_seed_score: number | null
    status: string
    winning_team_id: string | null
    spread_covering_team_id: string | null
    higher_seed_entry_id: string | null
    lower_seed_entry_id: string | null
    advancing_entry_id: string | null
    scheduled_time: string | null
  }> = []

  if (pool.type === 'march_madness') {
    // Get mm_pool config
    const { data: mmPool } = await supabase
      .from('mm_pools')
      .select('*')
      .eq('pool_id', id)
      .single()
    mmPoolData = mmPool

    if (mmPool) {
      // Get all entries with user profiles
      const { data: entries } = await supabase
        .from('mm_entries')
        .select('*')
        .eq('mm_pool_id', mmPool.id)
      mmEntriesData = entries ?? []

      // Get all pool teams with team names
      const { data: poolTeams } = await supabase
        .from('mm_pool_teams')
        .select('*, bb_teams (id, name, abbrev)')
        .eq('mm_pool_id', mmPool.id)
        .order('region')
        .order('seed')
      mmPoolTeamsData = poolTeams ?? []

      // Get all games
      const { data: games } = await supabase
        .from('mm_games')
        .select('*')
        .eq('mm_pool_id', mmPool.id)
        .order('round')
        .order('game_number')
      mmGamesData = games ?? []
    }
  }

  // ============================================
  // GOLF POOL DATA FETCHING
  // ============================================
  let gpPoolData: {
    id: string
    pool_id: string
    tournament_id: string | null
    min_tier_points: number | null
    picks_lock_at: string | null
    demo_mode: boolean | null
    public_entries_enabled: boolean | null
    public_slug: string | null
    created_at: string | null
  } | null = null
  let gpTournamentData: {
    id: string
    name: string
    start_date: string
    end_date: string
    status: string | null
  } | null = null

  if (pool.type === 'golf') {
    // Get gp_pool config
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('*')
      .eq('pool_id', id)
      .single()
    gpPoolData = gpPool

    // Get tournament if linked
    if (gpPool?.tournament_id) {
      const { data: tournament } = await supabase
        .from('gp_tournaments')
        .select('id, name, start_date, end_date, status')
        .eq('id', gpPool.tournament_id)
        .single()
      gpTournamentData = tournament
    }

    // Lazy status sync: Check if golf pool status should be updated
    if (gpPool) {
      const computedStatus = computeGolfPoolStatus(
        gpPool.public_entries_enabled ?? false,
        gpPool.picks_lock_at,
        gpTournamentData?.status as 'upcoming' | 'in_progress' | 'completed' | null,
        gpPool.tournament_id
      )

      // Update pools.status if it's different
      if (computedStatus !== pool.status) {
        await supabase
          .from('pools')
          .update({ status: computedStatus })
          .eq('id', id)
        // Update local pool object so display is correct
        pool.status = computedStatus
      }
    }
  }

  // Helper function to compute golf pool status
  function computeGolfPoolStatus(
    publicEntriesEnabled: boolean,
    picksLockAt: string | null,
    tournamentStatus: string | null,
    tournamentId: string | null
  ): 'draft' | 'open' | 'locked' | 'completed' {
    if (!tournamentId) return 'draft'
    if (tournamentStatus === 'completed') return 'completed'
    const now = new Date()
    const lockTime = picksLockAt ? new Date(picksLockAt) : null
    if (lockTime && now >= lockTime) return 'locked'
    if (publicEntriesEnabled) return 'open'
    return 'draft'
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

  // Transform squares data for no-account mode
  const noAccountSquares = sqSquaresData.map((sq) => ({
    id: sq.id,
    row_index: sq.row_index,
    col_index: sq.col_index,
    participant_name: sq.participant_name,
    verified: sq.verified ?? false,
  }))

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
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            {/* Top section - pool info and role badge */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">{pool.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge
                    variant={
                      pool.status === 'open' ? 'default' :
                      pool.status === 'locked' ? 'default' :
                      pool.status === 'completed' ? 'secondary' :
                      'outline'
                    }
                    className={
                      pool.status === 'open' ? 'bg-green-600' :
                      pool.status === 'locked' ? 'bg-blue-600' :
                      pool.status === 'draft' ? 'border-amber-500 text-amber-600' :
                      ''
                    }
                  >
                    {pool.status === 'locked' ? 'In Progress' :
                     pool.status === 'completed' ? 'Completed' :
                     pool.status === 'open' ? 'Accepting Entries' :
                     pool.status === 'draft' ? 'Draft' :
                     pool.status}
                  </Badge>
                  {isCommissioner && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary shrink-0">
                      Commissioner
                    </Badge>
                  )}
                  {isPending && (
                    <Badge variant="outline" className="border-amber-500 text-amber-600 shrink-0">
                      Pending Approval
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-2">
                  {pool.type === 'bowl_buster' ? 'Bowl Buster' : pool.type === 'playoff_squares' || pool.type === 'single_game_squares' ? 'Squares' : pool.type === 'march_madness' ? 'March Madness Blind Draw' : pool.type === 'golf' ? 'Golf Pool' : pool.type}
                  {pool.season_label && ` - ${pool.season_label}`}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                  {pool.type === 'bowl_buster' && <> &middot; {gamesCount ?? 0} game{(gamesCount ?? 0) !== 1 ? 's' : ''}</>}
                </p>
              </div>

              {/* Action buttons - right side on desktop, below on mobile */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isCommissioner && (
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
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Conditional based on pool type */}
      {/* Squares - Single Game Mode */}
      {pool.type === 'playoff_squares' && sqPoolData && sqPoolData.mode === 'single_game' ? (
        <SingleGameContent
          sqPoolId={sqPoolData.id}
          poolId={pool.id}
          publicSlug={sqPoolData.public_slug}
          numbersLocked={sqPoolData.numbers_locked ?? false}
          reverseScoring={sqPoolData.reverse_scoring ?? false}
          rowNumbers={sqPoolData.row_numbers}
          colNumbers={sqPoolData.col_numbers}
          mode={sqPoolData.mode}
          scoringMode={sqPoolData.scoring_mode}
          poolStatus={pool.status}
          squares={noAccountSquares}
          games={sqGamesData}
          winners={sqWinnersData}
          scoreChanges={sqScoreChangesData}
          isCommissioner={isCommissioner}
          isSuperAdmin={isSuperAdmin}
        />
      ) : pool.type === 'playoff_squares' && sqPoolData ? (
        /* Squares - Full Playoffs Mode */
        <PlayoffContent
          sqPoolId={sqPoolData.id}
          poolId={pool.id}
          publicSlug={sqPoolData.public_slug}
          numbersLocked={sqPoolData.numbers_locked ?? false}
          reverseScoring={sqPoolData.reverse_scoring ?? false}
          rowNumbers={sqPoolData.row_numbers}
          colNumbers={sqPoolData.col_numbers}
          mode={sqPoolData.mode}
          poolStatus={pool.status}
          squares={noAccountSquares}
          games={sqGamesData}
          winners={sqWinnersData}
          isCommissioner={isCommissioner}
          isSuperAdmin={isSuperAdmin}
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
      ) : pool.type === 'march_madness' && mmPoolData ? (
        /* March Madness Blind Draw Content */
        <div className="space-y-6">
        {/* Full-width Public URL Card for Commissioners */}
        {isCommissioner && (
          <MmPublicUrlCard
            mmPoolId={mmPoolData.id}
            publicSlug={mmPoolData.public_slug ?? null}
          />
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tournament Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>March Madness Blind Draw {mmPoolData.tournament_year}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Entry Status */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Entries</p>
                      <p className="text-2xl font-bold">{mmEntriesData.length} / 64</p>
                    </div>
                    <Badge variant={mmEntriesData.length === 64 ? 'default' : 'outline'}>
                      {mmEntriesData.length === 64 ? 'Full' : 'Open'}
                    </Badge>
                  </div>

                  {/* Draw Status */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Team Draw</p>
                      <p className="text-sm text-muted-foreground">
                        {mmPoolData.draw_completed
                          ? `Completed ${mmPoolData.draw_completed_at ? new Date(mmPoolData.draw_completed_at).toLocaleDateString() : ''}`
                          : 'Not yet drawn'}
                      </p>
                    </div>
                    <Badge variant={mmPoolData.draw_completed ? 'default' : 'secondary'}>
                      {mmPoolData.draw_completed ? 'Drawn' : 'Pending'}
                    </Badge>
                  </div>

                  {/* Teams Loaded Status */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Teams Loaded</p>
                      <p className="text-sm text-muted-foreground">
                        {mmPoolTeamsData.length} of 64 teams
                      </p>
                    </div>
                    <Badge variant={mmPoolTeamsData.length === 64 ? 'default' : 'secondary'}>
                      {mmPoolTeamsData.length === 64 ? 'Ready' : 'Incomplete'}
                    </Badge>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 space-y-2">
                    <Button className="w-full" asChild>
                      <Link href={`/pools/${id}/march-madness`}>
                        View Bracket & Standings
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            {mmPoolData.draw_completed && (
              <Card>
                <CardHeader>
                  <CardTitle>Tournament Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">
                        {mmEntriesData.filter(e => !e.eliminated).length}
                      </p>
                      <p className="text-sm text-muted-foreground">Players Remaining</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">
                        {mmGamesData.filter(g => g.status === 'final').length}
                      </p>
                      <p className="text-sm text-muted-foreground">Games Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Pool Info & Commissioner Tools */}
          <div className="space-y-6">
            {/* Commissioner Tools */}
            {isCommissioner && (
              <Card>
                <CardHeader>
                  <CardTitle>Commissioner Tools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pools/${id}/march-madness/setup`}>
                      Setup Teams
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pools/${id}/march-madness/entries`}>
                      Manage Entries
                    </Link>
                  </Button>
                  {mmPoolData.draw_completed && (
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/pools/${id}/march-madness/games`}>
                        Enter Scores
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Pool Rules */}
            <Card>
              <CardHeader>
                <CardTitle>Pool Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">Advancement:</strong> Based on covering the spread, not just winning</p>
                  <p><strong className="text-foreground">Team Inheritance:</strong> Advancing player takes the winning team</p>
                  <p><strong className="text-foreground">Push Rule:</strong> {mmPoolData.push_rule === 'higher_seed_advances' ? 'Higher seed advances on push' : mmPoolData.push_rule === 'favorite_advances' ? 'Favorite advances on push' : mmPoolData.push_rule === 'underdog_advances' ? 'Underdog advances on push' : 'Coin flip on push'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      ) : pool.type === 'march_madness' && !mmPoolData ? (
        <Card>
          <CardContent className="py-8 text-center">
            <h2 className="text-lg font-semibold text-foreground mb-2">Pool Not Configured</h2>
            <p className="text-muted-foreground">
              This March Madness pool hasn&apos;t been set up yet.
            </p>
          </CardContent>
        </Card>
      ) : pool.type === 'golf' ? (
        /* Golf Pool */
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Tournament Info / Setup */}
            {gpPoolData && !gpPoolData.tournament_id && isCommissioner ? (
              <Card>
                <CardHeader>
                  <CardTitle>Tournament Setup</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Select a tournament and configure tiers to get started.
                  </p>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/pools/${id}/golf/setup`}>
                        Tournament Setup
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={`/pools/${id}/golf/tiers`}>
                        Configure Tiers
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : gpPoolData && !gpPoolData.tournament_id ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <h2 className="text-lg font-semibold text-foreground mb-2">Pool Not Active</h2>
                  <p className="text-muted-foreground">
                    This pool is still being set up. Check back soon!
                  </p>
                </CardContent>
              </Card>
            ) : gpPoolData && gpTournamentData ? (
              <Card>
                <CardHeader>
                  <CardTitle>{gpTournamentData.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant={
                      gpTournamentData.status === 'in_progress' ? 'default' :
                      gpTournamentData.status === 'completed' ? 'secondary' :
                      'outline'
                    }>
                      {gpTournamentData.status === 'in_progress' ? 'In Progress' :
                       gpTournamentData.status === 'completed' ? 'Completed' : 'Upcoming'}
                    </Badge>
                    {gpPoolData.demo_mode && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
                        Demo Mode
                      </Badge>
                    )}
                  </div>
                  {gpTournamentData.start_date && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {new Date(gpTournamentData.start_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                      {gpTournamentData.end_date && ` - ${new Date(gpTournamentData.end_date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}`}
                    </p>
                  )}
                  <p className="text-muted-foreground mb-4">
                    Pick 6 golfers with at least {gpPoolData.min_tier_points} tier points. Best 4 of 6 scores count.
                  </p>
                  {(isMember || isCommissioner) && (
                    <Button asChild>
                      <Link href={`/pools/${id}/golf/picks`}>
                        Make Picks
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <h2 className="text-lg font-semibold text-foreground mb-2">Pool Not Configured</h2>
                  <p className="text-muted-foreground">
                    This Golf pool hasn&apos;t been set up yet.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Golf Standings */}
            {gpPoolData && gpTournamentData && (isMember || isCommissioner) && (
              <GolfStandingsWrapper
                poolId={id}
                currentUserId={user.id}
                tournamentStatus={
                  gpTournamentData.status === 'in_progress' ? 'in_progress' :
                  gpTournamentData.status === 'completed' ? 'completed' : 'upcoming'
                }
              />
            )}
          </div>

          {/* Right Column - Pool Info */}
          <div className="space-y-6">
            {/* Commissioner Tools */}
            {isCommissioner && gpPoolData && (
              <Card>
                <CardHeader>
                  <CardTitle>Commissioner Tools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pools/${id}/golf/setup`}>
                      Tournament Setup
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pools/${id}/golf/tiers`}>
                      Configure Tiers
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pools/${id}/golf/entries`}>
                      Manage Entries
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pools/${id}/golf/scores`}>
                      Enter Scores
                    </Link>
                  </Button>

                  {/* Public URL - shown when public entries are live */}
                  {gpPoolData.public_entries_enabled && gpPoolData.public_slug && (
                    <GpPublicUrlDisplay publicSlug={gpPoolData.public_slug} />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
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
