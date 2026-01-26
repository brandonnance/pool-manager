/**
 * @fileoverview Event Discovery Edge Function
 *
 * Discovers upcoming events from external providers and creates/updates
 * records in the events table. This enables the pool creation wizard to
 * show available events without manual data entry.
 *
 * Supported providers:
 * - ESPN: NFL playoff games
 * - SlashGolf: PGA tournaments (schedule API - future)
 *
 * Scheduled to run daily via pg_cron.
 *
 * @route POST /functions/v1/event-discovery
 */

import { createServiceClient } from '../_shared/supabase-client.ts'
import { fetchAllESPNGames, type ESPNGameData } from '../_shared/providers/espn.ts'
import type { Sport, EventStatus } from '../_shared/types.ts'

interface DiscoveryResult {
  sport: Sport
  discovered: number
  created: number
  updated: number
  errors: string[]
}

interface DiscoveryResponse {
  success: boolean
  results: DiscoveryResult[]
  total_discovered: number
  total_created: number
  total_updated: number
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  console.log('[event-discovery] Starting event discovery')

  const supabase = createServiceClient()
  const results: DiscoveryResult[] = []

  try {
    // Check if global events is enabled
    const { data: configData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'global_events_config')
      .single()

    const config = configData?.value as { enabled: boolean } | null

    if (!config?.enabled) {
      console.log('[event-discovery] Global events disabled, skipping')
      return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Discover NFL events
    const nflResult = await discoverNFLEvents(supabase)
    results.push(nflResult)

    // TODO: Add PGA tournament discovery when schedule API is available
    // const pgaResult = await discoverPGAEvents(supabase)
    // results.push(pgaResult)

    const totalDiscovered = results.reduce((sum, r) => sum + r.discovered, 0)
    const totalCreated = results.reduce((sum, r) => sum + r.created, 0)
    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0)

    console.log(`[event-discovery] Complete: ${totalDiscovered} discovered, ${totalCreated} created, ${totalUpdated} updated`)

    const response: DiscoveryResponse = {
      success: true,
      results,
      total_discovered: totalDiscovered,
      total_created: totalCreated,
      total_updated: totalUpdated,
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[event-discovery] Fatal error:', errorMessage)
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

/**
 * Discovers NFL playoff games from ESPN and creates/updates events
 */
async function discoverNFLEvents(
  supabase: ReturnType<typeof createServiceClient>
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    sport: 'nfl',
    discovered: 0,
    created: 0,
    updated: 0,
    errors: [],
  }

  try {
    console.log('[event-discovery] Fetching NFL games from ESPN')
    const games = await fetchAllESPNGames('nfl')
    result.discovered = games.length
    console.log(`[event-discovery] Found ${games.length} NFL games`)

    for (const game of games) {
      try {
        await upsertEvent(supabase, game, 'nfl', result)
      } catch (err) {
        const errorMsg = `Failed to upsert ${game.name}: ${err instanceof Error ? err.message : 'Unknown'}`
        console.error(`[event-discovery] ${errorMsg}`)
        result.errors.push(errorMsg)
      }
    }

  } catch (err) {
    const errorMsg = `NFL discovery failed: ${err instanceof Error ? err.message : 'Unknown'}`
    console.error(`[event-discovery] ${errorMsg}`)
    result.errors.push(errorMsg)
  }

  return result
}

/**
 * Upserts an event from ESPN data
 */
async function upsertEvent(
  supabase: ReturnType<typeof createServiceClient>,
  game: ESPNGameData,
  sport: Sport,
  result: DiscoveryResult
): Promise<void> {
  // Check if event already exists
  const { data: existing } = await supabase
    .from('events')
    .select('id, start_time, status, name, metadata')
    .eq('sport', sport)
    .eq('provider', 'espn')
    .eq('provider_event_id', game.espnGameId)
    .single()

  // Build metadata object
  const metadata = {
    home_team: game.homeTeam,
    away_team: game.awayTeam,
    short_name: game.shortName,
    round_name: game.roundName,
  }

  if (existing) {
    // Always update metadata if it's empty or missing round_name
    const existingMetadata = (existing as { metadata?: Record<string, unknown> }).metadata || {}
    const metadataEmpty = Object.keys(existingMetadata).length === 0
    const missingRoundName = !existingMetadata.round_name && game.roundName

    // Update if start_time was null, status changed, or metadata needs updating
    const needsUpdate =
      (!existing.start_time && game.startTime) ||
      existing.status !== game.status ||
      existing.name !== game.name ||
      metadataEmpty ||
      missingRoundName

    if (needsUpdate) {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      if (!existing.start_time && game.startTime) {
        updateData.start_time = game.startTime
      }
      if (existing.status !== game.status) {
        updateData.status = game.status
      }
      if (existing.name !== game.name) {
        updateData.name = game.name
      }
      if (metadataEmpty || missingRoundName) {
        updateData.metadata = metadata
      }

      const { error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', existing.id)

      if (error) {
        throw error
      }

      result.updated++
      console.log(`[event-discovery] Updated: ${game.name}`)
    }
  } else {
    // Create new event
    const { error } = await supabase
      .from('events')
      .insert({
        sport,
        event_type: 'team_game',
        provider: 'espn',
        provider_event_id: game.espnGameId,
        name: game.name,
        start_time: game.startTime,
        status: game.status,
        metadata,
      })

    if (error) {
      // Check for unique constraint violation (race condition)
      if (error.code === '23505') {
        console.log(`[event-discovery] Event already exists (race): ${game.name}`)
        return
      }
      throw error
    }

    result.created++
    console.log(`[event-discovery] Created: ${game.name} (${game.startTime || 'TBD'})`)
  }
}
