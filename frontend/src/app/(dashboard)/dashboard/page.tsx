import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back! Here&apos;s an overview of your pools.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Organizations</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{orgsWithPools.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Active Pools</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{activePools}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Pools</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{totalPools}</div>
          {discoverableCount > 0 && (
            <div className="mt-1 text-sm text-blue-600">
              +{discoverableCount} available to join
            </div>
          )}
        </div>
      </div>

      {/* Pools grouped by Organization */}
      {orgsWithPools.length === 0 ? (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Your Pools</h2>
            <Link
              href="/orgs/new"
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Organization
            </Link>
          </div>
          <div className="px-6 py-8 text-center text-gray-500">
            <p>You&apos;re not a member of any organizations yet.</p>
            <p className="mt-1 text-sm">Create one to get started, or join a pool using an invite link!</p>
          </div>
        </div>
      ) : (
        orgsWithPools.map((org) => (
          <div key={org.id} className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Link href={`/orgs/${org.id}`} className="text-lg font-medium text-gray-900 hover:text-blue-600">
                  {org.name}
                </Link>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  org.role === 'commissioner'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {org.role}
                </span>
              </div>
              {org.role === 'commissioner' && (
                <Link
                  href={`/orgs/${org.id}`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Manage
                </Link>
              )}
            </div>
            <div className="divide-y divide-gray-200">
              {org.pools.length === 0 ? (
                <div className="px-6 py-6 text-center text-gray-500 text-sm">
                  No pools in this organization yet.
                </div>
              ) : (
                org.pools.map((pool) => (
                  <Link
                    key={pool.id}
                    href={`/pools/${pool.id}`}
                    className="block px-6 py-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{pool.name}</div>
                        {pool.season_label && (
                          <div className="text-sm text-gray-500">{pool.season_label}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {pool.membership_status === 'discoverable' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Join
                          </span>
                        )}
                        {pool.membership_status === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          pool.status === 'open' ? 'bg-green-100 text-green-800' :
                          pool.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          pool.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {pool.status === 'completed' ? 'Completed' : pool.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
