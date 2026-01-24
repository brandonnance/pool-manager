/**
 * @fileoverview Poll Event Edge Function
 *
 * Polls a single event and updates its state in event_state table.
 * Can be invoked directly via HTTP or from worker-tick.
 *
 * @route POST /functions/v1/poll-event
 * @body { event_id: string } or { event: Event }
 */

import { createServiceClient } from '../_shared/supabase-client.ts'
import { fetchESPNGame, toTeamGamePayload } from '../_shared/providers/espn.ts'
import { fetchGolfTournamentState } from '../_shared/providers/slashgolf.ts'
import { syncGolfToLegacy } from '../_shared/legacy-sync.ts'
import type { Event, EventStatus, EventStatePayload, GolfTournamentPayload } from '../_shared/types.ts'

interface PollRequest {
  event_id?: string
  event?: Event
}

interface PollResponse {
  success: boolean
  event_id: string
  status?: EventStatus
  error?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabase = createServiceClient()

  try {
    const body: PollRequest = await req.json()

    let event: Event

    if (body.event) {
      // Event passed directly
      event = body.event
    } else if (body.event_id) {
      // Fetch event by ID
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', body.event_id)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, event_id: body.event_id, error: 'Event not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }
      event = data as Event
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing event_id or event in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Don't poll manual events
    if (event.provider === 'manual') {
      return new Response(
        JSON.stringify({ success: false, event_id: event.id, error: 'Manual events cannot be polled' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Don't poll final/cancelled events
    if (event.status === 'final' || event.status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: true, event_id: event.id, status: event.status, message: 'Event already final' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    let newStatus: EventStatus
    let payload: EventStatePayload

    if (event.event_type === 'team_game') {
      const gameData = await fetchESPNGame(event.sport, event.provider_event_id)

      if (!gameData) {
        return new Response(
          JSON.stringify({ success: false, event_id: event.id, error: 'Game not found in ESPN data' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }

      newStatus = gameData.status
      payload = toTeamGamePayload(gameData)

      console.log(`[poll-event] Fetched ${event.name}: ${gameData.homeTeam} ${gameData.homeScore} - ${gameData.awayScore} ${gameData.awayTeam}`)

    } else if (event.event_type === 'golf_tournament') {
      const rapidApiKey = Deno.env.get('RAPIDAPI_KEY')
      if (!rapidApiKey) {
        return new Response(
          JSON.stringify({ success: false, event_id: event.id, error: 'RAPIDAPI_KEY not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const year = event.start_time
        ? new Date(event.start_time).getFullYear()
        : new Date().getFullYear()

      const result = await fetchGolfTournamentState(rapidApiKey, event.provider_event_id, year)
      newStatus = result.status
      payload = result.payload

      console.log(`[poll-event] Fetched golf ${event.name}: round ${result.payload.current_round}, ${result.payload.leaderboard.length} players`)

    } else {
      return new Response(
        JSON.stringify({ success: false, event_id: event.id, error: `Unsupported event type: ${event.event_type}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Upsert event_state
    const { error: stateError } = await supabase
      .from('event_state')
      .upsert({
        event_id: event.id,
        status: newStatus,
        payload,
        last_provider_update_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (stateError) {
      console.error('[poll-event] Error upserting state:', stateError)
      return new Response(
        JSON.stringify({ success: false, event_id: event.id, error: stateError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Shadow mode: Sync to legacy tables for backward compatibility
    if (event.event_type === 'golf_tournament') {
      const legacyResult = await syncGolfToLegacy(
        supabase,
        event.provider_event_id,
        payload as GolfTournamentPayload
      )
      if (legacyResult.synced > 0) {
        console.log(`[poll-event] Synced ${legacyResult.synced} results to legacy tables`)
      }
      if (legacyResult.error) {
        console.error('[poll-event] Legacy sync error:', legacyResult.error)
      }
    }

    // Update event status if changed
    if (event.status !== newStatus) {
      const { error: eventError } = await supabase
        .from('events')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', event.id)

      if (eventError) {
        console.error('[poll-event] Error updating event status:', eventError)
      }
    }

    const response: PollResponse = {
      success: true,
      event_id: event.id,
      status: newStatus,
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[poll-event] Error:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
