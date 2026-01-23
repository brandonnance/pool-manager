import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSlashGolfClient } from '@/lib/slashgolf/client'

// GET /api/golf/tournaments?year=2025
// GET /api/golf/tournaments?tournId=xxx&year=2025 (get field)
// GET /api/golf/tournaments?action=leaderboard&tournId=xxx&year=2025

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const tournId = searchParams.get('tournId')

  const client = getSlashGolfClient()

  try {
    // Get leaderboard for a tournament
    if (action === 'leaderboard' && tournId) {
      const scores = await client.getScores(tournId, year)
      return NextResponse.json({ scores })
    }

    // Get tournament field (players)
    if (tournId) {
      const players = await client.getPlayers(tournId, year)
      return NextResponse.json({ players })
    }

    // Get schedule (tournament list)
    const tournaments = await client.getTournaments(year)
    return NextResponse.json({ tournaments })

  } catch (error) {
    console.error('Slash Golf API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/golf/tournaments - Import a tournament to a pool
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { poolId, tournamentData } = body

    if (!poolId || !tournamentData) {
      return NextResponse.json({ error: 'Missing poolId or tournamentData' }, { status: 400 })
    }

    // Verify user is commissioner of this pool
    const { data: poolData } = await supabase
      .from('pools')
      .select('org_id')
      .eq('id', poolId)
      .single()

    if (!poolData) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    const { data: poolMembership } = await supabase
      .from('pool_memberships')
      .select('role')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .single()

    const { data: orgMembership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', poolData.org_id)
      .eq('user_id', user.id)
      .single()

    const isCommissioner = poolMembership?.role === 'commissioner' || orgMembership?.role === 'admin'
    if (!isCommissioner) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // 1. Create or find the tournament in gp_tournaments
    let tournamentId: string

    // Check if tournament already exists by external ID
    const { data: existingTournament } = await supabase
      .from('gp_tournaments')
      .select('id')
      .eq('external_tournament_id', tournamentData.tournId)
      .single()

    if (existingTournament) {
      tournamentId = existingTournament.id
    } else {
      const { data: newTournament, error: tournamentError } = await supabase
        .from('gp_tournaments')
        .insert({
          name: tournamentData.name,
          external_tournament_id: tournamentData.tournId,
          start_date: tournamentData.startDate,
          end_date: tournamentData.endDate,
          venue: tournamentData.venue || null,
          course_name: tournamentData.courseName || null,
          par: tournamentData.par || 72,
          status: tournamentData.status || 'upcoming',
        })
        .select('id')
        .single()

      if (tournamentError) {
        console.error('Error creating tournament:', tournamentError)
        return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 })
      }
      tournamentId = newTournament.id
    }

    // 2. Get the golf pool config
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('id')
      .eq('pool_id', poolId)
      .single()

    if (!gpPool) {
      return NextResponse.json({ error: 'Golf pool config not found' }, { status: 404 })
    }

    // 3. Link the tournament to the pool
    const { error: linkError } = await supabase
      .from('gp_pools')
      .update({ tournament_id: tournamentId })
      .eq('id', gpPool.id)

    if (linkError) {
      console.error('Error linking tournament:', linkError)
      return NextResponse.json({ error: 'Failed to link tournament' }, { status: 500 })
    }

    // 4. Fetch and import the field from Slash Golf API
    const client = getSlashGolfClient()
    let players: Awaited<ReturnType<typeof client.getPlayers>> = []
    let fieldError: string | null = null

    try {
      const year = new Date(tournamentData.startDate).getFullYear()
      players = await client.getPlayers(tournamentData.tournId, year)
    } catch (err) {
      fieldError = err instanceof Error ? err.message : 'Field data not available'
      console.log('Could not fetch field data:', fieldError)
    }

    // Insert golfers and create field entries
    let importedCount = 0
    for (const player of players) {
      // Check if golfer already exists by external ID
      const { data: existingGolfer } = await supabase
        .from('gp_golfers')
        .select('id')
        .eq('external_player_id', player.id)
        .single()

      let golferId: string
      if (existingGolfer) {
        golferId = existingGolfer.id
        // Update the golfer info
        await supabase
          .from('gp_golfers')
          .update({
            name: player.fullName,
            country: player.country,
            updated_at: new Date().toISOString(),
          })
          .eq('id', golferId)
      } else {
        const { data: newGolfer, error: golferError } = await supabase
          .from('gp_golfers')
          .insert({
            name: player.fullName,
            external_player_id: player.id,
            country: player.country,
          })
          .select('id')
          .single()

        if (golferError) {
          console.error('Error creating golfer:', golferError)
          continue
        }
        golferId = newGolfer.id
      }

      // Check if already in field
      const { data: existingField } = await supabase
        .from('gp_tournament_field')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('golfer_id', golferId)
        .single()

      if (!existingField) {
        await supabase
          .from('gp_tournament_field')
          .insert({
            tournament_id: tournamentId,
            golfer_id: golferId,
            status: 'active',
          })
        importedCount++
      }
    }

    return NextResponse.json({
      success: true,
      tournamentId,
      importedCount,
      totalPlayers: players.length,
      fieldError: fieldError ? `Note: ${fieldError}. You can add golfers manually via the tier editor.` : null
    })

  } catch (error) {
    console.error('Tournament import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
