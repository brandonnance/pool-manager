/**
 * @fileoverview Save or clear a pick
 * @route POST /api/desperation/pick
 * @auth Entry access token
 *
 * Enforces the lock rules server-side (Rule 4): a game is editable only while
 * now < min(kickoff, week lock) and the game is still 'scheduled'.
 *
 * @request_body
 * - token: string
 * - gameId: string
 * - selection: 'home' | 'away' | null   (null clears the pick)
 *
 * @response
 * - picks: Record<gameId, 'home'|'away'>   the entry's full pick set for that week
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEntryByToken, getWeeks } from '@/lib/desperation/server'
import { maxPickableWeek } from '@/lib/desperation/schedule'
import { canEditPick } from '@/lib/desperation/visibility'
import type { GameStatus } from '@/lib/desperation/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { token, gameId, selection } = body as { token?: unknown; gameId?: unknown; selection?: unknown }

    if (typeof token !== 'string' || typeof gameId !== 'string') {
      return NextResponse.json({ error: 'token and gameId required' }, { status: 400 })
    }
    if (selection !== 'home' && selection !== 'away' && selection !== null) {
      return NextResponse.json({ error: 'selection must be home, away, or null' }, { status: 400 })
    }

    const admin = createAdminClient()
    const ctx = await getEntryByToken(admin, token)
    if (!ctx) return NextResponse.json({ error: 'Invalid or inactive link' }, { status: 401 })

    const { data: game } = await admin
      .from('nd_games')
      .select('id, season_year, week_number, kickoff_at, status')
      .eq('id', gameId)
      .single()
    if (!game || game.season_year !== ctx.ndPool.season_year) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const now = new Date()
    const weeks = await getWeeks(admin, game.season_year)
    const week = weeks.find((w) => w.week_number === game.week_number)
    if (!week) return NextResponse.json({ error: 'Week not found' }, { status: 404 })

    // Midseason joiners can't pick weeks before they joined (Rule 18)
    if (game.week_number < ctx.entry.joined_week) {
      return NextResponse.json({ error: 'You joined after this week' }, { status: 403 })
    }

    // Only the current week, plus the next one once the current week has locked
    if (game.week_number > maxPickableWeek(weeks, now)) {
      return NextResponse.json({ error: `Week ${game.week_number} isn't open for picks yet` }, { status: 403 })
    }

    if (!canEditPick({ kickoff_at: game.kickoff_at, status: game.status as GameStatus }, week, now)) {
      return NextResponse.json({ error: 'This game is locked', locked: true }, { status: 409 })
    }

    if (selection === null) {
      await admin.from('nd_picks').delete().eq('entry_id', ctx.entry.id).eq('game_id', game.id)
    } else {
      const { error } = await admin
        .from('nd_picks')
        .upsert({ entry_id: ctx.entry.id, game_id: game.id, selection }, { onConflict: 'entry_id,game_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return the full pick set for this week so the client can reconcile
    const { data: weekGames } = await admin
      .from('nd_games')
      .select('id')
      .eq('season_year', game.season_year)
      .eq('week_number', game.week_number)
    const { data: picks } = await admin
      .from('nd_picks')
      .select('game_id, selection')
      .eq('entry_id', ctx.entry.id)
      .in('game_id', (weekGames ?? []).map((g) => g.id))

    return NextResponse.json({
      success: true,
      picks: Object.fromEntries((picks ?? []).map((p) => [p.game_id, p.selection])),
      savedAt: now.toISOString(),
    })
  } catch (error) {
    console.error('[nd/pick]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
