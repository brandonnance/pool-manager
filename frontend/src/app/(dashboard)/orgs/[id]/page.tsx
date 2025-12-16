import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreatePoolButton } from '@/components/pools/create-pool-button'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrgDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, created_at')
    .eq('id', id)
    .single()

  if (!org) {
    notFound()
  }

  // Get user's membership in this org
  const { data: membership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', id)
    .eq('user_id', user.id)
    .single()

  // Check if super admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.is_super_admin ?? false
  const isCommissioner = membership?.role === 'commissioner' || isSuperAdmin

  // Get pools in this org
  const { data: pools } = await supabase
    .from('pools')
    .select(`
      id,
      name,
      type,
      status,
      season_label,
      created_at,
      created_by,
      pool_memberships (
        id,
        user_id,
        status
      )
    `)
    .eq('org_id', id)
    .order('created_at', { ascending: false })

  // Get member count for the org
  const { count: memberCount } = await supabase
    .from('org_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', id)

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
          <li className="text-gray-900 font-medium">{org.name}</li>
        </ol>
      </nav>

      {/* Org Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{org.name}</h1>
            <p className="text-gray-600 mt-1">
              {memberCount} member{memberCount !== 1 ? 's' : ''} &middot; Created {org.created_at ? new Date(org.created_at).toLocaleDateString() : ''}
            </p>
          </div>
          {isCommissioner && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {isSuperAdmin ? 'Super Admin' : 'Commissioner'}
            </span>
          )}
        </div>
      </div>

      {/* Pools Section */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Pools</h2>
        {isCommissioner && <CreatePoolButton orgId={id} />}
      </div>

      {!pools || pools.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No pools yet</h3>
          <p className="text-gray-600 mb-4">
            {isCommissioner
              ? 'Create your first pool to get started.'
              : 'The commissioner hasn\'t created any pools yet.'}
          </p>
          {isCommissioner && <CreatePoolButton orgId={id} />}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pools.map((pool) => {
            const myMembership = pool.pool_memberships?.find(
              (pm) => pm.user_id === user.id
            )
            const poolMemberCount = pool.pool_memberships?.filter(
              (pm) => pm.status === 'approved'
            ).length ?? 0
            const isPoolCommissioner = isCommissioner || pool.created_by === user.id

            return (
              <Link
                key={pool.id}
                href={`/pools/${pool.id}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {pool.name}
                  </h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    pool.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : pool.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {pool.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {pool.type === 'bowl_buster' ? 'Bowl Buster' : pool.type}
                  {pool.season_label && ` - ${pool.season_label}`}
                </p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">
                    {poolMemberCount} member{poolMemberCount !== 1 ? 's' : ''}
                  </span>
                  {isPoolCommissioner ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      Commissioner
                    </span>
                  ) : myMembership ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      myMembership.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {myMembership.status === 'approved' ? 'Joined' : 'Pending'}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">Not a member</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
