/**
 * @fileoverview March Madness Blind Draw API Route
 * @route POST /api/madness/draw
 * @auth Requires commissioner role or super admin
 *
 * @description
 * Executes the blind draw for a March Madness pool. This randomly assigns
 * the 64 tournament teams to the 64 entries. Also generates all 63 tournament
 * games (R64, R32, S16, E8, F4, FINAL) with appropriate spreads.
 *
 * @preconditions
 * - Pool must have exactly 64 teams in mm_pool_teams
 * - Pool must have exactly 64 approved entries in mm_entries
 * - Draw must not already be completed (draw_completed = false)
 *
 * @features
 * - Randomly shuffle teams using Fisher-Yates algorithm
 * - Assign each team to an entry (current_team_id and original_team_id)
 * - Generate all 63 tournament games with bracket structure
 * - R64 games get team and entry assignments
 * - Later round games have null teams/entries (populated when games finish)
 * - Mark pool as draw_completed with timestamp
 *
 * @request_body
 * - mmPoolId: string - The mm_pools.id to run the draw for
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { shuffleArray, generateAllTournamentGames } from '@/lib/madness'

/**
 * POST handler for executing the March Madness blind draw
 *
 * @param request - Next.js request object containing mmPoolId
 * @returns JSON response with assignments and game creation results
 *
 * @flow
 * 1. Validate mmPoolId is provided
 * 2. Authenticate user
 * 3. Fetch mm_pool and verify draw not already completed
 * 4. Verify user is commissioner (pool, org, or super admin)
 * 5. Fetch all 64 teams and 64 entries
 * 6. Validate exactly 64 of each
 * 7. Shuffle teams randomly
 * 8. Assign each shuffled team to an entry
 * 9. Generate all 63 tournament games
 * 10. Create game records (R64 with teams/entries, others empty)
 * 11. Mark draw_completed = true
 * 12. Return assignments and game count
 */
export async function POST(request: NextRequest) {
  try {
    const { mmPoolId } = await request.json()

    if (!mmPoolId) {
      return NextResponse.json(
        { error: 'Missing mmPoolId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get mm_pool and verify draw not already completed
    const { data: mmPool, error: poolError } = await supabase
      .from('mm_pools')
      .select('*, pools!inner(org_id)')
      .eq('id', mmPoolId)
      .single()

    if (poolError || !mmPool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      )
    }

    if (mmPool.draw_completed) {
      return NextResponse.json(
        { error: 'Draw already completed' },
        { status: 400 }
      )
    }

    // Verify user is commissioner
    const { data: poolMembership } = await supabase
      .from('pool_memberships')
      .select('role')
      .eq('pool_id', mmPool.pool_id)
      .eq('user_id', user.id)
      .single()

    const { data: orgMembership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', mmPool.pools.org_id)
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const isSuperAdmin = profile?.is_super_admin ?? false
    const isOrgAdmin = orgMembership?.role === 'admin' || isSuperAdmin
    const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin

    if (!isPoolCommissioner) {
      return NextResponse.json(
        { error: 'Only commissioners can run the draw' },
        { status: 403 }
      )
    }

    // Get teams and entries
    const { data: teams, error: teamsError } = await supabase
      .from('mm_pool_teams')
      .select('id, seed, region, bb_teams(name)')
      .eq('mm_pool_id', mmPoolId)

    const { data: entries, error: entriesError } = await supabase
      .from('mm_entries')
      .select('id, display_name')
      .eq('mm_pool_id', mmPoolId)

    if (teamsError || entriesError) {
      return NextResponse.json(
        { error: 'Failed to fetch teams or entries' },
        { status: 500 }
      )
    }

    if (!teams || teams.length !== 64) {
      return NextResponse.json(
        { error: `Need exactly 64 teams (have ${teams?.length ?? 0})` },
        { status: 400 }
      )
    }

    if (!entries || entries.length !== 64) {
      return NextResponse.json(
        { error: `Need exactly 64 entries (have ${entries?.length ?? 0})` },
        { status: 400 }
      )
    }

    // Shuffle teams and assign to entries
    const shuffledTeams = shuffleArray(teams)
    const assignments: Array<{
      entry_id: string
      team_id: string
      display_name: string | null
      team_name: string
      seed: number
      region: string
    }> = []

    // Update each entry with their assigned team
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const team = shuffledTeams[i]

      const { error: updateError } = await supabase
        .from('mm_entries')
        .update({
          current_team_id: team.id,
          original_team_id: team.id,
        })
        .eq('id', entry.id)

      if (updateError) {
        console.error('Error assigning team to entry:', updateError)
        return NextResponse.json(
          { error: `Failed to assign team to entry ${entry.id}` },
          { status: 500 }
        )
      }

      assignments.push({
        entry_id: entry.id,
        team_id: team.id,
        display_name: entry.display_name,
        team_name: team.bb_teams?.name ?? 'Unknown',
        seed: team.seed,
        region: team.region,
      })
    }

    // Generate ALL 63 tournament games (R64 through FINAL)
    const allGames = generateAllTournamentGames(teams.map(t => ({
      id: t.id,
      seed: t.seed,
      region: t.region,
    })))

    // Create game records
    for (const game of allGames) {
      // For R64 games, find entries for each team
      // Later rounds have null teams/entries until populated by trigger
      let higherSeedEntryId: string | undefined
      let lowerSeedEntryId: string | undefined

      if (game.round === 'R64' && game.higher_seed_team_id && game.lower_seed_team_id) {
        const higherSeedEntry = assignments.find(a => a.team_id === game.higher_seed_team_id)
        const lowerSeedEntry = assignments.find(a => a.team_id === game.lower_seed_team_id)
        higherSeedEntryId = higherSeedEntry?.entry_id
        lowerSeedEntryId = lowerSeedEntry?.entry_id
      }

      const { error: gameError } = await supabase.from('mm_games').insert({
        mm_pool_id: mmPoolId,
        round: game.round,
        region: game.region,
        game_number: game.game_number,
        higher_seed_team_id: game.higher_seed_team_id,
        lower_seed_team_id: game.lower_seed_team_id,
        spread: game.spread,
        higher_seed_entry_id: higherSeedEntryId,
        lower_seed_entry_id: lowerSeedEntryId,
        status: 'scheduled',
      })

      if (gameError) {
        console.error('Error creating game:', gameError)
      }
    }

    const r64Count = allGames.filter(g => g.round === 'R64').length

    // Mark draw as completed
    const { error: completeError } = await supabase
      .from('mm_pools')
      .update({
        draw_completed: true,
        draw_completed_at: new Date().toISOString(),
      })
      .eq('id', mmPoolId)

    if (completeError) {
      console.error('Error marking draw complete:', completeError)
      return NextResponse.json(
        { error: 'Draw completed but failed to update status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Draw completed successfully',
      assignments,
      games_created: allGames.length,
      r64_games: r64Count,
    })
  } catch (error) {
    console.error('Draw error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
