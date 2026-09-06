/**
 * @fileoverview Refresh live scores for one week from ESPN, recompute scores
 * @route POST /api/desperation/sync-scores
 * @auth Either a valid entry token (players polling the board) or a commissioner
 *
 * Throttled server-side to one ESPN hit per 20s per week regardless of how
 * many players are polling.
 *
 * @request_body
 * - token?: string        entry access token
 * - seasonYear: number
 * - week: number
 * - force?: boolean       commissioner only; bypass throttle
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEntryByToken, requireSeasonCommissioner, syncScoresWeek } from '@/lib/desperation/server'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const seasonYear = Number(body.seasonYear)
    const week = Number(body.week)
    if (!Number.isInteger(seasonYear) || !Number.isInteger(week)) {
      return NextResponse.json({ error: 'seasonYear and week required' }, { status: 400 })
    }

    const admin = createAdminClient()
    let force = false

    if (typeof body.token === 'string') {
      const ctx = await getEntryByToken(admin, body.token)
      if (!ctx) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      if (ctx.ndPool.season_year !== seasonYear) {
        return NextResponse.json({ error: 'Season mismatch' }, { status: 400 })
      }
    } else {
      const auth = await requireSeasonCommissioner(admin, seasonYear)
      if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
      force = body.force === true
    }

    const result = await syncScoresWeek(admin, seasonYear, week, { force })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[nd/sync-scores]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
