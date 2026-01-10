/**
 * @fileoverview Organization Members Management Page
 * @route /orgs/[id]/members
 * @auth Requires org admin or super admin
 * @layout Dashboard layout with header/nav
 *
 * @description
 * Allows org admins to view and manage organization members.
 * Shows separate sections for admins and regular members with
 * role management and removal capabilities.
 *
 * @features
 * - View all org members grouped by role (admin/member)
 * - Promote members to admin
 * - Demote admins to member (if not last admin)
 * - Remove members from organization
 * - Responsive design with mobile cards and desktop tables
 * - Protection against removing last admin
 *
 * @permissions
 * - Only org admins and super admins can access this page
 * - Cannot demote last admin
 * - Cannot remove super admins (unless you are one)
 *
 * @components
 * - OrgMemberActions: Action buttons for each member (promote/demote/remove)
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrgMemberActions } from '@/components/orgs/org-member-actions'

/** Page props with dynamic route parameters */
interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Organization members management page component (Server Component)
 *
 * @param props.params - Contains the org id from the URL
 * @returns Members management page with admin and member sections
 *
 * @data_fetching
 * - organizations: Org name for breadcrumb
 * - org_memberships: All memberships for this org
 * - profiles: Display names and super admin status for all members
 */
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
  const isOrgAdmin = membership?.role === 'admin' || isSuperAdmin

  if (!isOrgAdmin) {
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
    .select('id, display_name, is_super_admin')
    .in('id', userIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  // Count by role
  const adminCount = memberships?.filter(m => m.role === 'admin').length ?? 0
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
            {adminCount} admin{adminCount !== 1 ? 's' : ''} &middot; {memberCount} member{memberCount !== 1 ? 's' : ''}
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

      {/* Admins Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          Admins
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {adminCount}
          </span>
        </h2>
        {adminCount === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg shadow">
            <p className="text-gray-600">No admins found.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {memberships?.filter(m => m.role === 'admin').map((membership) => {
                const userProfile = profileMap.get(membership.user_id)
                const isCurrentUser = membership.user_id === user.id
                return (
                  <div key={membership.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-gray-900">
                        {userProfile?.display_name || 'Unknown User'}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {membership.created_at
                          ? new Date(membership.created_at).toLocaleDateString()
                          : '-'}
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <OrgMemberActions
                        membershipId={membership.id}
                        orgId={id}
                        role={membership.role}
                        userName={userProfile?.display_name || 'this user'}
                        isCurrentUser={isCurrentUser}
                        adminCount={adminCount}
                        isMemberSuperAdmin={userProfile?.is_super_admin ?? false}
                        isCurrentUserSuperAdmin={isSuperAdmin}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
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
                  {memberships?.filter(m => m.role === 'admin').map((membership) => {
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
                            adminCount={adminCount}
                            isMemberSuperAdmin={userProfile?.is_super_admin ?? false}
                            isCurrentUserSuperAdmin={isSuperAdmin}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
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
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {memberships?.filter(m => m.role === 'member').map((membership) => {
                const userProfile = profileMap.get(membership.user_id)
                return (
                  <div key={membership.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-gray-900">
                        {userProfile?.display_name || 'Unknown User'}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {membership.created_at
                          ? new Date(membership.created_at).toLocaleDateString()
                          : '-'}
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <OrgMemberActions
                        membershipId={membership.id}
                        orgId={id}
                        role={membership.role}
                        userName={userProfile?.display_name || 'this user'}
                        isCurrentUser={false}
                        adminCount={adminCount}
                        isMemberSuperAdmin={userProfile?.is_super_admin ?? false}
                        isCurrentUserSuperAdmin={isSuperAdmin}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
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
                            adminCount={adminCount}
                            isMemberSuperAdmin={userProfile?.is_super_admin ?? false}
                            isCurrentUserSuperAdmin={isSuperAdmin}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
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
