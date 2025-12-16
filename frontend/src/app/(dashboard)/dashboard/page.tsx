import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get user's organizations
  const { data: memberships } = await supabase
    .from('org_memberships')
    .select(`
      role,
      organizations (
        id,
        name
      )
    `)
    .eq('user_id', user!.id)

  // Get user's pool memberships
  const { data: poolMemberships } = await supabase
    .from('pool_memberships')
    .select(`
      status,
      pools (
        id,
        name,
        status,
        season_label,
        organizations (
          name
        )
      )
    `)
    .eq('user_id', user!.id)
    .eq('status', 'approved')

  const orgs = memberships?.map(m => ({
    ...m.organizations,
    role: m.role
  })) || []

  const pools = poolMemberships?.map(pm => pm.pools) || []

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
          <div className="mt-2 text-3xl font-bold text-gray-900">{orgs.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Active Pools</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">
            {pools.filter(p => p?.status === 'open').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total Pools</div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{pools.length}</div>
        </div>
      </div>

      {/* Organizations Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Your Organizations</h2>
          <Link
            href="/orgs/new"
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Create Organization
          </Link>
        </div>
        <div className="divide-y divide-gray-200">
          {orgs.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>You&apos;re not a member of any organizations yet.</p>
              <p className="mt-1 text-sm">Create one to get started!</p>
            </div>
          ) : (
            orgs.map((org) => (
              <Link
                key={org?.id}
                href={`/orgs/${org?.id}`}
                className="block px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{org?.name}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      org?.role === 'commissioner'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {org?.role}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Pools Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Your Pools</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {pools.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>You&apos;re not a member of any pools yet.</p>
              <p className="mt-1 text-sm">Join a pool using an invite link, or create one in your organization.</p>
            </div>
          ) : (
            pools.map((pool) => (
              <Link
                key={pool?.id}
                href={`/pools/${pool?.id}`}
                className="block px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{pool?.name}</div>
                    <div className="text-sm text-gray-500">
                      {pool?.organizations?.name} {pool?.season_label && `• ${pool.season_label}`}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    pool?.status === 'open' ? 'bg-green-100 text-green-800' :
                    pool?.status === 'locked' ? 'bg-yellow-100 text-yellow-800' :
                    pool?.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {pool?.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
