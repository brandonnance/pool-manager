/**
 * @fileoverview Manage entries for an ND pool (commissioner)
 * @route GET    /api/desperation/entries?ndPoolId=   list entries (with links)
 * @route POST   /api/desperation/entries              import emails, resend invites, or add self
 * @route PATCH  /api/desperation/entries              disable / re-enable entries
 * @route DELETE /api/desperation/entries              remove entries for good (picks + scores go too)
 *
 * @request_body (POST)
 * - ndPoolId: string
 * - emails: string[]          one per person; duplicates within the pool are skipped
 * - sendInvites?: boolean     default true
 * - resendTo?: string[]       entry ids to (re)send invites to, instead of importing
 * - self?: true               add the signed-in commissioner as a player (no invite email)
 *
 * @request_body (PATCH)
 * - ndPoolId: string
 * - entryIds: string[]
 * - active: boolean           false = disabled: link stops working, hidden from board and standings
 *
 * @request_body (DELETE)
 * - ndPoolId: string
 * - entryIds: string[]
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCommissioner, getWeeks } from '@/lib/desperation/server'
import { joinWeekFor } from '@/lib/desperation/schedule'
import { entryUrl } from '@/lib/desperation/emails'
import { sendInviteEmails } from '@/lib/desperation/send'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_BATCH = 500

export async function GET(request: NextRequest) {
  const ndPoolId = request.nextUrl.searchParams.get('ndPoolId')
  if (!ndPoolId) return NextResponse.json({ error: 'ndPoolId required' }, { status: 400 })

  const admin = createAdminClient()
  const auth = await requireCommissioner(admin, ndPoolId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data: entries } = await admin
    .from('nd_entries')
    .select('id, email, display_name, access_token, active, joined_week, invite_sent_at, last_seen_at, created_at')
    .eq('nd_pool_id', ndPoolId)
    .order('created_at')

  const slug = auth.ndPool.public_slug
  return NextResponse.json({
    entries: (entries ?? []).map((e) => ({ ...e, url: slug ? entryUrl(slug, e.access_token) : null })),
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const ndPoolId = typeof body.ndPoolId === 'string' ? body.ndPoolId : null
    if (!ndPoolId) return NextResponse.json({ error: 'ndPoolId required' }, { status: 400 })

    const admin = createAdminClient()
    const auth = await requireCommissioner(admin, ndPoolId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const slug = auth.ndPool.public_slug
    if (!slug) return NextResponse.json({ error: 'Pool has no public slug; set one before inviting' }, { status: 400 })

    const sendInvites = body.sendInvites !== false
    const joinedWeek = async () => joinWeekFor(await getWeeks(admin, auth.ndPool.season_year)) ?? 1

    // Mode 0: the commissioner adds themself as a player. No invite email — they're
    // looking at the link on the dashboard already.
    if (body.self === true) {
      const email = auth.email
      if (!email || !EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'Your account has no usable email address' }, { status: 400 })
      }
      const { data: existing } = await admin
        .from('nd_entries')
        .select('id, email, access_token')
        .eq('nd_pool_id', ndPoolId)
        .eq('email', email)
        .maybeSingle()
      let entry = existing
      if (!entry) {
        const { data, error } = await admin
          .from('nd_entries')
          .insert({ nd_pool_id: ndPoolId, email, display_name: auth.displayName, joined_week: await joinedWeek() })
          .select('id, email, access_token')
          .single()
        if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
        entry = data
      }
      return NextResponse.json({
        success: true,
        created: existing ? 0 : 1,
        entry: { ...entry, url: entryUrl(slug, entry.access_token) },
      })
    }

    // Mode 1: resend to existing entries
    if (Array.isArray(body.resendTo)) {
      const ids = body.resendTo.filter((x: unknown) => typeof x === 'string')
      const { data: targets } = await admin
        .from('nd_entries')
        .select('id, email, access_token')
        .eq('nd_pool_id', ndPoolId)
        .eq('active', true)
        .in('id', ids)
      const sent = await sendInviteEmails(admin, auth.pool.name, slug, auth.ndPool.season_year, targets ?? [])
      return NextResponse.json({ success: true, sent })
    }

    // Mode 2: import emails
    const raw: unknown[] = Array.isArray(body.emails) ? body.emails : []
    const emails = Array.from(
      new Set(raw.filter((x): x is string => typeof x === 'string').map((s) => s.trim().toLowerCase()).filter((s) => EMAIL_RE.test(s)))
    )
    if (emails.length === 0) return NextResponse.json({ error: 'No valid emails' }, { status: 400 })

    const { data: existing } = await admin.from('nd_entries').select('email').eq('nd_pool_id', ndPoolId)
    const have = new Set((existing ?? []).map((e) => e.email))
    const toCreate = emails.filter((e) => !have.has(e))

    let created: Array<{ id: string; email: string; access_token: string }> = []
    if (toCreate.length) {
      const jw = await joinedWeek()
      const { data, error } = await admin
        .from('nd_entries')
        .insert(toCreate.map((email) => ({ nd_pool_id: ndPoolId, email, joined_week: jw })))
        .select('id, email, access_token')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      created = data ?? []
    }

    const sent = sendInvites ? await sendInviteEmails(admin, auth.pool.name, slug, auth.ndPool.season_year, created) : 0
    return NextResponse.json({
      success: true,
      created: created.length,
      skipped: emails.length - toCreate.length,
      sent,
    })
  } catch (error) {
    console.error('[nd/entries]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function parseIds(body: Record<string, unknown>): { ndPoolId: string | null; entryIds: string[] } {
  const ndPoolId = typeof body.ndPoolId === 'string' ? body.ndPoolId : null
  const entryIds = Array.isArray(body.entryIds)
    ? Array.from(new Set(body.entryIds.filter((x): x is string => typeof x === 'string'))).slice(0, MAX_BATCH)
    : []
  return { ndPoolId, entryIds }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { ndPoolId, entryIds } = parseIds(body)
    if (!ndPoolId || entryIds.length === 0 || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'ndPoolId, entryIds and active required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const auth = await requireCommissioner(admin, ndPoolId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data, error } = await admin
      .from('nd_entries')
      .update({ active: body.active })
      .eq('nd_pool_id', ndPoolId)
      .in('id', entryIds)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, updated: data?.length ?? 0 })
  } catch (error) {
    console.error('[nd/entries PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { ndPoolId, entryIds } = parseIds(body)
    if (!ndPoolId || entryIds.length === 0) {
      return NextResponse.json({ error: 'ndPoolId and entryIds required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const auth = await requireCommissioner(admin, ndPoolId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // nd_picks and nd_week_scores cascade on entry delete
    const { data, error } = await admin
      .from('nd_entries')
      .delete()
      .eq('nd_pool_id', ndPoolId)
      .in('id', entryIds)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, deleted: data?.length ?? 0 })
  } catch (error) {
    console.error('[nd/entries DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
