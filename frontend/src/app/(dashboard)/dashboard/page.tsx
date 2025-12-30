import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get user's organizations (via org_memberships)
  const { data: orgMemberships } = await supabase
    .from('org_memberships')
    .select(`
      role,
      org_id,
      organizations (
        id,
        name
      )
    `)
    .eq('user_id', user!.id)

  // Get user's pool memberships with org info
  const { data: poolMemberships } = await supabase
    .from('pool_memberships')
    .select(`
      status,
      pool_id,
      pools (
        id,
        name,
        status,
        season_label,
        visibility,
        org_id,
        organizations (
          id,
          name
        )
      )
    `)
    .eq('user_id', user!.id)

  // Get discoverable pools in user's orgs that they haven't joined
  const userOrgIds = orgMemberships?.map(m => m.org_id) || []
  const userPoolIds = poolMemberships?.map(pm => pm.pool_id) || []

  const { data: discoverablePools } = userOrgIds.length > 0
    ? await supabase
        .from('pools')
        .select(`
          id,
          name,
          status,
          season_label,
          visibility,
          org_id,
          organizations (
            id,
            name
          )
        `)
        .in('org_id', userOrgIds)
        .eq('visibility', 'open_to_org')
        .in('status', ['open', 'draft'])
        .not('id', 'in', userPoolIds.length > 0 ? `(${userPoolIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)')
    : { data: [] }

  // Build orgs map with role info
  const orgsMap = new Map<string, { id: string; name: string; role: string }>()
  orgMemberships?.forEach(m => {
    if (m.organizations) {
      orgsMap.set(m.org_id, {
        id: m.organizations.id,
        name: m.organizations.name,
        role: m.role
      })
    }
  })

  // Group pools by org
  interface PoolInfo {
    id: string
    name: string
    status: string
    season_label: string | null
    membership_status: 'approved' | 'pending' | 'discoverable'
  }

  interface OrgWithPools {
    id: string
    name: string
    role: string
    pools: PoolInfo[]
  }

  const orgPoolsMap = new Map<string, OrgWithPools>()

  // Initialize with all orgs user belongs to
  orgsMap.forEach((org, orgId) => {
    orgPoolsMap.set(orgId, {
      id: org.id,
      name: org.name,
      role: org.role,
      pools: []
    })
  })

  // Add user's joined pools
  poolMemberships?.forEach(pm => {
    if (pm.pools && pm.pools.org_id) {
      const orgId = pm.pools.org_id
      let orgData = orgPoolsMap.get(orgId)

      // If user has a pool in an org they're not explicitly a member of, add the org
      if (!orgData && pm.pools.organizations) {
        orgData = {
          id: pm.pools.organizations.id,
          name: pm.pools.organizations.name,
          role: 'member',
          pools: []
        }
        orgPoolsMap.set(orgId, orgData)
      }

      if (orgData) {
        orgData.pools.push({
          id: pm.pools.id,
          name: pm.pools.name,
          status: pm.pools.status,
          season_label: pm.pools.season_label,
          membership_status: pm.status as 'approved' | 'pending'
        })
      }
    }
  })

  // Add discoverable pools
  discoverablePools?.forEach(pool => {
    const orgData = orgPoolsMap.get(pool.org_id)
    if (orgData) {
      // Check if not already in the list
      const exists = orgData.pools.some(p => p.id === pool.id)
      if (!exists) {
        orgData.pools.push({
          id: pool.id,
          name: pool.name,
          status: pool.status,
          season_label: pool.season_label,
          membership_status: 'discoverable'
        })
      }
    }
  })

  // Convert to array and sort
  const orgsWithPools = Array.from(orgPoolsMap.values())
    .sort((a, b) => a.name.localeCompare(b.name))

  // Calculate stats
  const totalPools = poolMemberships?.filter(pm => pm.status === 'approved').length || 0
  const activePools = poolMemberships?.filter(pm => pm.status === 'approved' && pm.pools?.status === 'open').length || 0
  const discoverableCount = discoverablePools?.length || 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back! Here&apos;s an overview of your pools.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Organizations</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{orgsWithPools.length}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-accent">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Active Pools</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{activePools}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground">Total Pools</div>
            <div className="mt-2 text-3xl font-bold text-foreground">{totalPools}</div>
            {discoverableCount > 0 && (
              <div className="mt-1 text-sm text-primary font-medium">
                +{discoverableCount} available to join
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pools grouped by Organization */}
      {orgsWithPools.length === 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Pools</CardTitle>
            <Button asChild>
              <Link href="/orgs/new">Create Organization</Link>
            </Button>
          </CardHeader>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>You&apos;re not a member of any organizations yet.</p>
            <p className="mt-1 text-sm">Create one to get started, or join a pool using an invite link!</p>
          </CardContent>
        </Card>
      ) : (
        orgsWithPools.map((org) => (
          <Card key={org.id} className="overflow-hidden">
            <CardHeader className="bg-muted/50 flex flex-row items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Link href={`/orgs/${org.id}`} className="text-lg font-semibold text-foreground hover:text-primary transition-colors">
                  {org.name}
                </Link>
                <Badge variant={org.role === 'commissioner' ? 'default' : 'secondary'}>
                  {org.role}
                </Badge>
              </div>
              {org.role === 'commissioner' && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/orgs/${org.id}`}>Manage</Link>
                </Button>
              )}
            </CardHeader>
            <div className="divide-y divide-border">
              {org.pools.length === 0 ? (
                <div className="px-6 py-6 text-center text-muted-foreground text-sm">
                  No pools in this organization yet.
                </div>
              ) : (
                org.pools.map((pool) => (
                  <Link
                    key={pool.id}
                    href={`/pools/${pool.id}`}
                    className="block px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-foreground">{pool.name}</div>
                        {pool.season_label && (
                          <div className="text-sm text-muted-foreground">{pool.season_label}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {pool.membership_status === 'discoverable' && (
                          <Badge className="bg-accent text-accent-foreground">Join</Badge>
                        )}
                        {pool.membership_status === 'pending' && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>
                        )}
                        <Badge
                          variant={
                            pool.status === 'open' ? 'default' :
                            pool.status === 'completed' ? 'secondary' :
                            'outline'
                          }
                          className={
                            pool.status === 'open' ? 'bg-primary' :
                            pool.status === 'draft' ? 'border-yellow-500 text-yellow-600' :
                            ''
                          }
                        >
                          {pool.status === 'completed' ? 'Completed' : pool.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
