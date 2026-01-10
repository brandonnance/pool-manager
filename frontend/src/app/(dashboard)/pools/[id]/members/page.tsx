/**
 * @fileoverview Pool Members Management Page
 * @route /pools/[id]/members
 * @auth Requires pool commissioner or org admin
 * @layout Dashboard layout with header/nav
 *
 * @description
 * Comprehensive member management for pool commissioners. Handles pending
 * approvals, member roles, invite links, and supports both account-based
 * and no-account modes for squares pools.
 *
 * @features
 * - View pending membership requests with approve/reject
 * - View approved members with role badges
 * - Promote members to commissioner (org admin only)
 * - Remove members from pool
 * - Generate and manage invite links
 * - Add existing org members directly to pool
 * - Squares-specific: show square counts per member
 * - No-account mode: shows only commissioners
 *
 * @modes
 * - Standard: Full member management with invite links
 * - No-account (squares): Commissioners only, no invite links
 *
 * @components
 * - MemberActions: Approve/reject/remove/promote buttons
 * - GenerateLinkButton: Create new invite link
 * - CopyLinkButton: Copy invite URL to clipboard
 * - DeleteLinkButton: Remove invite link
 * - AddOrgMemberButton: Add org member to pool directly
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MemberActions } from '@/components/members/member-actions'
import { GenerateLinkButton } from '@/components/members/generate-link-button'
import { CopyLinkButton } from '@/components/members/copy-link-button'
import { DeleteLinkButton } from '@/components/members/delete-link-button'
import { AddOrgMemberButton } from '@/components/members/add-org-member-button'

/** Page props with dynamic route parameters */
interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Pool members management page component (Server Component)
 *
 * @param props.params - Contains the pool id from the URL
 * @returns Members management page with sections for pending/approved and invite links
 *
 * @data_fetching
 * - pools: Pool details with org info
 * - sq_pools: Squares config (for lock status, no-account mode)
 * - pool_memberships: All memberships for this pool
 * - profiles: Display names for all members
 * - join_links: Active invite links
 * - org_memberships: Org members available to add
 */
export default async function PoolMembersPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get pool
  const { data: pool } = await supabase
    .from('pools')
    .select(`
      id,
      name,
      org_id,
      status,
      type,
      organizations (name)
    `)
    .eq('id', id)
    .single()

  if (!pool) {
    notFound()
  }

  // For squares pools (any type), get the lock status and square counts
  const isSquaresPool = pool.type === 'squares' || pool.type === 'playoff_squares' || pool.type === 'single_game_squares'
  let isSquaresLocked = false
  const squareCountsByUser = new Map<string, number>()
  let isNoAccountMode = false

  if (isSquaresPool) {
    const { data: sqPool } = await supabase
      .from('sq_pools')
      .select('id, numbers_locked, no_account_mode')
      .eq('pool_id', id)
      .single()
    isSquaresLocked = sqPool?.numbers_locked ?? false
    isNoAccountMode = sqPool?.no_account_mode ?? false

    // Get square counts per user (only for non-no-account mode)
    if (sqPool && !isNoAccountMode) {
      const { data: squares } = await supabase
        .from('sq_squares')
        .select('user_id')
        .eq('sq_pool_id', sqPool.id)
        .not('user_id', 'is', null)

      if (squares) {
        for (const sq of squares) {
          if (sq.user_id) {
            squareCountsByUser.set(sq.user_id, (squareCountsByUser.get(sq.user_id) ?? 0) + 1)
          }
        }
      }
    }
  }

  // Check if org admin
  const { data: orgMembership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', pool.org_id)
    .eq('user_id', user.id)
    .single()

  // Check if pool commissioner
  const { data: poolMembership } = await supabase
    .from('pool_memberships')
    .select('role')
    .eq('pool_id', id)
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
    notFound()
  }

  // Get all pool memberships with user profiles
  const { data: memberships } = await supabase
    .from('pool_memberships')
    .select('id, user_id, status, role, created_at, approved_at, approved_by')
    .eq('pool_id', id)
    .order('created_at', { ascending: false })

  // Get all user profiles for memberships
  const userIds = memberships?.map(m => m.user_id) ?? []
  const approverIds = memberships?.map(m => m.approved_by).filter(Boolean) as string[] ?? []
  const allUserIds = [...new Set([...userIds, ...approverIds])]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, is_super_admin')
    .in('id', allUserIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  // For no-account mode, only show commissioners
  const filteredMemberships = isNoAccountMode
    ? memberships?.filter(m => m.role === 'commissioner')
    : memberships

  // Count by status
  const pendingCount = filteredMemberships?.filter(m => m.status === 'pending').length ?? 0
  const approvedCount = filteredMemberships?.filter(m => m.status === 'approved').length ?? 0
  const commissionerCount = memberships?.filter(m => m.role === 'commissioner' && m.status === 'approved').length ?? 0

  // Get join links (skip for no-account mode)
  const { data: joinLinks } = await supabase
    .from('join_links')
    .select('id, token, expires_at, max_uses, uses, created_at')
    .eq('pool_id', id)
    .order('created_at', { ascending: false })

  // Get org members who are NOT already pool members
  const existingPoolMemberIds = new Set(memberships?.map(m => m.user_id) ?? [])

  const { data: orgMembers } = await supabase
    .from('org_memberships')
    .select('user_id, role')
    .eq('org_id', pool.org_id)

  // Filter out users already in pool and get their profiles
  const addableOrgMemberIds = orgMembers
    ?.filter(om => !existingPoolMemberIds.has(om.user_id))
    .map(om => om.user_id) ?? []

  const { data: addableProfiles } = addableOrgMemberIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', addableOrgMemberIds)
    : { data: [] }

  const addableProfileMap = new Map(addableProfiles?.map(p => [p.id, p.display_name]) ?? [])

  const addableOrgMembers = orgMembers
    ?.filter(om => !existingPoolMemberIds.has(om.user_id))
    .map(om => ({
      userId: om.user_id,
      displayName: addableProfileMap.get(om.user_id) ?? null,
      role: om.role,
    }))
    .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '')) ?? []

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
          <li>
            <Link href={`/pools/${id}`} className="hover:text-gray-700">
              {pool.name}
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 font-medium">Members</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNoAccountMode ? 'Manage Commissioners' : 'Manage Members'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isNoAccountMode ? (
              <>
                {commissionerCount} commissioner{commissionerCount !== 1 ? 's' : ''}
                <span className="text-muted-foreground ml-2">
                  (No-account mode - participants don&apos;t need accounts)
                </span>
              </>
            ) : (
              <>
                {approvedCount} approved member{approvedCount !== 1 ? 's' : ''}
                {pendingCount > 0 && (
                  <span className="ml-2 text-yellow-600">
                    ({pendingCount} pending)
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        {!isNoAccountMode && (
          <AddOrgMemberButton poolId={id} orgMembers={addableOrgMembers} />
        )}
      </div>

      {/* Pending Requests Section - hide for no-account mode */}
      {!isNoAccountMode && pendingCount > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            Pending Requests
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {pendingCount}
            </span>
          </h2>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {memberships?.filter(m => m.status === 'pending').map((membership) => {
              const userProfile = profileMap.get(membership.user_id)
              return (
                <div key={membership.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-medium text-gray-900">
                      {userProfile?.display_name || 'Unknown User'}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {membership.created_at
                        ? new Date(membership.created_at).toLocaleDateString()
                        : '-'}
                    </span>
                  </div>
                  <MemberActions
                    membershipId={membership.id}
                    poolId={id}
                    status={membership.status}
                    userName={userProfile?.display_name || 'this user'}
                    currentUserId={user.id}
                    memberRole={membership.role}
                    isOrgAdmin={isOrgAdmin}
                    memberId={membership.user_id}
                    poolType={pool.type}
                    isSquaresLocked={isSquaresLocked}
                    isMemberSuperAdmin={userProfile?.is_super_admin ?? false}
                    isCurrentUserSuperAdmin={isSuperAdmin}
                  />
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
                    Requested
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {memberships?.filter(m => m.status === 'pending').map((membership) => {
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
                        <MemberActions
                          membershipId={membership.id}
                          poolId={id}
                          status={membership.status}
                          userName={userProfile?.display_name || 'this user'}
                          currentUserId={user.id}
                          memberRole={membership.role}
                          isOrgAdmin={isOrgAdmin}
                          memberId={membership.user_id}
                          poolType={pool.type}
                          isSquaresLocked={isSquaresLocked}
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
        </div>
      )}

      {/* Approved Members Section (Commissioners for no-account mode) */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          {isNoAccountMode ? 'Commissioners' : 'Approved Members'}
        </h2>
        {approvedCount === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isNoAccountMode ? 'No commissioners yet' : 'No members yet'}
            </h3>
            <p className="text-gray-600">
              {isNoAccountMode
                ? 'Add org members as commissioners to help manage this pool.'
                : 'Share a join link to invite people to this pool.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredMemberships?.filter(m => m.status === 'approved').map((membership) => {
                const userProfile = profileMap.get(membership.user_id)
                const approverProfile = membership.approved_by
                  ? profileMap.get(membership.approved_by)
                  : null
                return (
                  <div key={membership.id} className="bg-white rounded-lg shadow p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-gray-900">
                        {userProfile?.display_name || 'Unknown User'}
                      </div>
                      {membership.role === 'commissioner' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Commissioner
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Member</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {isSquaresPool && !isNoAccountMode && (
                        <span>{squareCountsByUser.get(membership.user_id) ?? 0} squares</span>
                      )}
                      <span>
                        Joined {membership.approved_at
                          ? new Date(membership.approved_at).toLocaleDateString()
                          : membership.created_at
                          ? new Date(membership.created_at).toLocaleDateString()
                          : '-'}
                      </span>
                      {approverProfile?.display_name && (
                        <span>by {approverProfile.display_name}</span>
                      )}
                    </div>
                    <div className="pt-2 border-t">
                      <MemberActions
                        membershipId={membership.id}
                        poolId={id}
                        status={membership.status}
                        userName={userProfile?.display_name || 'this user'}
                        currentUserId={user.id}
                        memberRole={membership.role}
                        isOrgAdmin={isOrgAdmin}
                        memberId={membership.user_id}
                        poolType={pool.type}
                        isSquaresLocked={isSquaresLocked}
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
                      Role
                    </th>
                    {isSquaresPool && !isNoAccountMode && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Squares
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approved By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMemberships?.filter(m => m.status === 'approved').map((membership) => {
                    const userProfile = profileMap.get(membership.user_id)
                    const approverProfile = membership.approved_by
                      ? profileMap.get(membership.approved_by)
                      : null
                    return (
                      <tr key={membership.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {userProfile?.display_name || 'Unknown User'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {membership.role === 'commissioner' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Commissioner
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">Member</span>
                          )}
                        </td>
                        {isSquaresPool && !isNoAccountMode && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {squareCountsByUser.get(membership.user_id) ?? 0}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {membership.approved_at
                            ? new Date(membership.approved_at).toLocaleDateString()
                            : membership.created_at
                            ? new Date(membership.created_at).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {approverProfile?.display_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <MemberActions
                            membershipId={membership.id}
                            poolId={id}
                            status={membership.status}
                            userName={userProfile?.display_name || 'this user'}
                            currentUserId={user.id}
                            memberRole={membership.role}
                            isOrgAdmin={isOrgAdmin}
                            memberId={membership.user_id}
                            poolType={pool.type}
                            isSquaresLocked={isSquaresLocked}
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

      {/* Invite Links Section - hide for no-account mode */}
      {!isNoAccountMode && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Invite Links</h2>
            <GenerateLinkButton poolId={id} />
          </div>

          {!joinLinks || joinLinks.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg shadow">
              <p className="text-gray-600">No invite links yet. Generate one to share with others.</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {joinLinks.map((link) => {
                  const isExpired = link.expires_at && new Date(link.expires_at) < new Date()
                  const isMaxedOut = link.max_uses && (link.uses ?? 0) >= link.max_uses
                  const isActive = !isExpired && !isMaxedOut

                  return (
                    <div key={link.id} className={`bg-white rounded-lg shadow p-4 space-y-3 ${!isActive ? 'opacity-60' : ''}`}>
                      <div>
                        <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded break-all">
                          {link.token}
                        </code>
                        {!isActive && (
                          <span className="ml-2 text-xs text-destructive">
                            {isExpired ? 'Expired' : 'Max uses reached'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Uses: {link.uses ?? 0}{link.max_uses ? ` / ${link.max_uses}` : ''}</span>
                        <span>Expires: {link.expires_at ? new Date(link.expires_at).toLocaleDateString() : 'Never'}</span>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        {isActive && (
                          <CopyLinkButton token={link.token} />
                        )}
                        <DeleteLinkButton linkId={link.id} />
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
                        Link
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Uses
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {joinLinks.map((link) => {
                      const isExpired = link.expires_at && new Date(link.expires_at) < new Date()
                      const isMaxedOut = link.max_uses && (link.uses ?? 0) >= link.max_uses
                      const isActive = !isExpired && !isMaxedOut

                      return (
                        <tr key={link.id} className={!isActive ? 'bg-gray-50' : ''}>
                          <td className="px-6 py-4">
                            <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded break-all">
                              {link.token}
                            </code>
                            {!isActive && (
                              <span className="ml-2 text-xs text-red-600">
                                {isExpired ? 'Expired' : 'Max uses reached'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {link.uses ?? 0}{link.max_uses ? ` / ${link.max_uses}` : ''}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {link.expires_at
                              ? new Date(link.expires_at).toLocaleDateString()
                              : 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2">
                              {isActive && (
                                <CopyLinkButton token={link.token} />
                              )}
                              <DeleteLinkButton linkId={link.id} />
                            </div>
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
      )}

      {/* Back to Pool */}
      <div className="mt-6">
        <Link
          href={`/pools/${id}`}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          &larr; Back to Pool
        </Link>
      </div>
    </div>
  )
}
