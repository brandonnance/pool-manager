import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { NdWeek, NdGame } from '@/lib/desperation/types'
import { pickCurrentWeek } from '@/lib/desperation/schedule'
import { sumSeasonPoints } from '@/lib/desperation/scoring'

/**
 * NFL Desperation dashboard data (commissioner view).
 * Runs with the caller's session client — RLS limits nd_entries/nd_week_scores
 * to commissioners, so a plain member sees the pool shell only.
 */

export type NdDashboardEntry = {
  id: string
  email: string
  display_name: string | null
  access_token: string
  active: boolean
  joined_week: number
  invite_sent_at: string | null
  last_seen_at: string | null
  created_at: string
}

export async function getDesperationData(
  supabase: SupabaseClient<Database>,
  poolId: string
) {
  const { data: ndPool } = await supabase
    .from('nd_pools')
    .select('*')
    .eq('pool_id', poolId)
    .maybeSingle()

  if (!ndPool) {
    return {
      ndPoolData: null,
      ndWeeks: [] as NdWeek[],
      ndCurrentWeek: null as NdWeek | null,
      ndCurrentGames: [] as NdGame[],
      ndEntries: [] as NdDashboardEntry[],
      ndSeasonTotals: {} as Record<string, number>,
    }
  }

  const [{ data: weeksRaw }, { data: entriesRaw }] = await Promise.all([
    supabase
      .from('nd_weeks')
      .select('id, season_year, week_number, lock_at, first_kickoff_at, last_kickoff_at, status, finalized_at')
      .eq('season_year', ndPool.season_year)
      .order('week_number'),
    supabase
      .from('nd_entries')
      .select('id, email, display_name, access_token, active, joined_week, invite_sent_at, last_seen_at, created_at')
      .eq('nd_pool_id', ndPool.id)
      .order('created_at'),
  ])

  const ndWeeks = (weeksRaw ?? []) as NdWeek[]
  const ndCurrentWeek = pickCurrentWeek(ndWeeks)

  const { data: gamesRaw } = ndCurrentWeek
    ? await supabase
        .from('nd_games')
        .select('id, season_year, week_number, espn_game_id, home_team, home_abbr, home_logo, away_team, away_abbr, away_logo, kickoff_at, venue, neutral_site, home_score, away_score, status, period, clock, winner, qualifies, last_synced_at')
        .eq('season_year', ndCurrentWeek.season_year)
        .eq('week_number', ndCurrentWeek.week_number)
        .order('kickoff_at')
    : { data: [] }

  const ndEntries = (entriesRaw ?? []) as NdDashboardEntry[]

  // Season total = finalized weeks only, same rule as the player board
  const { data: scoresRaw } = ndEntries.length
    ? await supabase
        .from('nd_week_scores')
        .select('entry_id, points, finalized')
        .in('entry_id', ndEntries.map((e) => e.id))
        .eq('season_year', ndPool.season_year)
        .eq('finalized', true)
    : { data: [] }

  const ndSeasonTotals: Record<string, number> = Object.fromEntries(sumSeasonPoints(scoresRaw ?? []))

  return {
    ndPoolData: ndPool,
    ndWeeks,
    ndCurrentWeek,
    ndCurrentGames: (gamesRaw ?? []) as NdGame[],
    ndEntries,
    ndSeasonTotals,
  }
}
