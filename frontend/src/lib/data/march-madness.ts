import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * March Madness pool data fetching.
 * Loads mm_pools config, entries, pool teams with team names, and games.
 */

export async function getMarchMadnessData(
  supabase: SupabaseClient<Database>,
  poolId: string
) {
  // Get mm_pool config
  const { data: mmPool } = await supabase
    .from('mm_pools')
    .select('*')
    .eq('pool_id', poolId)
    .single()

  if (!mmPool) {
    return {
      mmPoolData: null,
      mmEntriesData: [] as Array<{
        id: string; mm_pool_id: string; user_id: string | null;
        current_team_id: string | null; original_team_id: string | null;
        eliminated: boolean; eliminated_round: string | null;
        display_name: string | null; total_payout: number
      }>,
      mmPoolTeamsData: [] as Array<{
        id: string; mm_pool_id: string; team_id: string; seed: number;
        region: string; eliminated: boolean; eliminated_round: string | null;
        bb_teams: { id: string; name: string; abbrev: string | null } | null
      }>,
      mmGamesData: [] as Array<{
        id: string; mm_pool_id: string; round: string; region: string | null;
        game_number: number | null; higher_seed_team_id: string | null;
        lower_seed_team_id: string | null; spread: number | null;
        higher_seed_score: number | null; lower_seed_score: number | null;
        status: string; winning_team_id: string | null;
        spread_covering_team_id: string | null;
        higher_seed_entry_id: string | null; lower_seed_entry_id: string | null;
        advancing_entry_id: string | null; scheduled_time: string | null
      }>,
    }
  }

  // Get all entries
  const { data: entries } = await supabase
    .from('mm_entries')
    .select('*')
    .eq('mm_pool_id', mmPool.id)

  // Get all pool teams with team names
  const { data: poolTeams } = await supabase
    .from('mm_pool_teams')
    .select('*, bb_teams (id, name, abbrev)')
    .eq('mm_pool_id', mmPool.id)
    .order('region')
    .order('seed')

  // Get all games
  const { data: games } = await supabase
    .from('mm_games')
    .select('*')
    .eq('mm_pool_id', mmPool.id)
    .order('round')
    .order('game_number')

  return {
    mmPoolData: mmPool,
    mmEntriesData: entries ?? [],
    mmPoolTeamsData: poolTeams ?? [],
    mmGamesData: games ?? [],
  }
}
