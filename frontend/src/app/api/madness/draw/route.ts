/**
 * @fileoverview March Madness Blind Draw API Route
 * @route POST /api/madness/draw
 * @auth Requires commissioner role or super admin
 *
 * @description
 * Executes the blind draw for a March Madness pool. Supports two modes:
 *
 * **Traditional mode** (64 teams loaded): Assigns actual teams to entries,
 * generates all 63 tournament games, and locks the pool.
 *
 * **Pre-draw mode** (0 teams loaded): Assigns bracket positions (region + seed)
 * to entries without actual team names. Teams are linked later via /api/madness/link-teams.
 *
 * Both modes use region-aware multi-entry logic to ensure participants with
 * multiple entries get teams/positions from distinct regions.
 *
 * @request_body
 * - mmPoolId: string - The mm_pools.id to run the draw for
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { shuffleArray, generateAllTournamentGames } from '@/lib/madness'
import { checkSuperAdmin, checkOrgAdmin, checkPoolCommissioner } from '@/lib/permissions'
import { VALID_REGIONS } from '@/lib/madness/validation'

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

    const teamCount = teams?.length ?? 0

    // Must have exactly 0 (pre-draw) or 64 (traditional) teams
    if (teamCount !== 0 && teamCount !== 64) {
      return NextResponse.json(
        { error: `Need exactly 0 or 64 teams (have ${teamCount}). Finish adding teams or remove them all for a position draw.` },
        { status: 400 }
      )
    }

    if (!entries || entries.length !== 64) {
      return NextResponse.json(
        { error: `Need exactly 64 entries (have ${entries?.length ?? 0})` },
        { status: 400 }
      )
    }

    const isPreDraw = teamCount === 0

    // Group entries by display_name (case-insensitive) to detect multi-entry participants
    const entriesByName: Record<string, typeof entries> = {}
    for (const entry of entries) {
      const key = (entry.display_name ?? entry.id).toLowerCase().trim()
      if (!entriesByName[key]) entriesByName[key] = []
      entriesByName[key].push(entry)
    }

    // Process multi-entry groups first (most entries first), then single-entry
    const multiGroups = Object.values(entriesByName)
      .filter(g => g.length > 1)
      .sort((a, b) => b.length - a.length)
    const singleGroups = Object.values(entriesByName).filter(g => g.length === 1)

    if (isPreDraw) {
      // ===== PRE-DRAW MODE: Assign positions (region + seed) only =====
      const regions = [...VALID_REGIONS]

      // Build position slots: 4 regions × 16 seeds, shuffle within each region
      const slotsByRegion: Record<string, Array<{ region: string; seed: number }>> = {}
      for (const region of regions) {
        slotsByRegion[region] = shuffleArray(
          Array.from({ length: 16 }, (_, i) => ({ region, seed: i + 1 }))
        )
      }

      const positionAssignments: Array<{
        entry_id: string
        display_name: string | null
        region: string
        seed: number
      }> = []

      // Multi-entry: each entry in group gets a distinct region
      for (const group of multiGroups) {
        const shuffledRegions = shuffleArray([...regions])
        for (let i = 0; i < group.length; i++) {
          const region = shuffledRegions[i]
          const slot = slotsByRegion[region].pop()!
          const { error: updateError } = await supabase
            .from('mm_entries')
            .update({ assigned_region: slot.region, assigned_seed: slot.seed })
            .eq('id', group[i].id)

          if (updateError) {
            return NextResponse.json(
              { error: `Failed to assign position to entry ${group[i].id}` },
              { status: 500 }
            )
          }

          positionAssignments.push({
            entry_id: group[i].id,
            display_name: group[i].display_name,
            region: slot.region,
            seed: slot.seed,
          })
        }
      }

      // Single-entry: assign from remaining slots randomly
      const remainingSlots = shuffleArray(regions.flatMap(r => slotsByRegion[r]))
      for (let i = 0; i < singleGroups.length; i++) {
        const entry = singleGroups[i][0]
        const slot = remainingSlots[i]
        const { error: updateError } = await supabase
          .from('mm_entries')
          .update({ assigned_region: slot.region, assigned_seed: slot.seed })
          .eq('id', entry.id)

        if (updateError) {
          return NextResponse.json(
            { error: `Failed to assign position to entry ${entry.id}` },
            { status: 500 }
          )
        }

        positionAssignments.push({
          entry_id: entry.id,
          display_name: entry.display_name,
          region: slot.region,
          seed: slot.seed,
        })
      }

      // Mark draw completed but teams NOT linked; pool stays open for team loading
      const [{ error: completeError }, { error: poolStatusError }] = await Promise.all([
        supabase
          .from('mm_pools')
          .update({
            draw_completed: true,
            draw_completed_at: new Date().toISOString(),
            teams_linked: false,
          })
          .eq('id', mmPoolId),
        supabase
          .from('pools')
          .update({ status: 'open' })
          .eq('id', mmPool.pool_id),
      ])

      if (completeError || poolStatusError) {
        return NextResponse.json(
          { error: 'Position draw completed but failed to update status' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        mode: 'pre_draw',
        message: 'Position draw completed. Load teams and link them to finish setup.',
        assignments: positionAssignments,
      })
    }

    // ===== TRADITIONAL MODE: Assign actual teams + generate games =====
    const assignments: Array<{
      entry_id: string
      team_id: string
      display_name: string | null
      team_name: string
      seed: number
      region: string
    }> = []

    // Group teams by region and shuffle within each region
    const teamsByRegion: Record<string, typeof teams> = {}
    for (const team of teams!) {
      if (!teamsByRegion[team.region]) teamsByRegion[team.region] = []
      teamsByRegion[team.region].push(team)
    }
    const regions = Object.keys(teamsByRegion)
    for (const region of regions) {
      teamsByRegion[region] = shuffleArray(teamsByRegion[region])
    }

    // Build ordered list: multi-entry assignments with distinct regions, then singles
    const orderedPairs: Array<{ entry: (typeof entries)[number]; team: (typeof teams extends null ? never : NonNullable<typeof teams>)[number] }> = []

    for (const group of multiGroups) {
      const shuffledRegions = shuffleArray([...regions])
      for (let i = 0; i < group.length; i++) {
        const region = shuffledRegions[i]
        const team = teamsByRegion[region].pop()!
        orderedPairs.push({ entry: group[i], team })
      }
    }

    const remainingTeams = shuffleArray(regions.flatMap(r => teamsByRegion[r]))
    for (let i = 0; i < singleGroups.length; i++) {
      orderedPairs.push({ entry: singleGroups[i][0], team: remainingTeams[i] })
    }

    // Update each entry with their assigned team (and position for consistency)
    for (const { entry, team } of orderedPairs) {
      const { error: updateError } = await supabase
        .from('mm_entries')
        .update({
          current_team_id: team.id,
          original_team_id: team.id,
          assigned_region: team.region,
          assigned_seed: team.seed,
        })
        .eq('id', entry.id)

      if (updateError) {
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
    const allGames = generateAllTournamentGames(teams!.map(t => ({
      id: t.id,
      seed: t.seed,
      region: t.region,
    })))

    // Create game records
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

    const r64Count = allGames.filter(g => g.round === 'R64').length

    // Mark draw as completed AND teams linked; transition pool to locked
    const [{ error: completeError }, { error: poolStatusError }] = await Promise.all([
      supabase
        .from('mm_pools')
        .update({
          draw_completed: true,
          draw_completed_at: new Date().toISOString(),
          teams_linked: true,
        })
        .eq('id', mmPoolId),
      supabase
        .from('pools')
        .update({ status: 'locked' })
        .eq('id', mmPool.pool_id),
    ])

    if (completeError || poolStatusError) {
      return NextResponse.json(
        { error: 'Draw completed but failed to update status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      mode: 'traditional',
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
