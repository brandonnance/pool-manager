/**
 * @fileoverview ESPN Bracket Data API Route
 * @route POST /api/madness/espn-bracket
 * @auth Requires commissioner role or super admin
 *
 * @description
 * Fetches NCAA Tournament Round of 64 data from ESPN's free scoreboard API
 * and populates pool data for both blind draw (mm_*) and squares (sq_*) pools.
 *
 * @actions
 * - load_teams: Fetch ESPN bracket, create bb_teams + mm_pool_teams for blind draw
 * - sync_games: After link-teams, update mm_games with ESPN spreads/IDs/times
 * - load_squares: Update sq_games with team names, ESPN IDs, game times
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkSuperAdmin, checkOrgAdmin, checkPoolCommissioner } from '@/lib/permissions'

// ─── ESPN API Types ────────────────────────────────────────────────────────────

interface ESPNCompetitor {
  homeAway: 'home' | 'away'
  team: {
    id: string
    displayName: string
    shortDisplayName: string
    abbreviation: string
  }
  curatedRank?: { current: number }
  score?: string
}

interface ESPNNote {
  headline?: string
  type?: string
}

interface ESPNOdds {
  details?: string
  spread?: number
  overUnder?: number
}

interface ESPNCompetition {
  id: string
  competitors: ESPNCompetitor[]
  notes?: ESPNNote[]
  odds?: ESPNOdds[]
  status: {
    type: { name: string }
  }
}

interface ESPNEvent {
  id: string
  date: string
  name: string
  competitions: ESPNCompetition[]
  notes?: ESPNNote[]
}

interface ESPNScoreboardResponse {
  events: ESPNEvent[]
}

// ─── Parsed bracket types ──────────────────────────────────────────────────────

interface ParsedR64Game {
  espnGameId: string
  gameTime: string
  region: string
  spread: number | null
  homeTeam: {
    espnTeamId: string
    displayName: string
    shortName: string
    abbreviation: string
    seed: number
  }
  awayTeam: {
    espnTeamId: string
    displayName: string
    shortName: string
    abbreviation: string
    seed: number
  }
}

type EspnAction = 'load_teams' | 'sync_games' | 'load_squares' | 'preview'

// ─── ESPN Fetch + Parse ────────────────────────────────────────────────────────

function parseRegionFromNotes(notes?: ESPNNote[]): string | null {
  if (!notes) return null
  for (const note of notes) {
    if (note.headline) {
      const match = note.headline.match(/(East|West|South|Midwest)\s+Region/i)
      if (match) return match[1]
    }
  }
  return null
}

function parseSpread(odds?: ESPNOdds[]): number | null {
  if (!odds || odds.length === 0) return null
  // odds[0].spread is the numeric spread (negative = home team favored)
  if (typeof odds[0].spread === 'number') return odds[0].spread
  // Fallback: parse from details string like "UK -3.5"
  if (odds[0].details) {
    const match = odds[0].details.match(/([-+]?\d+\.?\d*)$/)
    if (match) return parseFloat(match[1])
  }
  return null
}

async function fetchR64BracketFromESPN(): Promise<{ games: ParsedR64Game[]; errors: string[] }> {
  const errors: string[] = []
  const allGames: ParsedR64Game[] = []

  // Fetch both R64 days (Thu March 19 + Fri March 20, 2026)
  const dates = ['20260319', '20260320']

  for (const date of dates) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&dates=${date}&limit=100`

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      errors.push(`ESPN API returned ${response.status} for date ${date}`)
      continue
    }

    const data: ESPNScoreboardResponse = await response.json()

    if (!data.events || data.events.length === 0) {
      errors.push(`No events found for date ${date}`)
      continue
    }

    for (const event of data.events) {
      const competition = event.competitions[0]
      if (!competition) continue

      const homeComp = competition.competitors.find(c => c.homeAway === 'home')
      const awayComp = competition.competitors.find(c => c.homeAway === 'away')

      if (!homeComp || !awayComp) continue

      const homeSeed = homeComp.curatedRank?.current
      const awaySeed = awayComp.curatedRank?.current

      // Only include tournament games with seeds (skip play-in/TBD)
      if (!homeSeed || !awaySeed) continue
      // R64 seeds are 1-16
      if (homeSeed > 16 || awaySeed > 16) continue

      // Parse region from competition notes, then event-level notes
      let region = parseRegionFromNotes(competition.notes)
      if (!region) {
        region = parseRegionFromNotes(event.notes)
      }
      // Last resort: try parsing from the event name itself (e.g. "East Regional")
      if (!region) {
        const nameMatch = event.name.match(/\b(East|West|South|Midwest)\b/i)
        if (nameMatch) region = nameMatch[1]
      }

      if (!region) {
        errors.push(`Could not determine region for ${event.name} (ESPN ID: ${event.id}). Skipping.`)
        continue
      }

      // Normalize region capitalization
      region = region.charAt(0).toUpperCase() + region.slice(1).toLowerCase()
      if (region === 'Midwest') region = 'Midwest' // preserve full word

      const spread = parseSpread(competition.odds)

      allGames.push({
        espnGameId: event.id,
        gameTime: event.date,
        region,
        spread,
        homeTeam: {
          espnTeamId: homeComp.team.id,
          displayName: homeComp.team.displayName,
          shortName: homeComp.team.shortDisplayName,
          abbreviation: homeComp.team.abbreviation,
          seed: homeSeed,
        },
        awayTeam: {
          espnTeamId: awayComp.team.id,
          displayName: awayComp.team.displayName,
          shortName: awayComp.team.shortDisplayName,
          abbreviation: awayComp.team.abbreviation,
          seed: awaySeed,
        },
      })
    }
  }

  return { games: allGames, errors }
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, poolId, mmPoolId, sqPoolId } = body as {
      action: EspnAction
      poolId: string
      mmPoolId?: string
      sqPoolId?: string
    }

    if (!action || !poolId) {
      return NextResponse.json({ error: 'Missing action or poolId' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get pool for permission check
    const { data: pool } = await supabase
      .from('pools')
      .select('org_id')
      .eq('id', poolId)
      .single()

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    // Permission check
    const [{ data: profile }, { data: orgMembership }, { data: poolMembership }] = await Promise.all([
      supabase.from('profiles').select('is_super_admin').eq('id', user.id).single(),
      supabase.from('org_memberships').select('role').eq('org_id', pool.org_id).eq('user_id', user.id).single(),
      supabase.from('pool_memberships').select('role').eq('pool_id', poolId).eq('user_id', user.id).single(),
    ])

    const isSuperAdmin = checkSuperAdmin(profile)
    const isOrgAdmin = checkOrgAdmin(orgMembership, isSuperAdmin)
    const isPoolCommissioner = checkPoolCommissioner(poolMembership, isOrgAdmin)

    if (!isPoolCommissioner) {
      return NextResponse.json({ error: 'Only commissioners can use ESPN sync' }, { status: 403 })
    }

    switch (action) {
      case 'preview':
        return await previewESPNData()

      case 'load_teams':
        if (!mmPoolId) return NextResponse.json({ error: 'Missing mmPoolId' }, { status: 400 })
        return await loadTeamsFromESPN(supabase, mmPoolId)

      case 'sync_games':
        if (!mmPoolId) return NextResponse.json({ error: 'Missing mmPoolId' }, { status: 400 })
        return await syncGamesFromESPN(supabase, mmPoolId)

      case 'load_squares':
        if (!sqPoolId) return NextResponse.json({ error: 'Missing sqPoolId' }, { status: 400 })
        return await loadSquaresFromESPN(supabase, sqPoolId)

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('ESPN bracket error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── Action: preview (diagnostic) ──────────────────────────────────────────────

async function previewESPNData() {
  const dates = ['20260319', '20260320']
  const diagnostics: Array<{
    date: string
    eventCount: number
    events: Array<{
      id: string
      name: string
      homeTeam: string
      homeSeed: number | undefined
      awayTeam: string
      awaySeed: number | undefined
      hasNotes: boolean
      region: string | null
      hasOdds: boolean
    }>
  }> = []

  for (const date of dates) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&dates=${date}&limit=100`
    const response = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' })

    if (!response.ok) {
      diagnostics.push({ date, eventCount: -1, events: [] })
      continue
    }

    const data: ESPNScoreboardResponse = await response.json()
    const events = (data.events || []).map(event => {
      const comp = event.competitions[0]
      const home = comp?.competitors?.find(c => c.homeAway === 'home')
      const away = comp?.competitors?.find(c => c.homeAway === 'away')
      return {
        id: event.id,
        name: event.name,
        homeTeam: home?.team?.displayName || 'N/A',
        homeSeed: home?.curatedRank?.current,
        awayTeam: away?.team?.displayName || 'N/A',
        awaySeed: away?.curatedRank?.current,
        hasNotes: !!(comp?.notes && comp.notes.length > 0) || !!(event.notes && event.notes.length > 0),
        region: parseRegionFromNotes(comp?.notes) || parseRegionFromNotes(event.notes),
        hasOdds: !!(comp?.odds && comp.odds.length > 0),
      }
    })

    diagnostics.push({ date, eventCount: events.length, events })
  }

  // Also run the full parse to compare
  const { games, errors } = await fetchR64BracketFromESPN()

  return NextResponse.json({
    rawDiagnostics: diagnostics,
    parsedGameCount: games.length,
    parseErrors: errors,
    parsedGames: games.map(g => ({
      espnGameId: g.espnGameId,
      region: g.region,
      home: `(${g.homeTeam.seed}) ${g.homeTeam.shortName}`,
      away: `(${g.awayTeam.seed}) ${g.awayTeam.shortName}`,
      spread: g.spread,
      gameTime: g.gameTime,
    })),
  })
}

// ─── Action: load_teams ────────────────────────────────────────────────────────

async function loadTeamsFromESPN(
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
      { error: `Teams already loaded (${existingTeams} exist). Reset first.` },
      { status: 400 }
    )
  }

  // Fetch ESPN bracket data
  const { games, errors } = await fetchR64BracketFromESPN()

  if (games.length < 32) {
    return NextResponse.json({
      error: `Only found ${games.length} of 32 expected R64 games. Play-in games may still be in progress.`,
      espnErrors: errors,
    }, { status: 422 })
  }

  // Build a flat list of all 64 teams with region+seed
  const teamsToLoad: Array<{
    displayName: string
    abbreviation: string
    seed: number
    region: string
    espnTeamId: string
  }> = []

  for (const game of games) {
    teamsToLoad.push({
      displayName: game.homeTeam.displayName,
      abbreviation: game.homeTeam.abbreviation,
      seed: game.homeTeam.seed,
      region: game.region,
      espnTeamId: game.homeTeam.espnTeamId,
    })
    teamsToLoad.push({
      displayName: game.awayTeam.displayName,
      abbreviation: game.awayTeam.abbreviation,
      seed: game.awayTeam.seed,
      region: game.region,
      espnTeamId: game.awayTeam.espnTeamId,
    })
  }

  // Create/find bb_teams and build region-seed -> team_id map
  const teamIds: Map<string, string> = new Map()
  const createdTeams: string[] = []

  for (const team of teamsToLoad) {
    const key = `${team.region}-${team.seed}`

    // Check if bb_team exists by exact name
    let { data: existingTeam } = await supabase
      .from('bb_teams')
      .select('id')
      .eq('name', team.displayName)
      .single()

    if (!existingTeam) {
      // Create new bb_team
      const { data: newTeam, error } = await supabase
        .from('bb_teams')
        .insert({ name: team.displayName, abbrev: team.abbreviation })
        .select('id')
        .single()

      if (error) {
        console.error(`Error creating team ${team.displayName}:`, error)
        continue
      }
      existingTeam = newTeam
      createdTeams.push(team.displayName)
    }

    if (existingTeam) {
      teamIds.set(key, existingTeam.id)
    }
  }

  // Insert mm_pool_teams
  const poolTeamsToInsert = teamsToLoad.map(team => ({
    mm_pool_id: mmPoolId,
    team_id: teamIds.get(`${team.region}-${team.seed}`)!,
    seed: team.seed,
    region: team.region,
    external_team_id: team.espnTeamId,
  })).filter(t => t.team_id)

  if (poolTeamsToInsert.length !== 64) {
    return NextResponse.json({
      error: `Could only map ${poolTeamsToInsert.length} of 64 teams. Check for missing regions or seed conflicts.`,
      espnErrors: errors,
    }, { status: 422 })
  }

  const { error: insertError } = await supabase
    .from('mm_pool_teams')
    .insert(poolTeamsToInsert)

  if (insertError) {
    console.error('Error inserting pool teams:', insertError)
    return NextResponse.json({ error: 'Failed to insert pool teams: ' + insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `Loaded 64 teams from ESPN bracket (${createdTeams.length} new bb_teams created)`,
    teams_loaded: poolTeamsToInsert.length,
    new_teams: createdTeams,
    espnErrors: errors.length > 0 ? errors : undefined,
  })
}

// ─── Action: sync_games ────────────────────────────────────────────────────────

async function syncGamesFromESPN(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mmPoolId: string
) {
  // Fetch R64 games from our DB
  const { data: mmGames, error: gamesError } = await supabase
    .from('mm_games')
    .select('id, round, region, game_number, higher_seed_team_id, lower_seed_team_id')
    .eq('mm_pool_id', mmPoolId)
    .eq('round', 'R64')

  if (gamesError || !mmGames || mmGames.length === 0) {
    return NextResponse.json({
      error: 'No R64 games found. Make sure Link Teams has been run first.',
    }, { status: 400 })
  }

  // Fetch pool teams for region+seed lookup
  const { data: poolTeams } = await supabase
    .from('mm_pool_teams')
    .select('id, team_id, seed, region')
    .eq('mm_pool_id', mmPoolId)

  if (!poolTeams || poolTeams.length === 0) {
    return NextResponse.json({ error: 'No pool teams found' }, { status: 400 })
  }

  // Build mm_pool_teams.id -> { region, seed } map
  // (mm_games references mm_pool_teams.id, not bb_teams.id)
  const teamInfo = new Map<string, { region: string; seed: number }>()
  for (const pt of poolTeams) {
    teamInfo.set(pt.id, { region: pt.region, seed: pt.seed })
  }

  // Fetch ESPN bracket data
  const { games: espnGames, errors } = await fetchR64BracketFromESPN()

  if (espnGames.length < 32) {
    return NextResponse.json({
      error: `Only found ${espnGames.length} of 32 expected R64 games from ESPN.`,
      espnErrors: errors,
    }, { status: 422 })
  }

  // Build ESPN game lookup: "Region-higherSeed-lowerSeed" -> ESPN game
  const espnLookup = new Map<string, ParsedR64Game>()
  for (const eg of espnGames) {
    const higherSeed = Math.min(eg.homeTeam.seed, eg.awayTeam.seed)
    const lowerSeed = Math.max(eg.homeTeam.seed, eg.awayTeam.seed)
    espnLookup.set(`${eg.region}-${higherSeed}-${lowerSeed}`, eg)
  }

  // Update each mm_game
  let updatedCount = 0
  const updateErrors: string[] = []

  for (const game of mmGames) {
    const higherInfo = game.higher_seed_team_id ? teamInfo.get(game.higher_seed_team_id) : null
    const lowerInfo = game.lower_seed_team_id ? teamInfo.get(game.lower_seed_team_id) : null

    if (!higherInfo || !lowerInfo) {
      updateErrors.push(`Game ${game.id}: could not find team info`)
      continue
    }

    const key = `${higherInfo.region}-${higherInfo.seed}-${lowerInfo.seed}`
    const espnGame = espnLookup.get(key)

    if (!espnGame) {
      updateErrors.push(`Game ${game.id}: no ESPN match for ${key}`)
      continue
    }

    // Determine spread: ESPN spread is typically from the home team's perspective
    // We want it from the higher seed's perspective (negative = higher seed favored)
    let spread = espnGame.spread
    if (spread !== null) {
      // ESPN spread: negative means home team is favored
      // If higher seed is the away team, flip the sign
      const higherSeedIsHome = espnGame.homeTeam.seed === higherInfo.seed
      if (!higherSeedIsHome) {
        spread = -spread
      }
      // Make spread always represent higher seed (negative = favored)
      // Actually, keep it simple: store the absolute spread as a positive number
      // since the higher seed is always expected to be favored
      spread = Math.abs(spread)
    }

    const { error: updateError } = await supabase
      .from('mm_games')
      .update({
        external_game_id: espnGame.espnGameId,
        scheduled_time: espnGame.gameTime,
        spread,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', game.id)

    if (updateError) {
      updateErrors.push(`Game ${game.id}: update failed - ${updateError.message}`)
    } else {
      updatedCount++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Synced ${updatedCount}/${mmGames.length} R64 games with ESPN data`,
    updated: updatedCount,
    errors: updateErrors.length > 0 ? updateErrors : undefined,
    espnErrors: errors.length > 0 ? errors : undefined,
  })
}

// ─── Action: load_squares ──────────────────────────────────────────────────────

async function loadSquaresFromESPN(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sqPoolId: string
) {
  // Fetch R64 sq_games
  const { data: sqGames, error: gamesError } = await supabase
    .from('sq_games')
    .select('id, game_name, display_order')
    .eq('sq_pool_id', sqPoolId)
    .eq('round', 'mm_r64')
    .order('display_order')

  if (gamesError || !sqGames || sqGames.length === 0) {
    return NextResponse.json({ error: 'No R64 sq_games found' }, { status: 400 })
  }

  if (sqGames.length !== 32) {
    return NextResponse.json({
      error: `Expected 32 R64 games but found ${sqGames.length}`,
    }, { status: 400 })
  }

  // Fetch ESPN bracket data
  const { games: espnGames, errors } = await fetchR64BracketFromESPN()

  if (espnGames.length < 32) {
    return NextResponse.json({
      error: `Only found ${espnGames.length} of 32 expected R64 games from ESPN.`,
      espnErrors: errors,
    }, { status: 422 })
  }

  // Sort ESPN games chronologically
  const sortedEspn = [...espnGames].sort(
    (a, b) => new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime()
  )

  // Update each sq_game in chronological order
  let updatedCount = 0
  const updateErrors: string[] = []

  for (let i = 0; i < 32; i++) {
    const sqGame = sqGames[i]
    const espnGame = sortedEspn[i]

    // Determine higher/lower seed for display
    const higherSeedTeam = espnGame.homeTeam.seed <= espnGame.awayTeam.seed
      ? espnGame.homeTeam
      : espnGame.awayTeam
    const lowerSeedTeam = espnGame.homeTeam.seed > espnGame.awayTeam.seed
      ? espnGame.homeTeam
      : espnGame.awayTeam

    // Build rich game name with region
    const regionPrefix = espnGame.region !== 'Unknown' ? `${espnGame.region}: ` : ''
    const gameName = `${regionPrefix}(${higherSeedTeam.seed}) ${higherSeedTeam.shortName} vs (${lowerSeedTeam.seed}) ${lowerSeedTeam.shortName}`

    // Use ESPN home/away designation for squares grid
    const { error: updateError } = await supabase
      .from('sq_games')
      .update({
        home_team: espnGame.homeTeam.displayName,
        away_team: espnGame.awayTeam.displayName,
        espn_game_id: espnGame.espnGameId,
        game_time: espnGame.gameTime,
        game_name: gameName,
        display_order: i + 1,
      })
      .eq('id', sqGame.id)

    if (updateError) {
      updateErrors.push(`Game ${sqGame.id} (${sqGame.game_name}): ${updateError.message}`)
    } else {
      updatedCount++
    }
  }

  return NextResponse.json({
    success: true,
    message: `Updated ${updatedCount}/32 R64 games with ESPN bracket data`,
    updated: updatedCount,
    errors: updateErrors.length > 0 ? updateErrors : undefined,
    espnErrors: errors.length > 0 ? errors : undefined,
  })
}
