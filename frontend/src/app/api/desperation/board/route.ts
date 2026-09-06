/**
 * @fileoverview Week board for a player: games, own picks, revealed picks of others
 * @route GET /api/desperation/board?token=...&week=N
 * @auth Entry access token
 *
 * Polled by the client on game days. Triggers a throttled ESPN refresh when
 * the week has live or recently-kicked-off games and the data is stale.
 * All visibility gating happens in buildBoard().
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextOpenWeek } from '@/lib/desperation/schedule'
import {
  getEntryByToken,
  getWeeks,
  pickCurrentWeek,
  getWeekGames,
  shouldLazySync,
  syncScoresWeek,
  buildBoard,
} from '@/lib/desperation/server'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') ?? ''
    const weekParam = request.nextUrl.searchParams.get('week')

    const admin = createAdminClient()
    const ctx = await getEntryByToken(admin, token)
    if (!ctx) return NextResponse.json({ error: 'Invalid or inactive link' }, { status: 401 })

    const weeks = await getWeeks(admin, ctx.ndPool.season_year)
    const current = pickCurrentWeek(weeks)
    const next = nextOpenWeek(weeks, current)
    const week = weekParam ? weeks.find((w) => w.week_number === Number(weekParam)) ?? current : current
    if (!week) return NextResponse.json({ error: 'Schedule not loaded yet' }, { status: 404 })

    let games = await getWeekGames(admin, week.season_year, week.week_number)
    if (shouldLazySync(games)) {
      try {
        await syncScoresWeek(admin, week.season_year, week.week_number)
        games = await getWeekGames(admin, week.season_year, week.week_number)
      } catch (e) {
        console.error('[nd/board] lazy sync failed', e)
      }
    }

    const board = await buildBoard(admin, ctx, week, games)
    return NextResponse.json({
      ...board,
      currentWeek: current?.week_number ?? null,
      nextOpenWeek: next?.week_number ?? null,
      weeks: weeks.map((w) => ({ week_number: w.week_number, status: w.status, lock_at: w.lock_at })),
      serverNow: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[nd/board]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
