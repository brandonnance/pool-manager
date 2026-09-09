/**
 * @fileoverview Organization Detail Page
 * @route /orgs/[id]
 * @auth Requires authentication; org membership for access
 * @layout Dashboard layout with header/nav
 *
 * @description
 * Displays organization details and lists all pools within the org.
 * Admins can create/delete pools and manage members. Regular members
 * see only pools they're members of or pools marked as open_to_org.
 *
 * @features
 * - View organization name, member count, creation date
 * - List pools with member counts and status badges
 * - Archived pools hidden by default; `?archived=1` reveals an Archived section
 * - Archive/unarchive completed pools (commissioners and admins)
 * - Create new pools (admin only)
 * - Delete pools (admin only)
 * - Manage members link (admin only)
 * - Super admin can join org and delete org
 * - Pending member notification badges on pool cards
 *
 * @permissions
 * - Super Admin: Full access, can delete org
 * - Org Admin: Create/delete pools, manage members
 * - Member: View accessible pools only
 *
 * @components
 * - OrgPoolCard: Pool card with archive/delete controls
 * - CreatePoolButton: Modal to create new pool
 * - DeleteOrgButton: Confirmation to delete org (super admin)
 * - SuperAdminJoinOrgButton: Join org as super admin
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreatePoolButton } from '@/components/pools/create-pool-button'
import { OrgPoolCard } from '@/components/pools/org-pool-card'
import { DeleteOrgButton } from '@/components/orgs/delete-org-button'
import { SuperAdminJoinOrgButton } from '@/components/orgs/super-admin-join-org-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getOrgPermissions } from '@/lib/permissions'
import { partitionArchived } from '@/lib/pools/archive'

/** Page props with dynamic route parameters */
interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ archived?: string }>
}

/**
 * Organization detail page component (Server Component)
 *
 * @param props.params - Contains the org id from the URL
 * @param props.searchParams - `archived=1` reveals archived pools
 * @returns Full organization page with pools list
 *
 * @data_fetching
 * - organizations: Org details by id
 * - org_memberships: User's role in this org
 * - profiles: Super admin status check
 * - pools: All pools in org with memberships
 */
export default async function OrgDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { archived: archivedParam } = await searchParams
  const showArchived = archivedParam === '1'
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

  // Get user permissions for this org
  const { isSuperAdmin, isOrgAdmin, orgMembership: membership } = await getOrgPermissions(supabase, user.id, id)

  // Get pools in this org
  const { data: allPools } = await supabase
    .from('pools')
    .select(`
      id,
      name,
      type,
      status,
      visibility,
      season_label,
      archived_at,
      created_at,
      created_by,
      pool_memberships (
        id,
        user_id,
        status,
        role
      )
    `)
    .eq('org_id', id)
    .order('created_at', { ascending: false })

  // Filter pools based on visibility:
  // - Admins see all pools
  // - Regular members see: pools they're a member of OR open_to_org pools
  const visiblePools = isOrgAdmin
    ? allPools
    : allPools?.filter((pool) => {
        const isMember = pool.pool_memberships?.some((pm) => pm.user_id === user.id)
        return isMember || pool.visibility === 'open_to_org'
      })

  // Archived pools are shelved out of the default listing
  const { active: pools, archived: archivedPools } = partitionArchived(visiblePools)
  const hasAnyPools = pools.length > 0 || archivedPools.length > 0

  // Get member count for the org
  const { count: memberCount } = await supabase
    .from('org_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', id)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav>
        <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
          <li>
            <Link href="/orgs" className="hover:text-foreground transition-colors">
              Organizations
            </Link>
          </li>
          <li className="text-muted-foreground/50">/</li>
          <li className="text-foreground font-medium">{org.name}</li>
        </ol>
      </nav>

      {/* Org Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{org.name}</CardTitle>
              <CardDescription className="mt-1">
                {memberCount} member{memberCount !== 1 ? 's' : ''} · Created {org.created_at ? new Date(org.created_at).toLocaleDateString() : ''}
              </CardDescription>
              {isOrgAdmin && (
                <Badge variant={isSuperAdmin ? 'default' : 'secondary'} className="mt-2">
                  {isSuperAdmin ? 'Super Admin' : 'Admin'}
                </Badge>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* Super admin not yet a member - show join button */}
              {isSuperAdmin && !membership && (
                <SuperAdminJoinOrgButton orgId={id} orgName={org.name} />
              )}
              {isOrgAdmin && (
                <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                  <Link href={`/orgs/${id}/members`}>
                    Manage Members
                  </Link>
                </Button>
              )}
              {isSuperAdmin && (
                <DeleteOrgButton orgId={id} orgName={org.name} />
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Pools Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-foreground">Pools</h2>
            {archivedPools.length > 0 && (
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                <Link href={showArchived ? `/orgs/${id}` : `/orgs/${id}?archived=1`}>
                  {showArchived ? 'Hide archived' : `Show archived (${archivedPools.length})`}
                </Link>
              </Button>
            )}
          </div>
          {isOrgAdmin && <CreatePoolButton orgId={id} />}
        </div>

        {!hasAnyPools ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No pools yet</h3>
              <p className="text-muted-foreground mb-4">
                {isOrgAdmin
                  ? 'Create your first pool to get started.'
                  : 'The admin hasn\'t created any pools yet.'}
              </p>
              {isOrgAdmin && <CreatePoolButton orgId={id} />}
            </CardContent>
          </Card>
        ) : pools.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No active pools.{' '}
              {!showArchived && (
                <Link href={`/orgs/${id}?archived=1`} className="text-primary hover:underline">
                  Show {archivedPools.length} archived pool{archivedPools.length !== 1 ? 's' : ''}
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pools.map((pool) => (
              <OrgPoolCard key={pool.id} pool={pool} orgId={id} userId={user.id} isOrgAdmin={isOrgAdmin} />
            ))}
          </div>
        )}

        {/* Archived Section */}
        {showArchived && archivedPools.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-muted-foreground">Archived</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{archivedPools.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {archivedPools.map((pool) => (
                <OrgPoolCard key={pool.id} pool={pool} orgId={id} userId={user.id} isOrgAdmin={isOrgAdmin} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
