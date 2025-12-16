import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PoolSettings } from '@/components/pools/pool-settings'
import { JoinPoolButton } from '@/components/pools/join-pool-button'
import { CreateEntryButton } from '@/components/pools/create-entry-button'

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

  // Check if user is pool member
  const { data: membership } = await supabase
    .from('pool_memberships')
    .select('id, status')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .single()

  // Check if commissioner (org commissioner or pool creator)
  const { data: orgMembership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', pool.org_id)
    .eq('user_id', user.id)
    .single()

  // Check if super admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.is_super_admin ?? false
  const isCommissioner =
    orgMembership?.role === 'commissioner' ||
    pool.created_by === user.id ||
    isSuperAdmin

  const isMember = membership?.status === 'approved'
  const isPending = membership?.status === 'pending'

  // Get pool games count
  const { count: gamesCount } = await supabase
    .from('bb_pool_games')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', id)

  // Get member count
  const { count: memberCount } = await supabase
    .from('pool_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', id)
    .eq('status', 'approved')

  // Get user's entry if they have one
  const { data: entry } = await supabase
    .from('bb_entries')
    .select('id')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .single()

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
          <li className="text-gray-900 font-medium">{pool.name}</li>
        </ol>
      </nav>

      {/* Pool Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">{pool.name}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                pool.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : pool.status === 'draft'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {pool.status}
              </span>
            </div>
            <p className="text-gray-600 mt-1">
              {pool.type === 'bowl_buster' ? 'Bowl Buster' : pool.type}
              {pool.season_label && ` - ${pool.season_label}`}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {memberCount} member{memberCount !== 1 ? 's' : ''} &middot; {gamesCount ?? 0} games
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {isCommissioner && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Commissioner
              </span>
            )}
            {!isMember && !isPending && !isCommissioner && <JoinPoolButton poolId={id} />}
            {isPending && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium bg-yellow-100 text-yellow-800">
                Pending Approval
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Games/Picks */}
        <div className="lg:col-span-2 space-y-6">
          {pool.status === 'draft' && isCommissioner ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pool Setup</h2>
              <p className="text-gray-600 mb-4">
                This pool is in draft mode. Add games and configure settings before activating.
              </p>
              <div className="space-y-3">
                <Link
                  href={`/pools/${id}/games`}
                  className="block w-full text-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Manage Games
                </Link>
                <Link
                  href={`/pools/${id}/settings`}
                  className="block w-full text-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Pool Settings
                </Link>
              </div>
            </div>
          ) : pool.status === 'draft' ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Pool Not Active</h2>
              <p className="text-gray-600">
                This pool is still being set up. Check back soon!
              </p>
            </div>
          ) : isMember || isCommissioner ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Bowl Picks</h2>
              {gamesCount === 0 ? (
                <p className="text-gray-600">No games have been added to this pool yet.</p>
              ) : entry ? (
                <div>
                  <p className="text-gray-600 mb-4">Make your picks for each bowl game.</p>
                  <Link
                    href={`/pools/${id}/picks`}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                  >
                    View/Edit Picks
                  </Link>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 mb-4">Create an entry to start making picks.</p>
                  <CreateEntryButton poolId={id} />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Join to View Picks</h2>
              <p className="text-gray-600 mb-4">
                You need to be a member of this pool to view and make picks.
              </p>
              <JoinPoolButton poolId={id} />
            </div>
          )}

          {/* Standings Preview */}
          {(isMember || isCommissioner) && pool.status === 'active' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Standings</h2>
                <Link
                  href={`/pools/${id}/standings`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  View Full Standings
                </Link>
              </div>
              <p className="text-gray-500 text-sm">Standings will appear here once games are played.</p>
            </div>
          )}
        </div>

        {/* Right Column - Pool Info */}
        <div className="space-y-6">
          {isCommissioner && (
            <PoolSettings pool={pool} />
          )}

          {/* Members */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Members</h2>
              {isCommissioner && (
                <Link
                  href={`/pools/${id}/members`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Manage
                </Link>
              )}
            </div>
            <p className="text-gray-600">{memberCount} approved member{memberCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
