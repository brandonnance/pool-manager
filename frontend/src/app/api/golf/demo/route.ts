import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  DEMO_GOLFERS, 
  DEMO_TOURNAMENT, 
  generateTierBasedScore,
  calculateCutLine,
} from '@/lib/golf/demo-data'

// POST /api/golf/demo
// Body: { action: 'seed' | 'simulate-round' | 'reset', poolId: string }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action, poolId } = body

  if (!action || !poolId) {
    return NextResponse.json({ error: 'Missing action or poolId' }, { status: 400 })
  }

  // Verify user is commissioner of the pool
  const { data: poolMembership } = await supabase
    .from('pool_memberships')
    .select('role')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .single()

  // Also check org admin
  const { data: pool } = await supabase
    .from('pools')
    .select('org_id')
    .eq('id', poolId)
    .single()

  let isCommissioner = poolMembership?.role === 'commissioner'
  
  if (!isCommissioner && pool?.org_id) {
    const { data: orgMembership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', pool.org_id)
      .eq('user_id', user.id)
      .single()
    
    isCommissioner = orgMembership?.role === 'admin'
  }

  if (!isCommissioner) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Verify pool is in demo mode
  const { data: gpPool } = await supabase
    .from('gp_pools')
    .select('id, tournament_id, demo_mode')
    .eq('pool_id', poolId)
    .single()

  if (!gpPool) {
    return NextResponse.json({ error: 'Golf pool not found' }, { status: 404 })
  }

  if (!gpPool.demo_mode) {
    return NextResponse.json({ error: 'Pool is not in demo mode' }, { status: 400 })
  }

  try {
    switch (action) {
      case 'seed': {
        // Create demo tournament if not exists
        let tournamentId = gpPool.tournament_id

        if (!tournamentId) {
          // Create demo tournament
          const { data: tournament, error: tournamentError } = await supabase
            .from('gp_tournaments')
            .insert({
              name: DEMO_TOURNAMENT.name,
              start_date: DEMO_TOURNAMENT.startDate,
              end_date: DEMO_TOURNAMENT.endDate,
              venue: DEMO_TOURNAMENT.venue,
              course_name: DEMO_TOURNAMENT.courseName,
              par: DEMO_TOURNAMENT.parPerRound,
              status: 'upcoming',
            })
            .select()
            .single()

          if (tournamentError) {
            console.error('Error creating demo tournament:', tournamentError)
            return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 })
          }

          tournamentId = tournament.id

          // Link tournament to pool
          await supabase
            .from('gp_pools')
            .update({ tournament_id: tournamentId })
            .eq('id', gpPool.id)
        }

        // Insert demo golfers
        const golferInserts = DEMO_GOLFERS.map(g => ({
          name: g.name,
          country: g.country,
          owgr_rank: g.owgrRank,
          sportradar_player_id: `demo-${g.name.toLowerCase().replace(/\s+/g, '-')}`,
        }))

        const { error: golferError } = await supabase
          .from('gp_golfers')
          .upsert(golferInserts, {
            onConflict: 'sportradar_player_id',
          })

        if (golferError) {
          console.error('Error inserting golfers:', golferError)
          return NextResponse.json({ error: 'Failed to insert golfers' }, { status: 500 })
        }

        // Get golfer IDs
        const { data: golfers } = await supabase
          .from('gp_golfers')
          .select('id, sportradar_player_id')
          .in('sportradar_player_id', golferInserts.map(g => g.sportradar_player_id))

        if (!golfers) {
          return NextResponse.json({ error: 'Failed to retrieve golfers' }, { status: 500 })
        }

        // Create tournament field
        const fieldInserts = golfers.map(g => ({
          tournament_id: tournamentId,
          golfer_id: g.id,
          status: 'active' as const,
        }))

        const { error: fieldError } = await supabase
          .from('gp_tournament_field')
          .upsert(fieldInserts, {
            onConflict: 'tournament_id,golfer_id',
          })

        if (fieldError) {
          console.error('Error creating field:', fieldError)
          return NextResponse.json({ error: 'Failed to create field' }, { status: 500 })
        }

        // Create default tier assignments
        const golferMap = new Map(golferInserts.map((g, i) => [g.sportradar_player_id, DEMO_GOLFERS[i].suggestedTier]))
        const tierInserts = golfers
          .filter(g => g.sportradar_player_id !== null)
          .map(g => ({
            pool_id: gpPool.id,
            golfer_id: g.id,
            tier_value: golferMap.get(g.sportradar_player_id!) ?? 5,
          }))

        const { error: tierError } = await supabase
          .from('gp_tier_assignments')
          .upsert(tierInserts, {
            onConflict: 'pool_id,golfer_id',
          })

        if (tierError) {
          console.error('Error creating tiers:', tierError)
          return NextResponse.json({ error: 'Failed to create tier assignments' }, { status: 500 })
        }

        return NextResponse.json({ 
          message: 'Demo data seeded successfully',
          tournamentId,
          golferCount: golfers.length 
        })
      }

      case 'simulate-round': {
        if (!gpPool.tournament_id) {
          return NextResponse.json({ error: 'No tournament linked. Seed first.' }, { status: 400 })
        }

        // Get current scores to determine which round to simulate
        const { data: existingResults } = await supabase
          .from('gp_golfer_results')
          .select('round_1, round_2, round_3, round_4')
          .eq('tournament_id', gpPool.tournament_id)
          .limit(1)

        const firstResult = existingResults?.[0]
        let roundToSimulate = 1
        if (firstResult) {
          if (firstResult.round_4) roundToSimulate = 5 // All complete
          else if (firstResult.round_3) roundToSimulate = 4
          else if (firstResult.round_2) roundToSimulate = 3
          else if (firstResult.round_1) roundToSimulate = 2
        }

        if (roundToSimulate > 4) {
          return NextResponse.json({ error: 'Tournament already complete' }, { status: 400 })
        }

        // Get golfers in the tournament field
        const { data: fieldGolfers } = await supabase
          .from('gp_tournament_field')
          .select('golfer_id, status')
          .eq('tournament_id', gpPool.tournament_id)

        if (!fieldGolfers || fieldGolfers.length === 0) {
          return NextResponse.json({ error: 'No golfers in tournament' }, { status: 400 })
        }

        // Get tier assignments for this pool
        const { data: tierAssignments } = await supabase
          .from('gp_tier_assignments')
          .select('golfer_id, tier_value')
          .eq('pool_id', gpPool.id)

        const tierMap = new Map(tierAssignments?.map(t => [t.golfer_id, t.tier_value]) || [])

        // Get existing results
        const { data: currentResults } = await supabase
          .from('gp_golfer_results')
          .select('*')
          .eq('tournament_id', gpPool.tournament_id)

        const resultMap = new Map(currentResults?.map(r => [r.golfer_id, r]) || [])

        // Generate scores for this round
        const updates: {
          tournament_id: string
          golfer_id: string
          round_1?: number
          round_2?: number
          round_3?: number
          round_4?: number
          made_cut?: boolean
          total_score?: number
        }[] = []

        // First pass: generate R1/R2 scores
        const r1r2Scores: { golferId: string; r1: number; r2: number }[] = []

        for (const golfer of fieldGolfers) {
          const tier = tierMap.get(golfer.golfer_id) ?? 5
          const existing = resultMap.get(golfer.golfer_id)

          if (roundToSimulate === 1) {
            const r1 = generateTierBasedScore(tier)
            updates.push({
              tournament_id: gpPool.tournament_id,
              golfer_id: golfer.golfer_id,
              round_1: r1,
              made_cut: true, // Not yet determined
              total_score: r1,
            })
          } else if (roundToSimulate === 2) {
            const r2 = generateTierBasedScore(tier)
            const r1 = existing?.round_1 ?? 72
            r1r2Scores.push({ golferId: golfer.golfer_id, r1, r2 })
          } else if (roundToSimulate >= 3 && existing?.made_cut) {
            // Only golfers who made cut play rounds 3-4
            const newScore = generateTierBasedScore(tier)
            const update: typeof updates[0] = {
              tournament_id: gpPool.tournament_id,
              golfer_id: golfer.golfer_id,
            }
            if (roundToSimulate === 3) {
              update.round_3 = newScore
              update.total_score = (existing?.round_1 ?? 0) + (existing?.round_2 ?? 0) + newScore
            } else {
              update.round_4 = newScore
              update.total_score = (existing?.round_1 ?? 0) + (existing?.round_2 ?? 0) + (existing?.round_3 ?? 0) + newScore
            }
            updates.push(update)
          }
        }

        // Handle round 2 cut logic
        if (roundToSimulate === 2) {
          const cutLine = calculateCutLine(r1r2Scores)
          
          for (const score of r1r2Scores) {
            const madeCut = score.r1 + score.r2 <= cutLine
            updates.push({
              tournament_id: gpPool.tournament_id,
              golfer_id: score.golferId,
              round_2: score.r2,
              made_cut: madeCut,
              total_score: score.r1 + score.r2,
            })

            // Update field status for cut players
            if (!madeCut) {
              await supabase
                .from('gp_tournament_field')
                .update({ status: 'cut' })
                .eq('tournament_id', gpPool.tournament_id)
                .eq('golfer_id', score.golferId)
            }
          }
        }

        // Upsert results
        if (updates.length > 0) {
          const { error: updateError } = await supabase
            .from('gp_golfer_results')
            .upsert(updates, {
              onConflict: 'tournament_id,golfer_id',
            })

          if (updateError) {
            console.error('Error updating results:', updateError)
            return NextResponse.json({ error: 'Failed to update results' }, { status: 500 })
          }
        }

        // Update tournament status
        const newStatus = roundToSimulate === 1 ? 'in_progress' : 
                          roundToSimulate === 4 ? 'completed' : 'in_progress'
        
        await supabase
          .from('gp_tournaments')
          .update({ status: newStatus })
          .eq('id', gpPool.tournament_id)

        return NextResponse.json({ 
          message: `Round ${roundToSimulate} simulated successfully`,
          round: roundToSimulate,
          status: newStatus,
        })
      }

      case 'reset': {
        if (!gpPool.tournament_id) {
          return NextResponse.json({ message: 'Nothing to reset' })
        }

        // Delete results
        await supabase
          .from('gp_golfer_results')
          .delete()
          .eq('tournament_id', gpPool.tournament_id)

        // Reset field status
        await supabase
          .from('gp_tournament_field')
          .update({ status: 'active' })
          .eq('tournament_id', gpPool.tournament_id)

        // Reset tournament status
        await supabase
          .from('gp_tournaments')
          .update({ status: 'upcoming' })
          .eq('id', gpPool.tournament_id)

        return NextResponse.json({ message: 'Demo scores reset successfully' })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Demo API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
