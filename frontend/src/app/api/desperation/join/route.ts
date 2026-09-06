/**
 * @fileoverview Public self-join for an NFL Desperation pool
 * @route POST /api/desperation/join
 * @auth Public — the pool's slug is all that's needed
 *
 * @description
 * One form on the pool landing page serves new and returning players alike:
 * - email already in the pool and active   → re-send their private link (60s cooldown per entry)
 * - email already in the pool but disabled → do nothing
 * - new email, pool open for joining       → create the entry, email the link
 * - new email, pool closed to joining      → do nothing
 *
 * The link is only ever emailed, never returned to the browser, so registering
 * someone else's address gains nothing. Every outcome returns the same 200 body,
 * so the endpoint can't be used to check whether an address is in the pool. The
 * landing page already tells visitors whether joining is open, so a closed pool
 * only ever shows the "lost your link?" form.
 *
 * @request_body
 * - slug: string
 * - email: string
 * - displayName?: string   optional, ≤40 chars, ignored for existing entries
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getJoinState } from '@/lib/desperation/server'
import { sendInviteEmails, sendResendLinkEmail } from '@/lib/desperation/send'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g
/** Hard ceiling per pool; a 100-person pool never gets near it. */
const MAX_ENTRIES_PER_POOL = 500
/** Don't email the same player their link more than once per minute (DB-backed, so it holds across instances). */
const RESEND_COOLDOWN_MS = 60 * 1000
/** Best-effort per-instance throttle: attempts per IP per pool per hour. */
const RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 20 }
const hits = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || h.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs })
    return false
  }
  h.count++
  return h.count > RATE_LIMIT.max
}

const OK = { success: true, message: 'Check your email for your private link.' }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const displayName =
      typeof body.displayName === 'string' ? body.displayName.replace(CONTROL_CHARS_RE, '').trim().slice(0, 40) : ''
    if (!slug || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (rateLimited(`${ip}:${slug}`)) {
      return NextResponse.json({ error: 'Too many attempts. Try again in a bit.' }, { status: 429 })
    }

    const admin = createAdminClient()
    const { data: ndPool } = await admin.from('nd_pools').select('*').eq('public_slug', slug).maybeSingle()
    if (!ndPool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    const { data: pool } = await admin.from('pools').select('name, status').eq('id', ndPool.pool_id).single()
    if (!pool) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })

    // Returning player: re-send, whether or not joining is open.
    const { data: existing } = await admin
      .from('nd_entries')
      .select('id, email, access_token, active, invite_sent_at')
      .eq('nd_pool_id', ndPool.id)
      .eq('email', email)
      .maybeSingle()
    if (existing) {
      const recentlySent = existing.invite_sent_at
        ? Date.now() - new Date(existing.invite_sent_at).getTime() < RESEND_COOLDOWN_MS
        : false
      if (existing.active && !recentlySent) await sendResendLinkEmail(admin, pool.name, slug, existing)
      return NextResponse.json(OK)
    }

    // Unknown email while joining is closed: same response as everyone else, no email.
    const state = await getJoinState(admin, ndPool, pool.status)
    if (!state.open) return NextResponse.json(OK)

    const { count } = await admin
      .from('nd_entries')
      .select('id', { count: 'exact', head: true })
      .eq('nd_pool_id', ndPool.id)
    if ((count ?? 0) >= MAX_ENTRIES_PER_POOL) {
      return NextResponse.json({ error: 'This pool is full.' }, { status: 403 })
    }

    const { data: entry, error } = await admin
      .from('nd_entries')
      .insert({ nd_pool_id: ndPool.id, email, display_name: displayName || null, joined_week: state.joinWeek ?? 1 })
      .select('id, email, access_token')
      .single()
    if (error || !entry) {
      // Two signups for the same email raced and the other one won. Same outcome for the user.
      if (error?.code === '23505') return NextResponse.json(OK)
      throw error ?? new Error('insert returned no row')
    }

    await sendInviteEmails(admin, pool.name, slug, ndPool.season_year, [entry])
    return NextResponse.json(OK)
  } catch (error) {
    console.error('[nd/join]', error)
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
