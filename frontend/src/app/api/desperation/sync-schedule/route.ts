/**
 * @fileoverview Import/refresh the NFL schedule from ESPN
 * @route POST /api/desperation/sync-schedule
 * @auth Super admin or commissioner of any ND pool in the season
 *
 * @request_body
 * - seasonYear: number
 * - weeks?: number[]  (default: 1..18)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSeasonCommissioner, syncScheduleWeek } from '@/lib/desperation/server'
import { REGULAR_SEASON_WEEKS } from '@/lib/desperation/schedule'

/** 18 sequential ESPN fetches can outlast the default serverless budget. */
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const seasonYear = Number(body.seasonYear)
    if (!Number.isInteger(seasonYear)) {
      return NextResponse.json({ error: 'seasonYear required' }, { status: 400 })
    }
    const weeks: number[] = Array.isArray(body.weeks) && body.weeks.length
      ? body.weeks.map(Number).filter((w: number) => Number.isInteger(w) && w >= 1 && w <= REGULAR_SEASON_WEEKS)
      : Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1)

    const admin = createAdminClient()
    const auth = await requireSeasonCommissioner(admin, seasonYear)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const results: Array<{ week: number; games: number; movedGames: number; error?: string }> = []
    for (const week of weeks) {
      try {
        const r = await syncScheduleWeek(admin, seasonYear, week)
        results.push({ week, ...r })
      } catch (e) {
        results.push({ week, games: 0, movedGames: 0, error: e instanceof Error ? e.message : 'unknown' })
      }
    }
    return NextResponse.json({ success: true, seasonYear, results })
  } catch (error) {
    console.error('[nd/sync-schedule]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
