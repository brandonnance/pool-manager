import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSportradarClient } from '@/lib/sportradar/client'

// POST /api/sportradar/sync
// Body: { action: 'tournament' | 'field' | 'scores', tournamentId: string, poolId?: string }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action, tournamentId, poolId } = body

  if (!action || !tournamentId) {
    return NextResponse.json({ error: 'Missing action or tournamentId' }, { status: 400 })
  }

  const client = getSportradarClient()

  try {
    switch (action) {
      case 'tournament': {
        // Sync tournament details
        const tournaments = await client.getMajorTournaments(new Date().getFullYear())
        const tournament = tournaments.find(t => t.sportradarId === tournamentId)
        
        if (!tournament) {
          // Fallback to full schedule
          const schedule = await client.getSchedule(new Date().getFullYear())
          const found = schedule.tournaments.find(t => t.id === tournamentId)
          
          if (!found) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
          }

          // Upsert tournament
          const { data, error } = await supabase
            .from('gp_tournaments')
            .upsert({
              sportradar_tournament_id: found.id,
              name: found.name,
              start_date: found.start_date,
              end_date: found.end_date,
              venue: found.venue?.name,
              course_name: found.course?.name,
              status: found.status === 'scheduled' ? 'upcoming' : 
                      found.status === 'inprogress' ? 'in_progress' : 'completed',
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'sportradar_tournament_id',
            })
            .select()
            .single()

          if (error) {
            console.error('Error syncing tournament:', error)
            return NextResponse.json({ error: 'Failed to sync tournament' }, { status: 500 })
          }

          return NextResponse.json({ tournament: data })
        }

        // Upsert tournament
        const { data, error } = await supabase
          .from('gp_tournaments')
          .upsert({
            sportradar_tournament_id: tournament.sportradarId,
            name: tournament.name,
            start_date: tournament.startDate,
            end_date: tournament.endDate,
            venue: tournament.venueName,
            course_name: tournament.courseName,
            status: tournament.status,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'sportradar_tournament_id',
          })
          .select()
          .single()

        if (error) {
          console.error('Error syncing tournament:', error)
          return NextResponse.json({ error: 'Failed to sync tournament' }, { status: 500 })
        }

        return NextResponse.json({ tournament: data })
      }

      case 'field': {
        // Get or create tournament first
        let { data: tournament } = await supabase
          .from('gp_tournaments')
          .select('id')
          .eq('sportradar_tournament_id', tournamentId)
          .single()

        if (!tournament) {
          // Sync tournament first
          const syncResponse = await fetch(`${request.nextUrl.origin}/api/sportradar/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '',
            },
            body: JSON.stringify({ action: 'tournament', tournamentId }),
          })
          const syncData = await syncResponse.json()
          tournament = syncData.tournament
        }

        if (!tournament?.id) {
          return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
        }

        // Get field from Sportradar
        const players = await client.getPlayers(tournamentId)

        // Upsert all golfers
        const golferUpserts = players.map(p => ({
          sportradar_player_id: p.sportradarId,
          name: p.fullName,
          country: p.country,
          headshot_url: p.headshotUrl,
          updated_at: new Date().toISOString(),
        }))

        const { error: golferError } = await supabase
          .from('gp_golfers')
          .upsert(golferUpserts, {
            onConflict: 'sportradar_player_id',
          })

        if (golferError) {
          console.error('Error syncing golfers:', golferError)
          return NextResponse.json({ error: 'Failed to sync golfers' }, { status: 500 })
        }

        // Get golfer IDs
        const { data: golfers } = await supabase
          .from('gp_golfers')
          .select('id, sportradar_player_id')
          .in('sportradar_player_id', players.map(p => p.sportradarId))

        if (!golfers) {
          return NextResponse.json({ error: 'Failed to retrieve golfers' }, { status: 500 })
        }

        // Create tournament field entries
        const golferMap = new Map(golfers.map(g => [g.sportradar_player_id, g.id]))
        const fieldUpserts = players.map(p => ({
          tournament_id: tournament.id,
          golfer_id: golferMap.get(p.sportradarId)!,
          status: 'active' as const,
        })).filter(f => f.golfer_id)

        const { error: fieldError } = await supabase
          .from('gp_tournament_field')
          .upsert(fieldUpserts, {
            onConflict: 'tournament_id,golfer_id',
            ignoreDuplicates: false,
          })

        if (fieldError) {
          console.error('Error syncing field:', fieldError)
          return NextResponse.json({ error: 'Failed to sync field' }, { status: 500 })
        }

        return NextResponse.json({ 
          message: 'Field synced successfully',
          golferCount: players.length 
        })
      }

      case 'scores': {
        // Get tournament
        const { data: tournament } = await supabase
          .from('gp_tournaments')
          .select('id')
          .eq('sportradar_tournament_id', tournamentId)
          .single()

        if (!tournament) {
          return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
        }

        // Get scores from Sportradar
        const scores = await client.getScores(tournamentId)

        // Get golfer IDs
        const { data: golfers } = await supabase
          .from('gp_golfers')
          .select('id, sportradar_player_id')

        if (!golfers) {
          return NextResponse.json({ error: 'Failed to retrieve golfers' }, { status: 500 })
        }

        const golferMap = new Map(golfers.map(g => [g.sportradar_player_id, g.id]))

        // Upsert scores
        const scoreUpserts = scores
          .map(s => {
            const golferId = golferMap.get(s.playerId)
            if (!golferId) return null

            return {
              tournament_id: tournament.id,
              golfer_id: golferId,
              round_1: s.round1,
              round_2: s.round2,
              round_3: s.round3,
              round_4: s.round4,
              made_cut: s.status === 'active' || (s.round3 !== undefined),
              position: s.position,
              total_score: s.totalStrokes,
              updated_at: new Date().toISOString(),
            }
          })
          .filter((s): s is NonNullable<typeof s> => s !== null)

        const { error: scoreError } = await supabase
          .from('gp_golfer_results')
          .upsert(scoreUpserts, {
            onConflict: 'tournament_id,golfer_id',
          })

        if (scoreError) {
          console.error('Error syncing scores:', scoreError)
          return NextResponse.json({ error: 'Failed to sync scores' }, { status: 500 })
        }

        // Update tournament field status for cut/withdrawn players
        for (const score of scores) {
          if (score.status !== 'active') {
            const golferId = golferMap.get(score.playerId)
            if (golferId) {
              await supabase
                .from('gp_tournament_field')
                .update({ status: score.status })
                .eq('tournament_id', tournament.id)
                .eq('golfer_id', golferId)
            }
          }
        }

        return NextResponse.json({ 
          message: 'Scores synced successfully',
          scoreCount: scoreUpserts.length 
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Sportradar sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
