import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CreateOrgButton } from '@/components/orgs/create-org-button'

export default async function OrgsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get user's org memberships with org details
  const { data: memberships } = await supabase
    .from('org_memberships')
    .select(`
      id,
      role,
      org_id,
      organizations (
        id,
        name,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Check if user is super admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.is_super_admin ?? false

  // If super admin, get all orgs
  let allOrgs: { id: string; name: string; created_at: string | null }[] = []
  if (isSuperAdmin) {
    const { data } = await supabase
      .from('organizations')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
    allOrgs = data ?? []
  }

  const orgs = isSuperAdmin
    ? allOrgs.map(org => ({
        org_id: org.id,
        role: 'super_admin' as const,
        organizations: org
      }))
    : memberships ?? []

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <CreateOrgButton />
      </div>

      {orgs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations yet</h3>
          <p className="text-gray-600 mb-4">Create your first organization to get started.</p>
          <CreateOrgButton />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((membership) => {
            const org = membership.organizations
            if (!org) return null

            return (
              <Link
                key={membership.org_id}
                href={`/orgs/${membership.org_id}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {org.name}
                </h2>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    membership.role === 'commissioner' || membership.role === 'super_admin'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {membership.role === 'super_admin' ? 'Super Admin' : membership.role}
                  </span>
                  <span className="text-sm text-gray-500">
                    {org.created_at ? new Date(org.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
