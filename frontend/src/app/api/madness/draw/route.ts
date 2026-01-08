import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { shuffleArray, generateRound64Games } from '@/lib/madness'

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

    // Generate Round of 64 games
    const round64Games = generateRound64Games(teams.map(t => ({
      id: t.id,
      seed: t.seed,
      region: t.region,
    })))

    // Create game records
    for (const game of round64Games) {
      // Find entries for each team
      const higherSeedEntry = assignments.find(a => a.team_id === game.higher_seed_team_id)
      const lowerSeedEntry = assignments.find(a => a.team_id === game.lower_seed_team_id)

      const { error: gameError } = await supabase.from('mm_games').insert({
        mm_pool_id: mmPoolId,
        round: game.round,
        region: game.region,
        game_number: game.game_number,
        higher_seed_team_id: game.higher_seed_team_id,
        lower_seed_team_id: game.lower_seed_team_id,
        spread: game.spread,
        higher_seed_entry_id: higherSeedEntry?.entry_id,
        lower_seed_entry_id: lowerSeedEntry?.entry_id,
        status: 'scheduled',
      })

      if (gameError) {
        console.error('Error creating game:', gameError)
      }
    }

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
      games_created: round64Games.length,
    })
  } catch (error) {
    console.error('Draw error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
