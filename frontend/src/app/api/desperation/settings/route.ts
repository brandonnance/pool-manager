/**
 * @fileoverview Commissioner-editable NFL Desperation pool settings
 * @route POST /api/desperation/settings
 * @auth Pool commissioner
 *
 * @request_body
 * - ndPoolId: string
 * - self_join_enabled?: boolean     anyone with the public link can create an entry
 * - allow_midseason_join?: boolean  joining stays open after Week 1 (Rule 18)
 * - pool_status?: 'open'            move a draft pool to open (pools.status); the public join
 *                                   link rejects everyone while the pool is still a draft
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCommissioner } from '@/lib/desperation/server'
import type { Database } from '@/types/database'

const EDITABLE = ['self_join_enabled', 'allow_midseason_join'] as const
/** The only pools.status change this route performs. Completion is a separate, end-of-season action. */
const OPENABLE_FROM = new Set(['draft'])

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
    const wantsOpen = body.pool_status === 'open'
    if (Object.keys(patch).length === 0 && !wantsOpen) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    let poolStatus: string | undefined
    if (wantsOpen) {
      const { data: current } = await admin.from('pools').select('status').eq('id', auth.pool.id).single()
      if (!current) return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
      if (current.status !== 'open') {
        if (!OPENABLE_FROM.has(current.status)) {
          return NextResponse.json({ error: `Pool is ${current.status}; only a draft pool can be opened here` }, { status: 409 })
        }
        const { error: statusError } = await admin.from('pools').update({ status: 'open' }).eq('id', auth.pool.id)
        if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 })
      }
      poolStatus = 'open'
    }

    let settings = { self_join_enabled: auth.ndPool.self_join_enabled, allow_midseason_join: auth.ndPool.allow_midseason_join }
    if (Object.keys(patch).length > 0) {
      const { data, error } = await admin
        .from('nd_pools')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', ndPoolId)
        .select('self_join_enabled, allow_midseason_join')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      settings = data
    }

    return NextResponse.json({ success: true, ...settings, ...(poolStatus ? { pool_status: poolStatus } : {}) })
  } catch (error) {
    console.error('[nd/settings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
