/**
 * @fileoverview March Madness full bracket view page
 * @route /pools/[id]/march-madness/bracket
 * @auth Pool member or commissioner
 * @layout Dashboard layout
 *
 * @description
 * Full tournament bracket visualization for March Madness pools.
 * Shows all 63 games across 6 rounds in traditional bracket format.
 * Available to all pool members after the draw is completed.
 *
 * @features
 * - Traditional bracket layout (4 regions → Final Four → Championship)
 * - Team seeds and names displayed
 * - Game scores for completed games
 * - Winner highlighting
 * - Current user's team highlighted
 * - Responsive design for mobile viewing
 *
 * @components
 * - BracketView: Full bracket visualization component
 *
 * @data_fetching
 * - mm_pools: Draw status (bracket hidden until draw complete)
 * - mm_games: All games with scores and matchups
 * - mm_entries: Entry data for user highlighting
 * - mm_pool_teams: Teams with names and seeds
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { BracketView } from '@/components/march-madness'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * March Madness bracket page - Server Component
 * Displays the full tournament bracket after draw completion.
 */
export default async function MarchMadnessBracketPage({ params }: PageProps) {
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
  const { data: poolMembership } = await supabase
    .from('pool_memberships')
    .select('id, status, role')
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
  const isMember = poolMembership?.status === 'approved'

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

  // Get entries
  const { data: entries } = await supabase
    .from('mm_entries')
    .select('*')
    .eq('mm_pool_id', mmPool.id)

  // Get pool teams
  const { data: poolTeams } = await supabase
    .from('mm_pool_teams')
    .select('*, bb_teams (id, name, abbrev)')
    .eq('mm_pool_id', mmPool.id)

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
          <li>
            <Link href={`/pools/${id}/march-madness`} className="hover:text-foreground transition-colors">
              March Madness
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground font-medium">Bracket</li>
        </ol>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tournament Bracket</h1>
        <p className="text-muted-foreground">
          Full bracket view for March Madness {mmPool.tournament_year}
        </p>
      </div>

      {!mmPool.draw_completed ? (
        <Card>
          <CardContent className="py-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Bracket Not Available</h3>
            <p className="text-muted-foreground">
              The bracket will be available after the random team draw is completed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <BracketView
          games={games ?? []}
          entries={entries ?? []}
          poolTeams={poolTeams ?? []}
          currentUserId={user.id}
        />
      )}
    </div>
  )
}
