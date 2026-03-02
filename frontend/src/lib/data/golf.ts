import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Golf pool data fetching.
 * Loads gp_pools config, linked tournament, and performs lazy status sync.
 *
 * NOTE: This module has a side effect — if the computed pool status differs
 * from the stored status, it updates the pools table. This lazy sync keeps
 * the pool status in sync with tournament state without a separate cron job.
 */

export function computeGolfPoolStatus(
  publicEntriesEnabled: boolean,
  picksLockAt: string | null,
  tournamentStatus: string | null,
  tournamentId: string | null
): 'draft' | 'open' | 'locked' | 'completed' {
  if (!tournamentId) return 'draft'
  if (tournamentStatus === 'completed') return 'completed'
  const now = new Date()
  const lockTime = picksLockAt ? new Date(picksLockAt) : null
  if (lockTime && now >= lockTime) return 'locked'
  if (publicEntriesEnabled) return 'open'
  return 'draft'
}

export async function getGolfData(
  supabase: SupabaseClient<Database>,
  poolId: string,
  currentPoolStatus: string
) {
  // Get gp_pool config
  const { data: gpPool } = await supabase
    .from('gp_pools')
    .select('*')
    .eq('pool_id', poolId)
    .single()

  if (!gpPool) {
    return {
      gpPoolData: null,
      gpTournamentData: null,
      statusUpdated: false,
      computedStatus: currentPoolStatus,
    }
  }

  // Get tournament if linked
  let gpTournamentData: {
    id: string; name: string; start_date: string;
    end_date: string; status: string | null
  } | null = null

  if (gpPool.tournament_id) {
    const { data: tournament } = await supabase
      .from('gp_tournaments')
      .select('id, name, start_date, end_date, status')
      .eq('id', gpPool.tournament_id)
      .single()
    gpTournamentData = tournament
  }

  // Lazy status sync: compute what the status should be
  const computedStatus = computeGolfPoolStatus(
    gpPool.public_entries_enabled ?? false,
    gpPool.picks_lock_at,
    gpTournamentData?.status as 'upcoming' | 'in_progress' | 'completed' | null,
    gpPool.tournament_id
  )

  let statusUpdated = false
  if (computedStatus !== currentPoolStatus) {
    await supabase
      .from('pools')
      .update({ status: computedStatus })
      .eq('id', poolId)
    statusUpdated = true
  }

  return {
    gpPoolData: gpPool,
    gpTournamentData,
    statusUpdated,
    computedStatus,
  }
}
