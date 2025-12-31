import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrgMemberActions } from '@/components/orgs/org-member-actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrgMembersPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get organization
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', id)
    .single()

  if (!org) {
    notFound()
  }

  // Check if commissioner
  const { data: membership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', id)
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.is_super_admin ?? false
  const isCommissioner = membership?.role === 'commissioner' || isSuperAdmin

  if (!isCommissioner) {
    notFound()
  }

  // Get all org memberships with user profiles
  const { data: memberships } = await supabase
    .from('org_memberships')
    .select('id, user_id, role, created_at')
    .eq('org_id', id)
    .order('created_at', { ascending: false })

  // Get all user profiles for memberships
  const userIds = memberships?.map(m => m.user_id) ?? []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  // Count by role
  const commissionerCount = memberships?.filter(m => m.role === 'commissioner').length ?? 0
  const memberCount = memberships?.filter(m => m.role === 'member').length ?? 0

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
            <Link href={`/orgs/${id}`} className="hover:text-gray-700">
              {org.name}
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 font-medium">Members</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Members</h1>
          <p className="text-gray-600 mt-1">
            {commissionerCount} commissioner{commissionerCount !== 1 ? 's' : ''} &middot; {memberCount} member{memberCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Users are automatically added to this organization when they join a pool.
          To invite new users, share a pool invite link with them.
        </p>
      </div>

      {/* Commissioners Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          Commissioners
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {commissionerCount}
          </span>
        </h2>
        {commissionerCount === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg shadow">
            <p className="text-gray-600">No commissioners found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {memberships?.filter(m => m.role === 'commissioner').map((membership) => {
                  const userProfile = profileMap.get(membership.user_id)
                  const isCurrentUser = membership.user_id === user.id
                  return (
                    <tr key={membership.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {userProfile?.display_name || 'Unknown User'}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-gray-500">(you)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {membership.created_at
                          ? new Date(membership.created_at).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <OrgMemberActions
                          membershipId={membership.id}
                          orgId={id}
                          role={membership.role}
                          userName={userProfile?.display_name || 'this user'}
                          isCurrentUser={isCurrentUser}
                          commissionerCount={commissionerCount}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Members Section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          Members
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {memberCount}
          </span>
        </h2>
        {memberCount === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg shadow">
            <p className="text-gray-600">No members yet. Share a pool invite link to add members.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {memberships?.filter(m => m.role === 'member').map((membership) => {
                  const userProfile = profileMap.get(membership.user_id)
                  return (
                    <tr key={membership.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {userProfile?.display_name || 'Unknown User'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {membership.created_at
                          ? new Date(membership.created_at).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <OrgMemberActions
                          membershipId={membership.id}
                          orgId={id}
                          role={membership.role}
                          userName={userProfile?.display_name || 'this user'}
                          isCurrentUser={false}
                          commissionerCount={commissionerCount}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Back to Org */}
      <div className="mt-6">
        <Link
          href={`/orgs/${id}`}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          &larr; Back to Organization
        </Link>
      </div>
    </div>
  )
}
