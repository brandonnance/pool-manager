/**
 * @fileoverview NFL Desperation player page
 * @route /desperation/[slug]/e/[token]
 * @auth Entry access token (the URL is the credential)
 *
 * @description
 * A player's home for the season: make picks, watch the board, see standings.
 * Server component validates the token with the service-role client, loads
 * the current week (lazy-refreshing scores if stale), and hands the
 * visibility-gated board to the client app.
 */
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getPoolPermissions } from '@/lib/permissions'
import { nextOpenWeek } from '@/lib/desperation/schedule'
import {
  getEntryByToken,
  isDisabledEntry,
  getWeeks,
  pickCurrentWeek,
  getWeekGames,
  shouldLazySync,
  syncScoresWeek,
  buildBoard,
  entryDisplayName,
} from '@/lib/desperation/server'
import { PlayerApp } from '@/components/desperation/player-app'
import type { BoardPayload } from '@/lib/desperation/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string; token: string }>
}

/**
 * If the browser also carries a dashboard login for a commissioner of this pool,
 * return the pool admin URL so the header can offer a way back. Players with no
 * account (the normal case) get null. Never affects what the page shows otherwise.
 */
async function commissionerBackLink(pool: { id: string; org_id: string }): Promise<string | null> {
  try {
    const session = await createClient()
    const { data: { user } } = await session.auth.getUser()
    if (!user) return null
    const perms = await getPoolPermissions(session, user.id, pool.id, pool.org_id)
    return perms.isPoolCommissioner ? `/pools/${pool.id}` : null
  } catch {
    return null
  }
}

export default async function DesperationPlayerPage({ params }: PageProps) {
  const { slug, token } = await params
  const admin = createAdminClient()

  const ctx = await getEntryByToken(admin, token)
  if (!ctx) {
    if (await isDisabledEntry(admin, token)) {
      return (
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">This entry is disabled</h1>
          <p className="mt-2 text-muted-foreground">
            The commissioner turned off this entry. If that&apos;s a mistake, ask them to re-enable it.
          </p>
        </main>
      )
    }
    notFound()
  }
  if (ctx.ndPool.public_slug !== slug) notFound()

  const [weeks, adminHref] = await Promise.all([
    getWeeks(admin, ctx.ndPool.season_year),
    commissionerBackLink(ctx.pool),
  ])
  const current = pickCurrentWeek(weeks)

  if (!current) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold">{ctx.pool.name}</h1>
        <p className="mt-2 text-muted-foreground">The schedule hasn&apos;t been loaded yet. Check back soon.</p>
      </main>
    )
  }

  let games = await getWeekGames(admin, current.season_year, current.week_number)
  if (shouldLazySync(games)) {
    try {
      await syncScoresWeek(admin, current.season_year, current.week_number)
      games = await getWeekGames(admin, current.season_year, current.week_number)
    } catch (e) {
      console.error('[nd/player-page] lazy sync failed', e)
    }
  }

  const board = await buildBoard(admin, ctx, current, games)
  const payload: BoardPayload = {
    ...board,
    currentWeek: current.week_number,
    nextOpenWeek: nextOpenWeek(weeks, current)?.week_number ?? null,
    weeks: weeks.map((w) => ({ week_number: w.week_number, status: w.status, lock_at: w.lock_at })),
    serverNow: new Date().toISOString(),
  }

  return (
    <main className="min-h-dvh bg-background">
      <PlayerApp token={token} poolName={ctx.pool.name} entryName={entryDisplayName(ctx.entry)} initial={payload} adminHref={adminHref} />
    </main>
  )
}
