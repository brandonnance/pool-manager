/**
 * @fileoverview March Madness pool main page
 * @route /pools/[id]/march-madness
 * @auth Pool member or commissioner
 * @layout Dashboard layout
 *
 * @description
 * Main hub for a March Madness blind draw pool. Shows standings, current
 * tournament state, and navigation to commissioner tools. Entry point for
 * participants to view their assigned team and tournament progress.
 *
 * @features
 * - Tournament standings (entries sorted by team progress/payout)
 * - Current round status and live games indicator
 * - User's assigned team highlighted
 * - Commissioner links to setup/entries/games management
 * - Bracket visualization link
 *
 * @components
 * - MarchMadnessContent: Main content component with standings and navigation
 *
 * @data_fetching
 * - pools: Pool details for breadcrumb
 * - mm_pools: March Madness config (tournament_year, draw_completed, etc.)
 * - mm_entries: All entries with display names and team assignments
 * - mm_pool_teams: Teams with seeds, regions, and elimination status
 * - mm_games: All games with scores and status
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarchMadnessContent } from '@/components/march-madness'
import { getPoolPermissions } from '@/lib/permissions'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * March Madness main page - Server Component
 * Displays tournament standings and provides navigation to management pages.
 */
export default async function MarchMadnessPage({ params }: PageProps) {
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

  // Check membership
  const {
    isSuperAdmin,
    isPoolCommissioner,
    isMember,
  } = await getPoolPermissions(supabase, user.id, id, pool.org_id)

  if (!isMember && !isPoolCommissioner) {
    redirect(`/pools/${id}`)
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

  // Get entries with display names
  const { data: entries } = await supabase
    .from('mm_entries')
    .select('*')
    .eq('mm_pool_id', mmPool.id)

  // Get pool teams
  const { data: poolTeams } = await supabase
    .from('mm_pool_teams')
    .select('*, bb_teams (id, name, abbrev)')
    .eq('mm_pool_id', mmPool.id)
    .order('region')
    .order('seed')

  // Get games
  const { data: games } = await supabase
    .from('mm_games')
    .select('*')
    .eq('mm_pool_id', mmPool.id)
    .order('round')
    .order('game_number')

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
          <li className="text-foreground font-medium">March Madness</li>
        </ol>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">March Madness {mmPool.tournament_year}</h1>
        <p className="text-muted-foreground">64-player blind draw tournament</p>
      </div>

      <MarchMadnessContent
        mmPool={mmPool}
        poolId={pool.id}
        entries={entries ?? []}
        poolTeams={poolTeams ?? []}
        games={games ?? []}
        currentUserId={user.id}
        isCommissioner={isPoolCommissioner}
      />
    </div>
  )
}
