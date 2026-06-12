import type { createClient } from '@/lib/supabase/client'

/**
 * Winner row passed to the atomic replace RPC.
 * Mirrors the sq_winners insert shape (id/created_at are server-generated).
 */
export interface WinnerInsert {
  square_id: string
  win_type: string
  winner_name: string | null
  payout?: number
}

interface ReplaceFilters {
  /** Only replace winners whose payout matches (used to scope to one change_order) */
  payout?: number
  /** Only replace winners whose win_type is in this list */
  winTypes?: string[]
}

/**
 * Atomically replace winners for a game via the replace_sq_game_winners RPC.
 * Without filters, all winners for the game are replaced; with filters, only
 * matching rows are deleted before the new set is inserted. Runs in a single
 * DB transaction, so a failure leaves existing winners untouched.
 */
export async function replaceGameWinners(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  winners: WinnerInsert[],
  filters?: ReplaceFilters
) {
  const { error } = await supabase.rpc('replace_sq_game_winners', {
    p_sq_game_id: gameId,
    p_winners: winners as unknown as Json[],
    p_filter_payout: filters?.payout,
    p_filter_win_types: filters?.winTypes,
  })
  return { error }
}

/**
 * Atomically delete a score change and all later ones, plus their winners,
 * via the delete_sq_score_changes_from RPC. includeFinalTypes also removes
 * final-score winner rows (when the deleted range included the final marker).
 */
export async function deleteScoreChangesFrom(
  supabase: ReturnType<typeof createClient>,
  gameId: string,
  fromChangeOrder: number,
  includeFinalTypes = false
) {
  const { error } = await supabase.rpc('delete_sq_score_changes_from', {
    p_sq_game_id: gameId,
    p_from_change_order: fromChangeOrder,
    p_include_final_types: includeFinalTypes,
  })
  return { error }
}

type Json = import('@/types/database').Json
