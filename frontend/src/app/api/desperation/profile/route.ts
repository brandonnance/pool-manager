/**
 * @fileoverview Let a player set their own display name
 * @route POST /api/desperation/profile
 * @auth Entry access token
 *
 * @request_body
 * - token: string
 * - displayName: string   (1–40 chars, trimmed)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEntryByToken } from '@/lib/desperation/server'

const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/g

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { token, displayName } = body as { token?: unknown; displayName?: unknown }
    if (typeof token !== 'string' || typeof displayName !== 'string') {
      return NextResponse.json({ error: 'token and displayName required' }, { status: 400 })
    }
    const name = displayName.replace(CONTROL_CHARS_RE, '').trim().slice(0, 40)
    if (name.length < 1) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const admin = createAdminClient()
    const ctx = await getEntryByToken(admin, token)
    if (!ctx) return NextResponse.json({ error: 'Invalid or inactive link' }, { status: 401 })

    const { error } = await admin.from('nd_entries').update({ display_name: name }).eq('id', ctx.entry.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, displayName: name })
  } catch (error) {
    console.error('[nd/profile]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
