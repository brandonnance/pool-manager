import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  DEMO_TEAMS,
  DEMO_PLAYER_NAMES,
  simulateRound,
  shuffleArray,
} from '@/lib/madness'

type DemoAction = 'seed' | 'seed_teams' | 'seed_entries' | 'simulate_round' | 'reset'

export async function POST(request: NextRequest) {
  try {
    const { mmPoolId, action } = await request.json() as { mmPoolId: string; action: DemoAction }

    if (!mmPoolId || !action) {
      return NextResponse.json(
        { error: 'Missing mmPoolId or action' },
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

    // Get mm_pool
    const { data: mmPool, error: poolError } = await supabase
      .from('mm_pools')
      .select('*, pools!inner(org_id, demo_mode)')
      .eq('id', mmPoolId)
      .single()

    if (poolError || !mmPool) {
      return NextResponse.json(
        { error: 'Pool not found' },
        { status: 404 }
      )
    }

    // Only allow demo actions on demo pools (optional safety check)
    // Commented out for now - allow on any pool for testing
    // if (!mmPool.pools.demo_mode) {
    //   return NextResponse.json(
    //     { error: 'Demo actions only allowed on demo pools' },
    //     { status: 403 }
    //   )
    // }

    // Verify user is commissioner
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const isSuperAdmin = profile?.is_super_admin ?? false

    if (!isSuperAdmin) {
      // Check pool/org membership for non-super admins
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

      const isOrgAdmin = orgMembership?.role === 'admin'
      const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin

      if (!isPoolCommissioner) {
        return NextResponse.json(
          { error: 'Only commissioners can run demo actions' },
          { status: 403 }
        )
      }
    }

    switch (action) {
      case 'seed':
        return await seedDemoData(supabase, mmPoolId, mmPool.pool_id)

      case 'seed_teams':
        return await seedDemoTeams(supabase, mmPoolId)

      case 'seed_entries':
        return await seedDemoEntries(supabase, mmPoolId)

      case 'simulate_round':
        return await simulateNextRound(supabase, mmPoolId)

      case 'reset':
        return await resetPool(supabase, mmPoolId)

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Demo action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function seedDemoData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mmPoolId: string,
  poolId: string
) {
  // Check if teams already exist
  const { count: existingTeams } = await supabase
    .from('mm_pool_teams')
    .select('*', { count: 'exact', head: true })
    .eq('mm_pool_id', mmPoolId)

  if (existingTeams && existingTeams > 0) {
    return NextResponse.json(
      { error: 'Teams already exist. Reset first.' },
      { status: 400 }
    )
  }

  // Get or create bb_teams for demo teams
  const teamIds: Map<string, string> = new Map()

  for (const demoTeam of DEMO_TEAMS) {
    // Check if team exists
    let { data: existingTeam } = await supabase
      .from('bb_teams')
      .select('id')
      .eq('name', demoTeam.name)
      .single()

    if (!existingTeam) {
      // Create team
      const { data: newTeam, error } = await supabase
        .from('bb_teams')
        .insert({ name: demoTeam.name, abbrev: demoTeam.abbrev })
        .select('id')
        .single()

      if (error) {
        console.error('Error creating team:', error)
        continue
      }
      existingTeam = newTeam
    }

    if (existingTeam) {
      teamIds.set(`${demoTeam.region}-${demoTeam.seed}`, existingTeam.id)
    }
  }

  // Create mm_pool_teams
  const poolTeamsToInsert = DEMO_TEAMS.map(demoTeam => ({
    mm_pool_id: mmPoolId,
    team_id: teamIds.get(`${demoTeam.region}-${demoTeam.seed}`)!,
    seed: demoTeam.seed,
    region: demoTeam.region,
  })).filter(t => t.team_id)

  const { error: poolTeamsError } = await supabase
    .from('mm_pool_teams')
    .insert(poolTeamsToInsert)

  if (poolTeamsError) {
    console.error('Error creating pool teams:', poolTeamsError)
    return NextResponse.json(
      { error: 'Failed to create pool teams' },
      { status: 500 }
    )
  }

  // Create 64 demo entries
  const shuffledNames = shuffleArray(DEMO_PLAYER_NAMES)
  const entriesToInsert = shuffledNames.map(name => ({
    mm_pool_id: mmPoolId,
    user_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
    display_name: name,
  }))

  // Create a demo user or use system user
  const { error: entriesError } = await supabase
    .from('mm_entries')
    .insert(entriesToInsert)

  if (entriesError) {
    console.error('Error creating entries:', entriesError)
    // Continue anyway - entries can be added manually
  }

  return NextResponse.json({
    success: true,
    message: 'Demo data seeded successfully',
    teams_created: poolTeamsToInsert.length,
    entries_created: entriesError ? 0 : shuffledNames.length,
  })
}

async function simulateNextRound(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mmPoolId: string
) {
  // Get games that haven't been played yet
  const { data: pendingGames, error } = await supabase
    .from('mm_games')
    .select('*')
    .eq('mm_pool_id', mmPoolId)
    .neq('status', 'final')
    .not('higher_seed_team_id', 'is', null)
    .not('lower_seed_team_id', 'is', null)
    .order('round')
    .order('game_number')

  if (error || !pendingGames || pendingGames.length === 0) {
    return NextResponse.json(
      { error: 'No games to simulate' },
      { status: 400 }
    )
  }

  // Get the current round (first pending round)
  const currentRound = pendingGames[0].round
  const roundGames = pendingGames.filter(g => g.round === currentRound)

  // Simulate scores
  const results = simulateRound(roundGames)

  // Update games with simulated scores
  for (const result of results) {
    const { error: updateError } = await supabase
      .from('mm_games')
      .update({
        higher_seed_score: result.higher_seed_score,
        lower_seed_score: result.lower_seed_score,
        status: 'final',
      })
      .eq('id', result.game_id)

    if (updateError) {
      console.error('Error updating game:', updateError)
    }
  }

  return NextResponse.json({
    success: true,
    message: `Simulated ${results.length} games in ${currentRound}`,
    round: currentRound,
    games_simulated: results.length,
    results,
  })
}

async function resetPool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mmPoolId: string
) {
  // Delete games
  await supabase.from('mm_games').delete().eq('mm_pool_id', mmPoolId)

  // Delete payouts
  await supabase.from('mm_entry_payouts').delete().eq('mm_pool_id', mmPoolId)

  // Reset entries (clear team assignments, reset elimination)
  await supabase
    .from('mm_entries')
    .update({
      current_team_id: null,
      original_team_id: null,
      eliminated: false,
      eliminated_round: null,
      total_payout: 0,
    })
    .eq('mm_pool_id', mmPoolId)

  // Reset pool teams (clear elimination)
  await supabase
    .from('mm_pool_teams')
    .update({
      eliminated: false,
      eliminated_round: null,
    })
    .eq('mm_pool_id', mmPoolId)

  // Reset pool draw status
  await supabase
    .from('mm_pools')
    .update({
      draw_completed: false,
      draw_completed_at: null,
    })
    .eq('id', mmPoolId)

  return NextResponse.json({
    success: true,
    message: 'Pool reset to post-setup state',
  })
}

async function seedDemoTeams(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mmPoolId: string
) {
  // Check if teams already exist
  const { count: existingTeams } = await supabase
    .from('mm_pool_teams')
    .select('*', { count: 'exact', head: true })
    .eq('mm_pool_id', mmPoolId)

  if (existingTeams && existingTeams > 0) {
    return NextResponse.json(
      { error: 'Teams already exist. Reset the pool first or delete existing teams.' },
      { status: 400 }
    )
  }

  // Get or create bb_teams for demo teams
  const teamIds: Map<string, string> = new Map()

  for (const demoTeam of DEMO_TEAMS) {
    // Check if team exists
    let { data: existingTeam } = await supabase
      .from('bb_teams')
      .select('id')
      .eq('name', demoTeam.name)
      .single()

    if (!existingTeam) {
      // Create team
      const { data: newTeam, error } = await supabase
        .from('bb_teams')
        .insert({ name: demoTeam.name, abbrev: demoTeam.abbrev })
        .select('id')
        .single()

      if (error) {
        console.error('Error creating team:', error)
        continue
      }
      existingTeam = newTeam
    }

    if (existingTeam) {
      teamIds.set(`${demoTeam.region}-${demoTeam.seed}`, existingTeam.id)
    }
  }

  // Create mm_pool_teams
  const poolTeamsToInsert = DEMO_TEAMS.map(demoTeam => ({
    mm_pool_id: mmPoolId,
    team_id: teamIds.get(`${demoTeam.region}-${demoTeam.seed}`)!,
    seed: demoTeam.seed,
    region: demoTeam.region,
  })).filter(t => t.team_id)

  const { error: poolTeamsError } = await supabase
    .from('mm_pool_teams')
    .insert(poolTeamsToInsert)

  if (poolTeamsError) {
    console.error('Error creating pool teams:', poolTeamsError)
    return NextResponse.json(
      { error: 'Failed to create pool teams' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Demo bracket seeded with 64 teams',
    teams_created: poolTeamsToInsert.length,
  })
}

async function seedDemoEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mmPoolId: string
) {
  // Check current entry count
  const { count: existingEntries } = await supabase
    .from('mm_entries')
    .select('*', { count: 'exact', head: true })
    .eq('mm_pool_id', mmPoolId)
    .eq('status', 'approved')

  const currentCount = existingEntries ?? 0
  const spotsRemaining = 64 - currentCount

  if (spotsRemaining <= 0) {
    return NextResponse.json(
      { error: 'Pool already has 64 entries' },
      { status: 400 }
    )
  }

  // Get existing names to avoid duplicates
  const { data: existingNames } = await supabase
    .from('mm_entries')
    .select('display_name')
    .eq('mm_pool_id', mmPoolId)

  const usedNames = new Set(existingNames?.map(e => e.display_name?.toLowerCase()) ?? [])

  // Filter out already-used names and shuffle
  const availableNames = DEMO_PLAYER_NAMES.filter(
    name => !usedNames.has(name.toLowerCase())
  )
  const shuffledNames = shuffleArray(availableNames)
  const namesToAdd = shuffledNames.slice(0, spotsRemaining)

  if (namesToAdd.length === 0) {
    return NextResponse.json(
      { error: 'No more demo names available' },
      { status: 400 }
    )
  }

  // Create entries (without user_id - these are placeholder entries)
  const entriesToInsert = namesToAdd.map(name => ({
    mm_pool_id: mmPoolId,
    display_name: name,
    status: 'approved',
  }))

  const { error: entriesError } = await supabase
    .from('mm_entries')
    .insert(entriesToInsert)

  if (entriesError) {
    console.error('Error creating entries:', entriesError)
    return NextResponse.json(
      { error: 'Failed to create entries: ' + entriesError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: `Added ${namesToAdd.length} demo entries`,
    entries_added: namesToAdd.length,
    total_entries: currentCount + namesToAdd.length,
  })
}
