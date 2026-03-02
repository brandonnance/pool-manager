import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Squares pool data fetching.
 * Loads sq_pools config, squares grid, games, winners, score changes, and owner profiles.
 */

export interface SquareForGrid {
  id: string
  row_index: number
  col_index: number
  user_id: string | null
  owner_name: string | null
  owner_initials: string | null
}

export interface PublicSquare {
  id: string
  row_index: number
  col_index: number
  participant_name: string | null
  verified: boolean
}

export async function getSquaresData(
  supabase: SupabaseClient<Database>,
  poolId: string
) {
  // Get sq_pool config
  const { data: sqPool } = await supabase
    .from('sq_pools')
    .select('*')
    .eq('pool_id', poolId)
    .single()

  if (!sqPool) {
    return {
      sqPoolData: null,
      sqSquaresData: [] as Array<{
        id: string; row_index: number; col_index: number;
        user_id: string | null; participant_name: string | null; verified: boolean | null
      }>,
      sqGamesData: [] as Array<{
        id: string; game_name: string; home_team: string; away_team: string;
        home_score: number | null; away_score: number | null;
        halftime_home_score: number | null; halftime_away_score: number | null;
        q1_home_score: number | null; q1_away_score: number | null;
        q3_home_score: number | null; q3_away_score: number | null;
        round: string; status: string | null; pays_halftime: boolean | null;
        display_order: number | null; espn_game_id: string | null;
        current_period: number | null; current_clock: string | null
      }>,
      sqWinnersData: [] as Array<{
        id: string; sq_game_id: string; square_id: string | null;
        win_type: string; payout: number | null; winner_name: string | null
      }>,
      sqScoreChangesData: [] as Array<{
        id: string; sq_game_id: string | null; home_score: number;
        away_score: number; change_order: number; created_at: string | null
      }>,
      squaresForGrid: [] as SquareForGrid[],
      publicSquares: [] as PublicSquare[],
    }
  }

  // Get all squares
  const { data: squares } = await supabase
    .from('sq_squares')
    .select('id, row_index, col_index, user_id, participant_name, verified')
    .eq('sq_pool_id', sqPool.id)
  const sqSquaresData = squares ?? []

  // Get owner profiles
  const sqOwnerProfiles = new Map<string, string | null>()
  const ownerIds = [...new Set(sqSquaresData.filter(s => s.user_id).map(s => s.user_id!))]
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', ownerIds)
    profiles?.forEach(p => sqOwnerProfiles.set(p.id, p.display_name))
  }

  // Get all games
  const { data: games } = await supabase
    .from('sq_games')
    .select('*')
    .eq('sq_pool_id', sqPool.id)
    .order('display_order', { ascending: true })
  const sqGamesData = games ?? []

  // Get all winners
  let sqWinnersData: Array<{
    id: string; sq_game_id: string; square_id: string | null;
    win_type: string; payout: number | null; winner_name: string | null
  }> = []
  let sqScoreChangesData: Array<{
    id: string; sq_game_id: string | null; home_score: number;
    away_score: number; change_order: number; created_at: string | null
  }> = []

  const gameIds = sqGamesData.map((g) => g.id)
  if (gameIds.length > 0) {
    const { data: winners } = await supabase
      .from('sq_winners')
      .select('*')
      .in('sq_game_id', gameIds)
    sqWinnersData = winners ?? []

    // Get score changes (for single_game mode with score_change or hybrid scoring)
    if (sqPool.mode === 'single_game' && (sqPool.scoring_mode === 'score_change' || sqPool.scoring_mode === 'hybrid')) {
      const { data: scoreChanges } = await supabase
        .from('sq_score_changes')
        .select('*')
        .in('sq_game_id', gameIds)
        .order('change_order', { ascending: true })
      sqScoreChangesData = scoreChanges ?? []
    }
  }

  // Transform squares data for authenticated grid
  const squaresForGrid: SquareForGrid[] = sqSquaresData.map((sq) => {
    const displayName = sq.user_id ? sqOwnerProfiles.get(sq.user_id) : null
    const initials = displayName
      ? displayName
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : null
    return {
      id: sq.id,
      row_index: sq.row_index,
      col_index: sq.col_index,
      user_id: sq.user_id,
      owner_name: displayName ?? null,
      owner_initials: initials,
    }
  })

  // Transform squares data for public-facing grid
  const publicSquares: PublicSquare[] = sqSquaresData.map((sq) => ({
    id: sq.id,
    row_index: sq.row_index,
    col_index: sq.col_index,
    participant_name: sq.participant_name,
    verified: sq.verified ?? false,
  }))

  return {
    sqPoolData: sqPool,
    sqSquaresData,
    sqGamesData,
    sqWinnersData,
    sqScoreChangesData,
    squaresForGrid,
    publicSquares,
  }
}
