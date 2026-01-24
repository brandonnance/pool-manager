/**
 * @fileoverview Event State API Route
 * @route GET /api/events/[id]/state
 * @auth Requires authenticated user
 *
 * @description
 * Returns the current state of a global event, including the live
 * score/leaderboard payload. Used by pool UIs to display real-time data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Event, EventState } from '@/lib/global-events/types'

interface EventStateResponse {
  event: Event
  state: EventState | null
  has_state: boolean
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Missing event ID' }, { status: 400 })
  }

  try {
    // Fetch the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (eventError) {
      if (eventError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      console.error('Error fetching event:', eventError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Fetch the event state (may not exist yet)
    const { data: state, error: stateError } = await supabase
      .from('event_state')
      .select('*')
      .eq('event_id', id)
      .single()

    if (stateError && stateError.code !== 'PGRST116') {
      console.error('Error fetching event state:', stateError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({
      event,
      state: state || null,
      has_state: !!state,
    } as EventStateResponse)

  } catch (error) {
    console.error('Get event state error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
