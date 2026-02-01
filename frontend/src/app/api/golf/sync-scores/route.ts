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
    const results: { golfer_id: string; name: string; position: string; total: number; status: string }[] = []
    const upserts: Array<{
      tournament_id: string
      golfer_id: string
      round_1: number | null
      round_2: number | null
      round_3: number | null
      round_4: number | null
      total_score: number
      made_cut: boolean
      status: string
      position: string
      thru: number | null
      to_par: number
    }> = []

    // Track golfers who need field status updates (withdrawn/dq)
    const fieldStatusUpdates: Array<{ golferId: string; status: string }> = []

    for (const score of scores) {
      const golferId = golferMap.get(score.playerId)
      if (!golferId) {
        // Golfer not in our field - skip
        continue
      }

      const par = tournament.par || 72
      const isWithdrawn = score.status === 'withdrawn'
      const isDisqualified = score.status === 'disqualified'
      const isCut = score.status === 'cut'
      const madeCut = !isCut && !isWithdrawn && !isDisqualified

      // Determine status string
      let status = 'active'
      if (isWithdrawn) status = 'withdrawn'
      else if (isDisqualified) status = 'dq'
      else if (isCut) status = 'cut'

      // Track field status updates for WD/DQ players
      if (isWithdrawn || isDisqualified) {
        fieldStatusUpdates.push({ golferId, status })
      }

      // For withdrawn/DQ players: assign 80s for all 4 rounds
      // For cut players: 80s for R3 and R4 only
      // For active players: use actual scores
      let round1 = score.round1 ?? null
      let round2 = score.round2 ?? null
      let round3 = score.round3 ?? null
      let round4 = score.round4 ?? null
      let totalStrokes = 0
      let toPar = 0

      if (isWithdrawn || isDisqualified) {
        // Withdrawn/DQ: 80s for all 4 rounds
        round1 = 80
        round2 = 80
        round3 = 80
        round4 = 80
        totalStrokes = 320
        toPar = (80 - par) * 4 // e.g., (80-72) * 4 = +32
        console.log(`[sync-scores] ${score.playerName} ${status}: assigning 80s for all rounds, to_par=${toPar}`)
      } else if (isCut) {
        // Cut: Use actual R1/R2, 80s for R3/R4
        round3 = 80
        round4 = 80
        totalStrokes = (round1 ?? 0) + (round2 ?? 0) + 160
        // Calculate to_par: actual rounds + penalty
        const actualToPar = score.toPar ?? 0
        const penaltyToPar = (80 - par) * 2 // e.g., +16 for par 72
        toPar = actualToPar + penaltyToPar
      } else {
        // Active player: use actual scores
        // Use totalStrokes from API if available
        if (score.totalStrokes !== undefined && !isNaN(score.totalStrokes)) {
          totalStrokes = score.totalStrokes
        } else {
          // Calculate from round scores
          if (round1 !== null) totalStrokes += round1
          if (round2 !== null) totalStrokes += round2
          if (round3 !== null) totalStrokes += round3
          if (round4 !== null) totalStrokes += round4
        }
        toPar = score.toPar ?? 0
      }

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
        round_1: round1,
        round_2: round2,
        round_3: round3,
        round_4: round4,
        total_score: totalStrokes,
        made_cut: madeCut,
        status,
        position: score.position || (isWithdrawn ? 'WD' : isDisqualified ? 'DQ' : '-'),
        thru: thruHoles,
        to_par: toPar,
      })

      results.push({
        golfer_id: golferId,
        name: score.playerName,
        position: score.position || '-',
        total: totalStrokes,
        status,
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

    // Update tournament field status for withdrawn/dq players
    if (fieldStatusUpdates.length > 0) {
      console.log(`[sync-scores] Updating field status for ${fieldStatusUpdates.length} players`)
      for (const update of fieldStatusUpdates) {
        const { error: fieldUpdateError } = await supabase
          .from('gp_tournament_field')
          .update({ status: update.status })
          .eq('tournament_id', tournament.id)
          .eq('golfer_id', update.golferId)

        if (fieldUpdateError) {
          console.error(`[sync-scores] Failed to update field status for ${update.golferId}:`, fieldUpdateError)
        }
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

    // Count withdrawals and DQs
    const withdrawals = results.filter(r => r.status === 'withdrawn').length
    const disqualifications = results.filter(r => r.status === 'dq').length
    const cuts = results.filter(r => r.status === 'cut').length

    return NextResponse.json({
      success: true,
      message: `Synced ${upserts.length} golfer scores`,
      matchedGolfers: upserts.length,
      totalFromApi: scores.length,
      tournamentStatus: newStatus,
      withdrawals,
      disqualifications,
      cuts,
    })

  } catch (error) {
    console.error('[sync-scores] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync scores' },
      { status: 500 }
    )
  }
}
