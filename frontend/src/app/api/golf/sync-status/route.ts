import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Sync golf pool status to pools.status
 *
 * This implements "lazy update" - status is checked and updated
 * when the pool is viewed, ensuring time-based transitions
 * (like lock time passing) are reflected in the database.
 *
 * Status logic:
 * - No tournament configured → 'draft'
 * - Tournament completed → 'completed'
 * - Past picks_lock_at → 'locked' (in progress)
 * - Public entries enabled → 'open'
 * - Otherwise → 'draft'
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const body = await request.json()
  const { poolId } = body

  if (!poolId) {
    return NextResponse.json({ error: 'Missing poolId' }, { status: 400 })
  }

  // Get current pool status and type
  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id, status, type')
    .eq('id', poolId)
    .single()

  if (poolError || !pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
  }

  // Only sync golf pools
  if (pool.type !== 'golf') {
    return NextResponse.json({
      status: pool.status,
      synced: false,
      reason: 'Not a golf pool'
    })
  }

  // Get golf pool config
  const { data: gpPool } = await supabase
    .from('gp_pools')
    .select(`
      tournament_id,
      picks_lock_at,
      public_entries_enabled
    `)
    .eq('pool_id', poolId)
    .single()

  if (!gpPool) {
    return NextResponse.json({ error: 'Golf pool config not found' }, { status: 404 })
  }

  // Get tournament status if tournament is linked
  let tournamentStatus: string | null = null
  if (gpPool.tournament_id) {
    const { data: tournament } = await supabase
      .from('gp_tournaments')
      .select('status')
      .eq('id', gpPool.tournament_id)
      .single()
    tournamentStatus = tournament?.status ?? null
  }

  // Compute what the status should be
  const newStatus = computeGolfPoolStatus(
    gpPool.public_entries_enabled ?? false,
    gpPool.picks_lock_at,
    tournamentStatus,
    gpPool.tournament_id
  )

  // Only update if status changed
  if (newStatus !== pool.status) {
    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: newStatus })
      .eq('id', poolId)

    if (updateError) {
      console.error('[sync-status] Failed to update pool status:', updateError)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    console.log(`[sync-status] Pool ${poolId}: ${pool.status} → ${newStatus}`)

    return NextResponse.json({
      status: newStatus,
      synced: true,
      previousStatus: pool.status
    })
  }

  return NextResponse.json({
    status: pool.status,
    synced: false,
    reason: 'Status unchanged'
  })
}

/**
 * Compute what the golf pool status should be based on current state
 */
function computeGolfPoolStatus(
  publicEntriesEnabled: boolean,
  picksLockAt: string | null,
  tournamentStatus: string | null,
  tournamentId: string | null
): 'draft' | 'open' | 'locked' | 'completed' {
  // No tournament configured = draft
  if (!tournamentId) {
    return 'draft'
  }

  // Tournament completed = completed
  if (tournamentStatus === 'completed') {
    return 'completed'
  }

  // Check if picks are locked (past lock time)
  const now = new Date()
  const lockTime = picksLockAt ? new Date(picksLockAt) : null
  const isLocked = lockTime ? now >= lockTime : false

  // Past lock time = locked (in progress)
  if (isLocked) {
    return 'locked'
  }

  // Public entries enabled = open
  if (publicEntriesEnabled) {
    return 'open'
  }

  // Tournament configured but not accepting entries yet = draft
  return 'draft'
}
