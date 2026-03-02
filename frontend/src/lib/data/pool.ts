import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Shared pool data fetching used by the pool detail page.
 * Fetches the base pool record and member counts.
 */

export async function getPoolBaseData(
  supabase: SupabaseClient<Database>,
  poolId: string,
  userId: string
) {
  // Get pool with org info
  const { data: pool } = await supabase
    .from('pools')
    .select(`
      id,
      name,
      type,
      status,
      season_label,
      settings,
      visibility,
      created_at,
      created_by,
      org_id,
      organizations (
        id,
        name
      )
    `)
    .eq('id', poolId)
    .single()

  if (!pool) return null

  // Get member count
  const { count: memberCount } = await supabase
    .from('pool_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', poolId)
    .eq('status', 'approved')

  // Get pending member count for commissioners
  const { count: pendingMemberCount } = await supabase
    .from('pool_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('pool_id', poolId)
    .eq('status', 'pending')

  return {
    pool,
    memberCount: memberCount ?? 0,
    pendingMemberCount: pendingMemberCount ?? 0,
  }
}
