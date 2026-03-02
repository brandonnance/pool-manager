/**
 * @fileoverview Pool Detail Page - Main hub for all pool types
 * @route /pools/[id]
 * @auth Requires authentication; membership varies by pool visibility
 * @layout Dashboard layout with header/nav
 *
 * @description
 * Central page for viewing and managing any pool type. Dynamically renders
 * content based on pool type (squares, march_madness, golf).
 *
 * @pool_types
 * - squares: Football squares (single_game or playoffs mode)
 * - march_madness: 64-player blind draw tournament
 * - golf: Golf pool with tier-based picks
 *
 * @permissions
 * - Super Admin: Full access to all pools
 * - Org Admin: Implicit commissioner on all org pools
 * - Pool Commissioner: Manage pool settings, members
 * - Member: View content, make picks
 * - Pending: Limited view, awaiting approval
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { JoinPoolButton } from '@/components/pools/join-pool-button'
import { SuperAdminJoinPoolButton } from '@/components/pools/super-admin-join-pool-button'
import { SingleGameContent } from '@/components/squares/single-game-content'
import { PlayoffContent } from '@/components/squares/playoff-content'
import { MmPublicUrlCard } from '@/components/march-madness/mm-public-url-card'
import { GolfStandingsWrapper } from '@/components/golf/golf-standings-wrapper'
import { getPoolPermissions } from '@/lib/permissions'
import { getPoolBaseData } from '@/lib/data/pool'
import { getSquaresData } from '@/lib/data/squares'
import { getMarchMadnessData } from '@/lib/data/march-madness'
import { getGolfData } from '@/lib/data/golf'
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

  // Get base pool data (pool record, member counts, game counts)
  const baseData = await getPoolBaseData(supabase, id, user.id)
  if (!baseData) {
    notFound()
  }

  const { pool, memberCount, pendingMemberCount } = baseData

  // Get user permissions for this pool (runs 3 queries in parallel)
  const {
    profile,
    orgMembership,
    poolMembership,
    isSuperAdmin,
    isOrgAdmin,
    isPoolCommissioner,
    isMember,
    isPending,
  } = await getPoolPermissions(supabase, user.id, id, pool.org_id)

  const isCommissioner = isPoolCommissioner

  // Fetch type-specific data based on pool type
  const squaresResult = pool.type === 'squares'
    ? await getSquaresData(supabase, id) : null
  const mmResult = pool.type === 'march_madness'
    ? await getMarchMadnessData(supabase, id) : null
  const golfResult = pool.type === 'golf'
    ? await getGolfData(supabase, id, pool.status) : null
  // Destructure type-specific results
  const sqPoolData = squaresResult?.sqPoolData ?? null
  const sqGamesData = squaresResult?.sqGamesData ?? []
  const sqWinnersData = squaresResult?.sqWinnersData ?? []
  const sqScoreChangesData = squaresResult?.sqScoreChangesData ?? []
  const publicSquares = squaresResult?.publicSquares ?? []

  const mmPoolData = mmResult?.mmPoolData ?? null
  const mmEntriesData = mmResult?.mmEntriesData ?? []
  const mmPoolTeamsData = mmResult?.mmPoolTeamsData ?? []
  const mmGamesData = mmResult?.mmGamesData ?? []

  const gpPoolData = golfResult?.gpPoolData ?? null
  const gpTournamentData = golfResult?.gpTournamentData ?? null
  // Update pool status if golf lazy sync changed it
  if (golfResult?.statusUpdated) {
    pool.status = golfResult.computedStatus
  }

  return (
    <div>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/orgs">Organizations</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/orgs/${pool.org_id}`}>{pool.organizations?.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{pool.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

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
                  {pool.type === 'squares' ? 'Squares' : pool.type === 'march_madness' ? 'March Madness Blind Draw' : pool.type === 'golf' ? 'Golf Pool' : pool.type}
                  {pool.season_label && ` - ${pool.season_label}`}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
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
      {pool.type === 'squares' && sqPoolData && sqPoolData.mode === 'single_game' ? (
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
          squares={publicSquares}
          games={sqGamesData}
          winners={sqWinnersData}
          scoreChanges={sqScoreChangesData}
          isCommissioner={isCommissioner}
          isSuperAdmin={isSuperAdmin}
        />
      ) : pool.type === 'squares' && sqPoolData ? (
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
          eventType={sqPoolData.event_type ?? 'nfl_playoffs'}
          poolStatus={pool.status}
          squares={publicSquares}
          games={sqGamesData}
          winners={sqWinnersData}
          isCommissioner={isCommissioner}
          isSuperAdmin={isSuperAdmin}
        />
      ) : pool.type === 'squares' && !sqPoolData ? (
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
        <Card>
          <CardContent className="py-8 text-center">
            <h2 className="text-lg font-semibold text-foreground mb-2">Pool Type Not Available</h2>
            <p className="text-muted-foreground">
              This pool type is no longer supported.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
