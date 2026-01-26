/**
 * @fileoverview Golf pool withdrawal handling logic
 * @description Handles automatic replacement of withdrawn golfers with the best available
 * in the same tier, sorted by OWGR rank.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export interface Golfer {
  id: string
  name: string
  owgr_rank: number | null
  country: string | null
}

export interface AffectedEntry {
  entryId: string
  entryName: string
  participantName: string | null
  participantEmail: string | null
  userId: string | null
  withdrawnGolfer: Golfer
  replacementGolfer: Golfer | null
  tier: number
  editToken: string | null
}

/**
 * Find the best available replacement golfer in the same tier
 * @param supabase - Supabase client
 * @param gpPoolId - The golf pool ID
 * @param tournamentId - The tournament ID
 * @param tier - The tier to search in
 * @param excludeGolferIds - Golfer IDs to exclude (already on entry + withdrawn)
 * @returns The best available golfer or null if none available
 */
export async function findBestReplacement(
  supabase: SupabaseClient<Database>,
  gpPoolId: string,
  tournamentId: string,
  tier: number,
  excludeGolferIds: string[]
): Promise<Golfer | null> {
  // Get all golfers in this tier, excluding the specified ones
  const { data: tierAssignments } = await supabase
    .from('gp_tier_assignments')
    .select(`
      golfer_id,
      gp_golfers!inner (
        id,
        name,
        owgr_rank,
        country
      )
    `)
    .eq('pool_id', gpPoolId)
    .eq('tier_value', tier)
    .not('golfer_id', 'in', `(${excludeGolferIds.join(',')})`)

  if (!tierAssignments || tierAssignments.length === 0) {
    return null
  }

  // Get active golfers in the tournament field (not withdrawn)
  const { data: activeField } = await supabase
    .from('gp_tournament_field')
    .select('golfer_id')
    .eq('tournament_id', tournamentId)
    .or('status.is.null,status.neq.withdrawn')

  const activeGolferIds = new Set((activeField ?? []).map(f => f.golfer_id))

  // Filter to only active golfers and sort by OWGR rank
  const availableGolfers = tierAssignments
    .filter(ta => activeGolferIds.has(ta.golfer_id))
    .map(ta => {
      const golfer = ta.gp_golfers as unknown as Golfer
      return {
        id: golfer.id,
        name: golfer.name,
        owgr_rank: golfer.owgr_rank,
        country: golfer.country,
      }
    })
    .sort((a, b) => {
      // Sort by OWGR rank (lower is better), nulls at the end
      if (a.owgr_rank === null && b.owgr_rank === null) return 0
      if (a.owgr_rank === null) return 1
      if (b.owgr_rank === null) return -1
      return a.owgr_rank - b.owgr_rank
    })

  return availableGolfers[0] ?? null
}

/**
 * Get all entries affected by a golfer withdrawal
 * @param supabase - Supabase client
 * @param gpPoolId - The golf pool ID
 * @param poolId - The main pool ID
 * @param withdrawnGolferId - The ID of the withdrawn golfer
 * @returns List of affected entries with their details
 */
export async function getAffectedEntries(
  supabase: SupabaseClient<Database>,
  gpPoolId: string,
  poolId: string,
  withdrawnGolferId: string
): Promise<{
  entryId: string
  entryName: string
  participantName: string | null
  participantEmail: string | null
  userId: string | null
  editToken: string | null
  editTokenExpiresAt: string | null
  golferIds: string[]
}[]> {
  // Get all entries that have this golfer picked
  const { data: picksWithEntry } = await supabase
    .from('gp_entry_picks')
    .select(`
      entry_id,
      gp_entries!inner (
        id,
        entry_name,
        participant_name,
        participant_email,
        user_id,
        pool_id,
        edit_token,
        edit_token_expires_at
      )
    `)
    .eq('golfer_id', withdrawnGolferId)

  if (!picksWithEntry) return []

  // Filter to entries in this pool
  const entriesInPool = picksWithEntry.filter(p => {
    const entry = p.gp_entries as unknown as { pool_id: string }
    return entry.pool_id === poolId
  })

  // Get all picks for each affected entry
  const entryIds = entriesInPool.map(p => p.entry_id)
  const { data: allPicks } = await supabase
    .from('gp_entry_picks')
    .select('entry_id, golfer_id')
    .in('entry_id', entryIds)

  const picksByEntry = new Map<string, string[]>()
  for (const pick of allPicks ?? []) {
    if (!picksByEntry.has(pick.entry_id)) {
      picksByEntry.set(pick.entry_id, [])
    }
    picksByEntry.get(pick.entry_id)!.push(pick.golfer_id)
  }

  return entriesInPool.map(p => {
    const entry = p.gp_entries as unknown as {
      id: string
      entry_name: string
      participant_name: string | null
      participant_email: string | null
      user_id: string | null
      edit_token: string | null
      edit_token_expires_at: string | null
    }
    return {
      entryId: entry.id,
      entryName: entry.entry_name ?? 'Entry',
      participantName: entry.participant_name,
      participantEmail: entry.participant_email,
      userId: entry.user_id,
      editToken: entry.edit_token,
      editTokenExpiresAt: entry.edit_token_expires_at,
      golferIds: picksByEntry.get(entry.id) ?? [],
    }
  })
}

/**
 * Replace a golfer pick in an entry
 * @param supabase - Supabase client
 * @param entryId - The entry ID
 * @param oldGolferId - The golfer to remove
 * @param newGolferId - The golfer to add
 */
export async function replacePick(
  supabase: SupabaseClient<Database>,
  entryId: string,
  oldGolferId: string,
  newGolferId: string
): Promise<{ success: boolean; error?: string }> {
  // Delete the old pick
  const { error: deleteError } = await supabase
    .from('gp_entry_picks')
    .delete()
    .eq('entry_id', entryId)
    .eq('golfer_id', oldGolferId)

  if (deleteError) {
    return { success: false, error: `Failed to remove old pick: ${deleteError.message}` }
  }

  // Insert the new pick
  const { error: insertError } = await supabase
    .from('gp_entry_picks')
    .insert({
      entry_id: entryId,
      golfer_id: newGolferId,
    })

  if (insertError) {
    return { success: false, error: `Failed to add new pick: ${insertError.message}` }
  }

  return { success: true }
}

/**
 * Generate or get edit token for an entry
 * @param supabase - Supabase client
 * @param entryId - The entry ID
 * @param lockTime - The lock time for token expiration
 * @returns The edit token
 */
export async function ensureEditToken(
  supabase: SupabaseClient<Database>,
  entryId: string,
  lockTime: string | null
): Promise<string> {
  // Check if entry already has a valid token
  const { data: entry } = await supabase
    .from('gp_entries')
    .select('edit_token, edit_token_expires_at')
    .eq('id', entryId)
    .single()

  if (entry?.edit_token) {
    // Check if token is still valid
    const now = new Date()
    const expiresAt = entry.edit_token_expires_at ? new Date(entry.edit_token_expires_at) : null
    if (!expiresAt || expiresAt > now) {
      return entry.edit_token
    }
  }

  // Generate new token
  const newToken = crypto.randomUUID()
  const expiresAt = lockTime
    ? new Date(lockTime).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('gp_entries')
    .update({
      edit_token: newToken,
      edit_token_expires_at: expiresAt,
    })
    .eq('id', entryId)

  return newToken
}
