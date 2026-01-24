/**
 * @fileoverview Worker Tick Edge Function
 *
 * Scheduled function that runs periodically (e.g., every minute) to:
 * 1. Find events that need polling
 * 2. Acquire leases for those events
 * 3. Invoke poll-event for each leased event
 *
 * Schedule: */1 * * * * (every minute)
 *
 * Deployment:
 *   supabase functions deploy worker-tick --schedule "*/1 * * * *"
 */

import { createServiceClient } from '../_shared/supabase-client.ts'
import { eventNeedsPolling, LEASE_DURATION_SECONDS, type Event } from '../_shared/types.ts'

// Generate a unique worker ID for this invocation
const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`

Deno.serve(async (req) => {
  // Only allow POST requests (from scheduler) or GET (for manual testing)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  console.log(`[worker-tick] Starting tick, worker_id: ${WORKER_ID}`)

  const supabase = createServiceClient()

  try {
    // Check if global events is enabled
    const { data: configData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'global_events_config')
      .single()

    const config = configData?.value as { enabled: boolean; shadow_mode: boolean } | null

    if (!config?.enabled) {
      console.log('[worker-tick] Global events disabled, skipping')
      return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch all non-final events that might need polling
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .neq('status', 'final')
      .neq('status', 'cancelled')
      .neq('provider', 'manual')

    if (eventsError) {
      console.error('[worker-tick] Error fetching events:', eventsError)
      return new Response(JSON.stringify({ error: eventsError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Filter to events that actually need polling
    const eventsNeedingPolling = (events || []).filter(eventNeedsPolling)
    console.log(`[worker-tick] Found ${eventsNeedingPolling.length} events needing polling`)

    if (eventsNeedingPolling.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Process each event
    const results: { event_id: string; success: boolean; error?: string }[] = []
    const now = new Date()
    const expiresAt = new Date(now.getTime() + LEASE_DURATION_SECONDS * 1000)

    for (const event of eventsNeedingPolling) {
      try {
        // Try to acquire a lease using advisory lock
        const { data: lockResult } = await supabase.rpc('pg_try_advisory_lock', {
          lock_id: hashCode(`event:${event.id}`),
        })

        if (!lockResult) {
          console.log(`[worker-tick] Could not acquire lock for event ${event.id}, skipping`)
          results.push({ event_id: event.id, success: false, error: 'lock_unavailable' })
          continue
        }

        try {
          // Check if there's an existing unexpired lease
          const { data: existingLease } = await supabase
            .from('worker_leases')
            .select('*')
            .eq('event_id', event.id)
            .single()

          if (existingLease && new Date(existingLease.expires_at) > now) {
            // Lease is still valid, skip
            console.log(`[worker-tick] Event ${event.id} has active lease, skipping`)
            results.push({ event_id: event.id, success: false, error: 'lease_active' })
            continue
          }

          // Upsert our lease
          const { error: leaseError } = await supabase
            .from('worker_leases')
            .upsert({
              event_id: event.id,
              worker_id: WORKER_ID,
              leased_at: now.toISOString(),
              expires_at: expiresAt.toISOString(),
              last_poll_at: null,
            })

          if (leaseError) {
            console.error(`[worker-tick] Failed to acquire lease for ${event.id}:`, leaseError)
            results.push({ event_id: event.id, success: false, error: leaseError.message })
            continue
          }

          // Invoke poll-event function
          const pollResult = await pollEvent(event)
          results.push({ event_id: event.id, success: pollResult.success, error: pollResult.error })

          // Update last_poll_at
          await supabase
            .from('worker_leases')
            .update({ last_poll_at: new Date().toISOString() })
            .eq('event_id', event.id)

        } finally {
          // Release the advisory lock
          await supabase.rpc('pg_advisory_unlock', {
            lock_id: hashCode(`event:${event.id}`),
          })
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[worker-tick] Error processing event ${event.id}:`, errorMessage)
        results.push({ event_id: event.id, success: false, error: errorMessage })
      }
    }

    const successCount = results.filter((r) => r.success).length
    console.log(`[worker-tick] Processed ${successCount}/${results.length} events successfully`)

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[worker-tick] Fatal error:', errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Polls a single event and updates its state
 */
async function pollEvent(event: Event): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient()

  try {
    if (event.event_type === 'team_game') {
      // Import ESPN provider dynamically to avoid loading if not needed
      const { fetchESPNGame, toTeamGamePayload } = await import('../_shared/providers/espn.ts')

      const gameData = await fetchESPNGame(event.sport, event.provider_event_id)

      if (!gameData) {
        return { success: false, error: 'Game not found in ESPN data' }
      }

      const payload = toTeamGamePayload(gameData)

      // Upsert event_state
      const { error: stateError } = await supabase
        .from('event_state')
        .upsert({
          event_id: event.id,
          status: gameData.status,
          payload,
          last_provider_update_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (stateError) {
        return { success: false, error: stateError.message }
      }

      // Update event status if changed
      if (event.status !== gameData.status) {
        await supabase
          .from('events')
          .update({ status: gameData.status, updated_at: new Date().toISOString() })
          .eq('id', event.id)
      }

      console.log(`[poll-event] Updated event ${event.id}: ${gameData.homeTeam} ${gameData.homeScore} - ${gameData.awayScore} ${gameData.awayTeam}`)
      return { success: true }

    } else if (event.event_type === 'golf_tournament') {
      const { fetchGolfTournamentState } = await import('../_shared/providers/slashgolf.ts')

      const rapidApiKey = Deno.env.get('RAPIDAPI_KEY')
      if (!rapidApiKey) {
        return { success: false, error: 'RAPIDAPI_KEY not configured' }
      }

      // Extract year from event start_time or use current year
      const year = event.start_time
        ? new Date(event.start_time).getFullYear()
        : new Date().getFullYear()

      const { payload, status } = await fetchGolfTournamentState(
        rapidApiKey,
        event.provider_event_id,
        year
      )

      // Upsert event_state
      const { error: stateError } = await supabase
        .from('event_state')
        .upsert({
          event_id: event.id,
          status,
          payload,
          last_provider_update_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (stateError) {
        return { success: false, error: stateError.message }
      }

      // Update event status if changed
      if (event.status !== status) {
        await supabase
          .from('events')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', event.id)
      }

      console.log(`[poll-event] Updated golf event ${event.id}: round ${payload.current_round}, ${payload.leaderboard.length} players`)
      return { success: true }

    } else {
      return { success: false, error: `Unsupported event type: ${event.event_type}` }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[poll-event] Error polling event ${event.id}:`, errorMessage)
    return { success: false, error: errorMessage }
  }
}

/**
 * Simple hash function for generating advisory lock IDs
 */
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}
