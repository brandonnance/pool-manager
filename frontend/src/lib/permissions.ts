import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Permission derivation helpers.
 * These are pure functions — they derive roles from query results,
 * no DB calls. Use getPoolPermissions() / getOrgPermissions() for
 * the full query + derivation pattern.
 */

export function checkSuperAdmin(
  profile?: { is_super_admin?: boolean | null } | null
): boolean {
  return profile?.is_super_admin ?? false
}

export function checkOrgAdmin(
  orgMembership?: { role?: string | null } | null,
  isSuperAdmin = false
): boolean {
  return orgMembership?.role === 'admin' || isSuperAdmin
}

export function checkPoolCommissioner(
  poolMembership?: { role?: string | null } | null,
  isOrgAdmin = false
): boolean {
  return poolMembership?.role === 'commissioner' || isOrgAdmin
}

/**
 * Full permission context for a pool page.
 * Runs 3 queries (profile, org membership, pool membership) and derives all roles.
 */
export async function getPoolPermissions(
  supabase: SupabaseClient<Database>,
  userId: string,
  poolId: string,
  orgId: string
) {
  const [
    { data: profile },
    { data: orgMembership },
    { data: poolMembership },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('is_super_admin, display_name')
      .eq('id', userId)
      .single(),
    supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single(),
    supabase
      .from('pool_memberships')
      .select('id, status, role')
      .eq('pool_id', poolId)
      .eq('user_id', userId)
      .single(),
  ])

  const isSuperAdmin = checkSuperAdmin(profile)
  const isOrgAdmin = checkOrgAdmin(orgMembership, isSuperAdmin)
  const isPoolCommissioner = checkPoolCommissioner(poolMembership, isOrgAdmin)
  const isMember = poolMembership?.status === 'approved'
  const isPending = poolMembership?.status === 'pending'

  return {
    profile,
    orgMembership,
    poolMembership,
    isSuperAdmin,
    isOrgAdmin,
    isPoolCommissioner,
    isMember,
    isPending,
  }
}

/**
 * Full permission context for an org page.
 * Runs 2 queries (profile, org membership) and derives roles.
 */
export async function getOrgPermissions(
  supabase: SupabaseClient<Database>,
  userId: string,
  orgId: string
) {
  const [{ data: profile }, { data: orgMembership }] = await Promise.all([
    supabase
      .from('profiles')
      .select('is_super_admin, display_name')
      .eq('id', userId)
      .single(),
    supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single(),
  ])

  const isSuperAdmin = checkSuperAdmin(profile)
  const isOrgAdmin = checkOrgAdmin(orgMembership, isSuperAdmin)

  return {
    profile,
    orgMembership,
    isSuperAdmin,
    isOrgAdmin,
  }
}
