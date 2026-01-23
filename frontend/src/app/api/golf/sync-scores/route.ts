import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSlashGolfClient } from '@/lib/slashgolf/client'

// POST /api/golf/sync-scores
// Body: { poolId: string }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { poolId } = body

  if (!poolId) {
    return NextResponse.json({ error: 'Missing poolId' }, { status: 400 })
  }

  try {
    // Get golf pool config
    const { data: gpPool, error: gpPoolError } = await supabase
      .from('gp_pools')
      .select('id, tournament_id')
      .eq('pool_id', poolId)
      .single()

    if (gpPoolError || !gpPool) {
      return NextResponse.json({ error: 'Golf pool not found' }, { status: 404 })
    }

    if (!gpPool.tournament_id) {
      return NextResponse.json({ error: 'No tournament linked to this pool' }, { status: 400 })
    }

    // Get tournament info (need external_tournament_id)
    const { data: tournament, error: tournError } = await supabase
      .from('gp_tournaments')
      .select('id, external_tournament_id, start_date, par')
      .eq('id', gpPool.tournament_id)
      .single()

    if (tournError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    if (!tournament.external_tournament_id) {
      return NextResponse.json({ error: 'Tournament missing external ID' }, { status: 400 })
    }

    // Get all golfers in this tournament field
    const { data: fieldGolfers, error: fieldError } = await supabase
      .from('gp_tournament_field')
      .select(`
        golfer_id,
        gp_golfers!inner (
          id,
          name,
          external_player_id
        )
      `)
      .eq('tournament_id', tournament.id)

    if (fieldError) {
      return NextResponse.json({ error: 'Failed to get tournament field' }, { status: 500 })
    }

    // Build a map of external_player_id -> golfer_id
    const golferMap = new Map<string, string>()
    fieldGolfers?.forEach(f => {
      const golfer = f.gp_golfers as unknown as { id: string; external_player_id: string | null }
      if (golfer.external_player_id) {
        golferMap.set(golfer.external_player_id, golfer.id)
      }
    })

    console.log(`[sync-scores] Found ${golferMap.size} golfers with external IDs`)

    // Extract year from tournament start date
    const year = new Date(tournament.start_date).getFullYear()

    // Fetch live scores from Slash Golf API
    const client = getSlashGolfClient()
    console.log(`[sync-scores] Fetching scores for tournament ${tournament.external_tournament_id} year ${year}`)
    const scores = await client.getScores(tournament.external_tournament_id, year)

    console.log(`[sync-scores] Fetched ${scores.length} scores from API`)

    // Handle case where no scores are available yet
    if (scores.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leaderboard data available yet. The tournament may not have started or scores are not posted.',
        matchedGolfers: 0,
        totalFromApi: 0,
        tournamentStatus: null,
      })
    }

    // Prepare upserts
    const results: { golfer_id: string; name: string; position: string; total: number }[] = []
    const upserts: Array<{
      tournament_id: string
      golfer_id: string
      round_1: number | null
      round_2: number | null
      round_3: number | null
      round_4: number | null
      total_score: number
      made_cut: boolean
      position: string
      thru: number | null
      to_par: number
    }> = []

    for (const score of scores) {
      const golferId = golferMap.get(score.playerId)
      if (!golferId) {
        // Golfer not in our field - skip
        continue
      }

      const madeCut = score.status !== 'cut'
      const par = tournament.par || 72

      // Use totalStrokes from API if available (for completed rounds)
      // Otherwise calculate from individual round scores
      let totalStrokes = 0
      let roundsPlayed = 0

      // First try to use the API's totalStrokes (from totalStrokesFromCompletedRounds)
      if (score.totalStrokes !== undefined && !isNaN(score.totalStrokes)) {
        totalStrokes = score.totalStrokes
        // Count completed rounds
        if (score.round1 !== undefined && score.round1 !== null) roundsPlayed++
        if (score.round2 !== undefined && score.round2 !== null) roundsPlayed++
        if (score.round3 !== undefined && score.round3 !== null) roundsPlayed++
        if (score.round4 !== undefined && score.round4 !== null) roundsPlayed++
      } else {
        // Fall back to calculating from round scores
        if (score.round1 !== undefined && score.round1 !== null) {
          totalStrokes += score.round1
          roundsPlayed++
        }
        if (score.round2 !== undefined && score.round2 !== null) {
          totalStrokes += score.round2
          roundsPlayed++
        }
        if (score.round3 !== undefined && score.round3 !== null) {
          totalStrokes += score.round3
          roundsPlayed++
        }
        if (score.round4 !== undefined && score.round4 !== null) {
          totalStrokes += score.round4
          roundsPlayed++
        }
      }

      // If player missed cut, add penalty rounds (80 each for R3 and R4)
      if (!madeCut && roundsPlayed === 2) {
        totalStrokes += 80 + 80 // Penalty for missed cut
      }

      // Store the to-par score for live display
      const toPar = score.toPar ?? 0

      // Convert thru to number - "F" means finished (18 holes)
      let thruHoles: number | null = null
      if (score.thru !== undefined && score.thru !== null) {
        if (typeof score.thru === 'number') {
          thruHoles = score.thru
        } else if (score.thru === 'F' || score.thru === 'f') {
          thruHoles = 18 // Finished round
        } else {
          const parsed = parseInt(score.thru)
          if (!isNaN(parsed)) {
            thruHoles = parsed
          }
        }
      }

      upserts.push({
        tournament_id: tournament.id,
        golfer_id: golferId,
        round_1: score.round1 ?? null,
        round_2: score.round2 ?? null,
        round_3: score.round3 ?? null,
        round_4: score.round4 ?? null,
        total_score: totalStrokes,
        made_cut: madeCut,
        position: score.position || '-',
        thru: thruHoles,
        to_par: toPar,
      })

      results.push({
        golfer_id: golferId,
        name: score.playerName,
        position: score.position || '-',
        total: totalStrokes,
      })
    }

    console.log(`[sync-scores] Preparing ${upserts.length} upserts`)

    // Upsert results in batches
    if (upserts.length > 0) {
      const { error: upsertError } = await supabase
        .from('gp_golfer_results')
        .upsert(upserts, {
          onConflict: 'tournament_id,golfer_id',
        })

      if (upsertError) {
        console.error('[sync-scores] Upsert error:', upsertError)
        return NextResponse.json({ error: 'Failed to save scores' }, { status: 500 })
      }
    }

    // Update tournament status if needed
    const now = new Date()
    const startDate = new Date(tournament.start_date)
    let newStatus: string | null = null

    if (scores.some(s => s.round4 !== undefined && s.round4 !== null)) {
      // Has round 4 scores - could be completed
      newStatus = 'completed'
    } else if (scores.some(s => s.round1 !== undefined && s.round1 !== null)) {
      // Has any scores - in progress
      newStatus = 'in_progress'
    } else if (now >= startDate) {
      newStatus = 'in_progress'
    }

    if (newStatus) {
      await supabase
        .from('gp_tournaments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', tournament.id)
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${upserts.length} golfer scores`,
      matchedGolfers: upserts.length,
      totalFromApi: scores.length,
      tournamentStatus: newStatus,
    })

  } catch (error) {
    console.error('[sync-scores] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync scores' },
      { status: 500 }
    )
  }
}
