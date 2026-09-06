/**
 * @fileoverview Commissioner-editable NFL Desperation pool settings
 * @route POST /api/desperation/settings
 * @auth Pool commissioner
 *
 * @request_body
 * - ndPoolId: string
 * - self_join_enabled?: boolean     anyone with the public link can create an entry
 * - allow_midseason_join?: boolean  joining stays open after Week 1 (Rule 18)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCommissioner } from '@/lib/desperation/server'
import type { Database } from '@/types/database'

const EDITABLE = ['self_join_enabled', 'allow_midseason_join'] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const ndPoolId = typeof body.ndPoolId === 'string' ? body.ndPoolId : null
    if (!ndPoolId) return NextResponse.json({ error: 'ndPoolId required' }, { status: 400 })

    const admin = createAdminClient()
    const auth = await requireCommissioner(admin, ndPoolId)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const patch: Database['public']['Tables']['nd_pools']['Update'] = {}
    for (const key of EDITABLE) {
      if (typeof body[key] === 'boolean') patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const { data, error } = await admin
      .from('nd_pools')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', ndPoolId)
      .select('self_join_enabled, allow_midseason_join')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error('[nd/settings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
