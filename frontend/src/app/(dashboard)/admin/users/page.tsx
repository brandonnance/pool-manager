/**
 * @fileoverview Super Admin user management page
 * @route /admin/users
 * @auth Super Admin only (profiles.is_super_admin = true)
 * @layout Dashboard layout with admin navigation
 *
 * @description
 * Platform-wide user management interface for super administrators.
 * Displays all users with their status, role, and org memberships.
 * Allows deactivating/reactivating users and managing super admin roles.
 *
 * @features
 * - User statistics cards (total, active, deactivated counts)
 * - Responsive table/card view of all users
 * - User status badges (Active/Deactivated)
 * - Super Admin role badges
 * - Organization membership counts per user
 * - Action buttons for user management (via UserActions component)
 *
 * @components
 * - UserActions: Dropdown with deactivate/reactivate/promote actions
 *
 * @data_fetching
 * - profiles: All user profiles with display_name, email, status, role
 * - org_memberships: Aggregated counts for each user
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UsersTable } from '@/components/admin/users-table'

/**
 * Admin users page - Server Component
 * Fetches all users and displays them in a management interface.
 * Only accessible to super admins.
 */
export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify super admin access
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    redirect('/dashboard')
  }

  // Get all users with their profiles
  const { data: users } = await supabase
    .from('profiles')
    .select('id, display_name, email, is_super_admin, deactivated_at, created_at')
    .order('created_at', { ascending: false })

  // Get org membership counts for each user
  const { data: orgCounts } = await supabase
    .from('org_memberships')
    .select('user_id')

  const orgCountMap = (orgCounts ?? []).reduce((acc, m) => {
    acc[m.user_id] = (acc[m.user_id] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage all users across the platform. Super Admin only.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{users?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {users?.filter(u => !u.deactivated_at).length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Deactivated Users</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {users?.filter(u => u.deactivated_at).length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage user accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable
            users={users ?? []}
            orgCountMap={orgCountMap}
            currentUserId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
