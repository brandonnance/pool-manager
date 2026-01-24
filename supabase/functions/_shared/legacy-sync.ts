/**
 * @fileoverview Legacy Sync Functions
 *
 * Syncs global event_state data to legacy tables for backward compatibility.
 * This allows the new worker to keep legacy tables updated while the UI
 * continues to read from them during shadow mode.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { GolfTournamentPayload, GolfLeaderboardEntry } from './types.ts'

interface GolferMapping {
  external_player_id: string
  golfer_id: string
}

interface LegacyGolferResult {
  tournament_id: string
  golfer_id: string
  round_1: number | null
  round_2: number | null
  round_3: number | null
  round_4: number | null
  total_score: number
  made_cut: boolean
  position: string
  thru: number | null
  to_par: number
  updated_at: string
}

/**
 * Syncs golf tournament leaderboard to legacy gp_golfer_results table.
 *
 * @param supabase - Service client with write access
 * @param providerEventId - The SlashGolf tournament ID (e.g., "002")
 * @param payload - The golf tournament payload from event_state
 * @returns Number of results synced, or error
 */
export async function syncGolfToLegacy(
  supabase: SupabaseClient,
  providerEventId: string,
  payload: GolfTournamentPayload
): Promise<{ synced: number; error?: string }> {
  try {
    // 1. Find the legacy tournament by external_tournament_id
    const { data: tournament, error: tournError } = await supabase
      .from('gp_tournaments')
      .select('id, par')
      .eq('external_tournament_id', providerEventId)
      .single()

    if (tournError || !tournament) {
      // No legacy tournament linked - this is fine, just skip sync
      console.log(`[legacy-sync] No legacy tournament found for ${providerEventId}, skipping sync`)
      return { synced: 0 }
    }

    const par = tournament.par || 72

    // 2. Get all golfers in this tournament's field with their external IDs
    const { data: fieldGolfers, error: fieldError } = await supabase
      .from('gp_tournament_field')
      .select(`
        golfer_id,
        gp_golfers!inner (
          id,
          external_player_id
        )
      `)
      .eq('tournament_id', tournament.id)

    if (fieldError) {
      console.error('[legacy-sync] Error fetching tournament field:', fieldError)
      return { synced: 0, error: fieldError.message }
    }

    if (!fieldGolfers || fieldGolfers.length === 0) {
      console.log(`[legacy-sync] No golfers in field for tournament ${providerEventId}`)
      return { synced: 0 }
    }

    // 3. Build mapping of external_player_id -> golfer_id
    const golferMap = new Map<string, string>()
    for (const f of fieldGolfers) {
      const golfer = f.gp_golfers as unknown as GolferMapping
      if (golfer.external_player_id) {
        golferMap.set(golfer.external_player_id, golfer.id)
      }
    }

    console.log(`[legacy-sync] Found ${golferMap.size} golfers with external IDs in field`)

    // 4. Transform leaderboard entries to legacy format
    const upserts: LegacyGolferResult[] = []

    for (const entry of payload.leaderboard) {
      const golferId = golferMap.get(entry.player_id)
      if (!golferId) {
        // Golfer not in our field - skip
        continue
      }

      const madeCut = entry.status !== 'cut'

      // Calculate total strokes
      let totalStrokes = 0
      let roundsPlayed = 0

      // Use total_strokes from API if available
      if (entry.total_strokes !== undefined && !isNaN(entry.total_strokes)) {
        totalStrokes = entry.total_strokes
        if (entry.rounds.round1 !== undefined) roundsPlayed++
        if (entry.rounds.round2 !== undefined) roundsPlayed++
        if (entry.rounds.round3 !== undefined) roundsPlayed++
        if (entry.rounds.round4 !== undefined) roundsPlayed++
      } else {
        // Calculate from individual rounds
        if (entry.rounds.round1 !== undefined) {
          totalStrokes += entry.rounds.round1
          roundsPlayed++
        }
        if (entry.rounds.round2 !== undefined) {
          totalStrokes += entry.rounds.round2
          roundsPlayed++
        }
        if (entry.rounds.round3 !== undefined) {
          totalStrokes += entry.rounds.round3
          roundsPlayed++
        }
        if (entry.rounds.round4 !== undefined) {
          totalStrokes += entry.rounds.round4
          roundsPlayed++
        }
      }

      // Add penalty for missed cut (80 each for R3 and R4)
      if (!madeCut && roundsPlayed === 2) {
        totalStrokes += 80 + 80
      }

      // Convert thru to number
      let thruHoles: number | null = null
      if (entry.thru !== undefined && entry.thru !== null) {
        if (typeof entry.thru === 'number') {
          thruHoles = entry.thru
        } else if (entry.thru === 'F' || entry.thru === 'f') {
          thruHoles = 18
        } else {
          const parsed = parseInt(String(entry.thru))
          if (!isNaN(parsed)) {
            thruHoles = parsed
          }
        }
      }

      upserts.push({
        tournament_id: tournament.id,
        golfer_id: golferId,
        round_1: entry.rounds.round1 ?? null,
        round_2: entry.rounds.round2 ?? null,
        round_3: entry.rounds.round3 ?? null,
        round_4: entry.rounds.round4 ?? null,
        total_score: totalStrokes,
        made_cut: madeCut,
        position: entry.position || '-',
        thru: thruHoles,
        to_par: entry.to_par,
        updated_at: new Date().toISOString(),
      })
    }

    if (upserts.length === 0) {
      console.log(`[legacy-sync] No golfers matched for tournament ${providerEventId}`)
      return { synced: 0 }
    }

    // 5. Upsert to gp_golfer_results
    const { error: upsertError } = await supabase
      .from('gp_golfer_results')
      .upsert(upserts, {
        onConflict: 'tournament_id,golfer_id',
      })

    if (upsertError) {
      console.error('[legacy-sync] Error upserting results:', upsertError)
      return { synced: 0, error: upsertError.message }
    }

    // 6. Update tournament status
    let newStatus: string | null = null
    if (payload.round_status === 'official' || (payload.round_status === 'complete' && payload.current_round === 4)) {
      newStatus = 'completed'
    } else if (payload.leaderboard.length > 0 && payload.round_status !== 'not_started') {
      newStatus = 'in_progress'
    }

    if (newStatus) {
      await supabase
        .from('gp_tournaments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', tournament.id)
    }

    console.log(`[legacy-sync] Synced ${upserts.length} golfer results for tournament ${providerEventId}`)
    return { synced: upserts.length }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[legacy-sync] Error:', errorMessage)
    return { synced: 0, error: errorMessage }
  }
}
