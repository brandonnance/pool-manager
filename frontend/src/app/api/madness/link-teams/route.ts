/**
 * @fileoverview March Madness Link Teams API Route
 * @route POST /api/madness/link-teams
 * @auth Requires commissioner role or super admin
 *
 * @description
 * Links loaded teams to pre-drawn position assignments. This is the second step
 * of the pre-draw flow:
 * 1. Position draw assigns region+seed to entries (no actual teams)
 * 2. Commissioner loads 64 teams via setup page
 * 3. This endpoint matches teams to entries by region+seed, generates games, locks pool
 *
 * @request_body
 * - mmPoolId: string - The mm_pools.id to link teams for
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAllTournamentGames } from '@/lib/madness'
import { checkSuperAdmin, checkOrgAdmin, checkPoolCommissioner } from '@/lib/permissions'

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

    // Get mm_pool and verify state
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

    if (!mmPool.draw_completed) {
      return NextResponse.json(
        { error: 'Position draw must be completed first' },
        { status: 400 }
      )
    }

    if (mmPool.teams_linked) {
      return NextResponse.json(
        { error: 'Teams already linked' },
        { status: 400 }
      )
    }

    // Verify user is commissioner
    const [{ data: profile }, { data: orgMembership }, { data: poolMembership }] = await Promise.all([
      supabase.from('profiles').select('is_super_admin').eq('id', user.id).single(),
      supabase.from('org_memberships').select('role').eq('org_id', mmPool.pools.org_id).eq('user_id', user.id).single(),
      supabase.from('pool_memberships').select('role').eq('pool_id', mmPool.pool_id).eq('user_id', user.id).single(),
    ])

    const isSuperAdmin = checkSuperAdmin(profile)
    const isOrgAdmin = checkOrgAdmin(orgMembership, isSuperAdmin)
    const isPoolCommissioner = checkPoolCommissioner(poolMembership, isOrgAdmin)

    if (!isPoolCommissioner) {
      return NextResponse.json(
        { error: 'Only commissioners can link teams' },
        { status: 403 }
      )
    }

    // Fetch teams and entries
    const [{ data: teams, error: teamsError }, { data: entries, error: entriesError }] = await Promise.all([
      supabase
        .from('mm_pool_teams')
        .select('id, seed, region, bb_teams(name)')
        .eq('mm_pool_id', mmPoolId),
      supabase
        .from('mm_entries')
        .select('id, display_name, assigned_region, assigned_seed')
        .eq('mm_pool_id', mmPoolId),
    ])

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

    // Build lookup: region+seed -> team
    const teamByPosition = new Map<string, (typeof teams)[number]>()
    for (const team of teams) {
      teamByPosition.set(`${team.region}-${team.seed}`, team)
    }

    // Match each entry to its team by assigned_region + assigned_seed
    const assignments: Array<{
      entry_id: string
      team_id: string
      display_name: string | null
      team_name: string
      seed: number
      region: string
    }> = []

    for (const entry of entries) {
      if (!entry.assigned_region || !entry.assigned_seed) {
        return NextResponse.json(
          { error: `Entry ${entry.id} (${entry.display_name}) has no position assignment. Run the position draw first.` },
          { status: 400 }
        )
      }

      const key = `${entry.assigned_region}-${entry.assigned_seed}`
      const team = teamByPosition.get(key)

      if (!team) {
        return NextResponse.json(
          { error: `No team found for position ${entry.assigned_region} #${entry.assigned_seed}` },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('mm_entries')
        .update({
          current_team_id: team.id,
          original_team_id: team.id,
        })
        .eq('id', entry.id)

      if (updateError) {
        return NextResponse.json(
          { error: `Failed to link team to entry ${entry.id}` },
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

    // Generate ALL 63 tournament games
    const allGames = generateAllTournamentGames(teams.map(t => ({
      id: t.id,
      seed: t.seed,
      region: t.region,
    })))

    for (const game of allGames) {
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

    // Mark teams as linked, transition pool to locked
    const [{ error: linkError }, { error: poolStatusError }] = await Promise.all([
      supabase
        .from('mm_pools')
        .update({ teams_linked: true })
        .eq('id', mmPoolId),
      supabase
        .from('pools')
        .update({ status: 'locked' })
        .eq('id', mmPool.pool_id),
    ])

    if (linkError || poolStatusError) {
      return NextResponse.json(
        { error: 'Teams linked but failed to update pool status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Teams linked and games generated successfully',
      assignments,
      games_created: allGames.length,
    })
  } catch (error) {
    console.error('Link teams error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
