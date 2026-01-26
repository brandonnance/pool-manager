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
 * - CreatePoolButton: Modal to create new pool
 * - DeletePoolButton: Confirmation to delete pool
 * - DeleteOrgButton: Confirmation to delete org (super admin)
 * - SuperAdminJoinOrgButton: Join org as super admin
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DeletePoolButton } from '@/components/pools/delete-pool-button'
import { DeleteOrgButton } from '@/components/orgs/delete-org-button'
import { SuperAdminJoinOrgButton } from '@/components/orgs/super-admin-join-org-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

/** Page props with dynamic route parameters */
interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Organization detail page component (Server Component)
 *
 * @param props.params - Contains the org id from the URL
 * @returns Full organization page with pools list
 *
 * @data_fetching
 * - organizations: Org details by id
 * - org_memberships: User's role in this org
 * - profiles: Super admin status check
 * - pools: All pools in org with memberships
 */
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
  const isOrgAdmin = membership?.role === 'admin' || isSuperAdmin

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
  const pools = isOrgAdmin
    ? allPools
    : allPools?.filter((pool) => {
        const isMember = pool.pool_memberships?.some((pm) => pm.user_id === user.id)
        return isMember || pool.visibility === 'open_to_org'
      })

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
          <h2 className="text-xl font-semibold text-foreground">Pools</h2>
          {isOrgAdmin && (
            <Button asChild>
              <Link href={`/create-pool?orgId=${id}`}>Create Pool</Link>
            </Button>
          )}
        </div>

        {!pools || pools.length === 0 ? (
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
              {isOrgAdmin && (
                <Button asChild>
                  <Link href={`/create-pool?orgId=${id}`}>Create Pool</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pools.map((pool) => {
              const myMembership = pool.pool_memberships?.find(
                (pm) => pm.user_id === user.id
              )
              const poolMemberCount = pool.pool_memberships?.filter(
                (pm) => pm.status === 'approved'
              ).length ?? 0
              const pendingCount = pool.pool_memberships?.filter(
                (pm) => pm.status === 'pending'
              ).length ?? 0
              // Pool commissioner = explicit pool role OR org admin (implicit rights)
              const isPoolCommissioner = myMembership?.role === 'commissioner' || isOrgAdmin

              const poolTypeLabel = pool.type === 'bowl_buster'
                ? 'Bowl Buster'
                : pool.type === 'playoff_squares' || pool.type === 'single_game_squares'
                ? 'Squares'
                : pool.type

              return (
                <Link
                  key={pool.id}
                  href={`/pools/${pool.id}`}
                  className="block group"
                >
                  <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/20 relative overflow-visible">
                    {/* iPhone-style notification badge */}
                    {isPoolCommissioner && pendingCount > 0 && (
                      <div className="absolute -top-2 -left-2 z-10">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[11px] font-bold text-white shadow-sm ring-2 ring-background">
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      </div>
                    )}

                    {/* Delete button for org admins */}
                    {isOrgAdmin && (
                      <div className="absolute top-3 right-3 z-10">
                        <DeletePoolButton
                          poolId={pool.id}
                          poolName={pool.name}
                          poolType={pool.type}
                          orgId={id}
                        />
                      </div>
                    )}

                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base group-hover:text-primary transition-colors pr-8">
                          {pool.name}
                        </CardTitle>
                      </div>
                      <CardDescription>
                        {poolTypeLabel}
                        {pool.season_label && ` · ${pool.season_label}`}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {poolMemberCount} member{poolMemberCount !== 1 ? 's' : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          {isPoolCommissioner ? (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                              Commissioner
                            </Badge>
                          ) : myMembership ? (
                            <Badge
                              variant={myMembership.status === 'approved' ? 'secondary' : 'outline'}
                              className={`text-[10px] px-1.5 py-0 ${
                                myMembership.status === 'pending'
                                  ? 'border-yellow-500 text-yellow-600'
                                  : ''
                              }`}
                            >
                              {myMembership.status === 'approved' ? 'Joined' : 'Pending'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not a member</span>
                          )}
                          <Badge
                            variant={
                              pool.status === 'open' ? 'default' :
                              pool.status === 'completed' ? 'secondary' :
                              'outline'
                            }
                            className={`text-[10px] px-1.5 py-0 ${
                              pool.status === 'open' ? 'bg-green-600' :
                              pool.status === 'draft' ? 'border-yellow-500 text-yellow-600' :
                              ''
                            }`}
                          >
                            {pool.status}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
