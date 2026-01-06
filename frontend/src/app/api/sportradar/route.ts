import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSportradarClient } from '@/lib/sportradar/client'

// GET /api/sportradar?action=majors&year=2025
// GET /api/sportradar?action=field&tournamentId=xxx
// GET /api/sportradar?action=leaderboard&tournamentId=xxx
// GET /api/sportradar?action=player&playerId=xxx

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')

  if (!action) {
    return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 })
  }

  const client = getSportradarClient()

  try {
    switch (action) {
      case 'majors': {
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
        const tournaments = await client.getMajorTournaments(year)
        return NextResponse.json({ tournaments })
      }

      case 'schedule': {
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
        const schedule = await client.getSchedule(year)
        return NextResponse.json(schedule)
      }

      case 'field': {
        const tournamentId = searchParams.get('tournamentId')
        if (!tournamentId) {
          return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 })
        }
        const players = await client.getPlayers(tournamentId)
        return NextResponse.json({ players })
      }

      case 'leaderboard': {
        const tournamentId = searchParams.get('tournamentId')
        if (!tournamentId) {
          return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 })
        }
        const scores = await client.getScores(tournamentId)
        return NextResponse.json({ scores })
      }

      case 'player': {
        const playerId = searchParams.get('playerId')
        if (!playerId) {
          return NextResponse.json({ error: 'Missing playerId' }, { status: 400 })
        }
        const profile = await client.getPlayerProfile(playerId)
        return NextResponse.json({ player: profile })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Sportradar API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
