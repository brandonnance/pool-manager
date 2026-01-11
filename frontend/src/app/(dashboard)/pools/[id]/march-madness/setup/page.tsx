/**
 * @fileoverview March Madness tournament team setup page
 * @route /pools/[id]/march-madness/setup
 * @auth Commissioner only
 * @layout Dashboard layout
 *
 * @description
 * Commissioner page for setting up the 64 tournament teams.
 * Teams are organized by region (East, West, South, Midwest) and seeded 1-16.
 * Must be completed before the blind draw can be run.
 *
 * @features
 * - Team selector for each region (seeds 1-16)
 * - Progress indicator (X/64 teams added)
 * - Team search from bb_teams master list
 * - Demo seed button for testing (fills all 64 teams)
 * - Warning when draw already completed
 *
 * @components
 * - TeamSelector: Region-by-region team selection UI
 * - DemoSeedButton: Quick-fill with demo teams for testing
 *
 * @data_fetching
 * - pools: Pool details for breadcrumb/validation
 * - mm_pools: Draw status to show warning if completed
 * - mm_pool_teams: Existing team assignments with bb_teams join
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TeamSelector, DemoSeedButton } from '@/components/march-madness'

interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * March Madness team setup page - Server Component
 * Commissioner-only page for configuring the 64 tournament teams.
 */
export default async function MarchMadnessSetupPage({ params }: PageProps) {
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

  // Get existing pool teams
  const { data: poolTeams } = await supabase
    .from('mm_pool_teams')
    .select('*, bb_teams (id, name, abbrev)')
    .eq('mm_pool_id', mmPool.id)
    .order('region')
    .order('seed')

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
          <li className="text-foreground font-medium">Setup</li>
        </ol>
      </nav>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tournament Setup</h1>
          <p className="text-muted-foreground">
            Add the 64 tournament teams with their seeds and regions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={poolTeams && poolTeams.length === 64 ? 'default' : 'secondary'} className="text-lg px-3 py-1">
            {poolTeams?.length ?? 0} / 64 Teams
          </Badge>
          {(!poolTeams || poolTeams.length === 0) && !mmPool.draw_completed && (
            <DemoSeedButton mmPoolId={mmPool.id} variant="teams" />
          )}
        </div>
      </div>

      {mmPool.draw_completed && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="py-4">
            <p className="text-amber-800">
              <strong>Note:</strong> The team draw has been completed. Editing teams
              will not affect existing assignments.
            </p>
          </CardContent>
        </Card>
      )}

      <TeamSelector
        mmPoolId={mmPool.id}
        existingTeams={poolTeams ?? []}
      />
    </div>
  )
}
