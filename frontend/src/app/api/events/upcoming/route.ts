import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/events/upcoming
 *
 * Fetches upcoming events from the global events table.
 * Used by the pool creation wizard to let users select an event to link their pool to.
 *
 * Query params:
 * - sport: 'nfl' | 'pga' | 'ncaa_fb' | 'ncaa_bb' (optional, filters by sport)
 * - event_type: 'team_game' | 'golf_tournament' (optional, filters by type)
 * - limit: number (optional, default 20)
 *
 * Returns events with status 'scheduled' or 'in_progress', ordered by start_time ASC.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = request.nextUrl
  const sport = searchParams.get('sport')
  const eventType = searchParams.get('event_type')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  // Build query for upcoming events
  let query = supabase
    .from('events')
    .select('*')
    .in('status', ['scheduled', 'in_progress'])
    .order('start_time', { ascending: true, nullsFirst: false })
    .limit(Math.min(limit, 50))

  if (sport) {
    query = query.eq('sport', sport)
  }

  if (eventType) {
    query = query.eq('event_type', eventType)
  }

  const { data: events, error } = await query

  if (error) {
    console.error('Error fetching upcoming events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }

  return NextResponse.json({ events: events || [] })
}
