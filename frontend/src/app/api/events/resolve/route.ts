/**
 * @fileoverview Event Resolution API Route
 * @route POST /api/events/resolve
 * @auth Requires authenticated user
 *
 * @description
 * Finds or creates a global event by provider and provider_event_id.
 * Used when commissioners create pools to link them to shared events.
 *
 * If an event exists, returns it. If not, creates a new one.
 * This ensures all orgs share the same event record for the same game.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Sport, EventType, Provider, EventStatus } from '@/lib/global-events/types'
import type { Json } from '@/types/database'

interface ResolveEventRequest {
  sport: Sport
  event_type: EventType
  provider: Provider
  provider_event_id: string
  name: string
  start_time?: string
  status?: EventStatus
  metadata?: Json
}

interface ResolveEventResponse {
  event: {
    id: string
    sport: Sport
    event_type: EventType
    provider: Provider
    provider_event_id: string
    name: string
    start_time: string | null
    status: EventStatus
    metadata: Json | null
    created_at: string
    updated_at: string
  }
  created: boolean
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ResolveEventRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sport, event_type, provider, provider_event_id, name, start_time, status, metadata } = body

  // Validate required fields
  if (!sport || !event_type || !provider || !provider_event_id || !name) {
    return NextResponse.json(
      { error: 'Missing required fields: sport, event_type, provider, provider_event_id, name' },
      { status: 400 }
    )
  }

  // Validate enum values
  const validSports: Sport[] = ['nfl', 'ncaa_fb', 'ncaa_bb', 'pga']
  const validEventTypes: EventType[] = ['team_game', 'golf_tournament']
  const validProviders: Provider[] = ['espn', 'slashgolf', 'manual']

  if (!validSports.includes(sport)) {
    return NextResponse.json({ error: `Invalid sport: ${sport}` }, { status: 400 })
  }
  if (!validEventTypes.includes(event_type)) {
    return NextResponse.json({ error: `Invalid event_type: ${event_type}` }, { status: 400 })
  }
  if (!validProviders.includes(provider)) {
    return NextResponse.json({ error: `Invalid provider: ${provider}` }, { status: 400 })
  }

  try {
    // First, try to find existing event
    const { data: existingEvent, error: selectError } = await supabase
      .from('events')
      .select('*')
      .eq('sport', sport)
      .eq('provider', provider)
      .eq('provider_event_id', provider_event_id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = "Row not found" - that's expected
      console.error('Error finding event:', selectError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (existingEvent) {
      return NextResponse.json({
        event: existingEvent,
        created: false,
      } as ResolveEventResponse)
    }

    // Event doesn't exist, create it
    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert({
        sport,
        event_type,
        provider,
        provider_event_id,
        name,
        start_time: start_time || null,
        status: status || 'scheduled',
        metadata: metadata || {},
      })
      .select()
      .single()

    if (insertError) {
      // Check for unique constraint violation (race condition)
      if (insertError.code === '23505') {
        // Someone else created it, fetch it
        const { data: raceEvent, error: raceError } = await supabase
          .from('events')
          .select('*')
          .eq('sport', sport)
          .eq('provider', provider)
          .eq('provider_event_id', provider_event_id)
          .single()

        if (raceError || !raceEvent) {
          return NextResponse.json({ error: 'Race condition: failed to resolve event' }, { status: 500 })
        }

        return NextResponse.json({
          event: raceEvent,
          created: false,
        } as ResolveEventResponse)
      }

      console.error('Error creating event:', insertError)
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
    }

    return NextResponse.json({
      event: newEvent,
      created: true,
    } as ResolveEventResponse)

  } catch (error) {
    console.error('Resolve event error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
