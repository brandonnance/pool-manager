import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserActions } from '@/components/admin/user-actions'

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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Orgs</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium">{u.display_name || 'No name'}</div>
                        <div className="text-sm text-muted-foreground font-mono">{u.id.slice(0, 8)}...</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{u.email || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      {u.deactivated_at ? (
                        <Badge variant="destructive">Deactivated</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-600">Active</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {u.is_super_admin ? (
                        <Badge variant="secondary">Super Admin</Badge>
                      ) : (
                        <span className="text-muted-foreground">User</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-muted-foreground">{orgCountMap[u.id] || 0}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-muted-foreground">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <UserActions
                        userId={u.id}
                        userName={u.display_name || 'User'}
                        isDeactivated={!!u.deactivated_at}
                        isSuperAdmin={!!u.is_super_admin}
                        isCurrentUser={u.id === user.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(!users || users.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
