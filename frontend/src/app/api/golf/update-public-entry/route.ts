import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Create admin client for server-side operations
function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { entryId, editToken, golferIds } = await request.json()

    if (!entryId || !editToken || !golferIds || !Array.isArray(golferIds)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (golferIds.length !== 6) {
      return NextResponse.json({ error: 'Must select exactly 6 golfers' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Validate entry and token
    const { data: entry, error: entryError } = await supabase
      .from('gp_entries')
      .select(`
        id,
        pool_id,
        edit_token,
        edit_token_expires_at
      `)
      .eq('id', entryId)
      .eq('edit_token', editToken)
      .single()

    if (entryError || !entry) {
      return NextResponse.json({ error: 'Invalid entry or token' }, { status: 404 })
    }

    // Check if token is expired
    const now = new Date()
    if (entry.edit_token_expires_at && new Date(entry.edit_token_expires_at) < now) {
      return NextResponse.json({ error: 'Edit token has expired' }, { status: 403 })
    }

    // Get the gp_pool to check lock time
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('id, picks_lock_at, min_tier_points')
      .eq('pool_id', entry.pool_id)
      .single()

    if (!gpPool) {
      return NextResponse.json({ error: 'Pool configuration not found' }, { status: 404 })
    }

    // Check if picks are locked
    if (gpPool.picks_lock_at && new Date(gpPool.picks_lock_at) < now) {
      return NextResponse.json({ error: 'Entry editing is locked' }, { status: 403 })
    }

    // Validate golfer tier points
    const { data: tierAssignments } = await supabase
      .from('gp_tier_assignments')
      .select('golfer_id, tier_value')
      .eq('pool_id', gpPool.id)
      .in('golfer_id', golferIds)

    if (!tierAssignments || tierAssignments.length !== 6) {
      return NextResponse.json({ error: 'Invalid golfer selection' }, { status: 400 })
    }

    const totalTierPoints = tierAssignments.reduce((sum, t) => sum + t.tier_value, 0)
    const minTierPoints = gpPool.min_tier_points ?? 21

    if (totalTierPoints < minTierPoints) {
      return NextResponse.json(
        { error: `Minimum ${minTierPoints} tier points required, you have ${totalTierPoints}` },
        { status: 400 }
      )
    }

    // Delete existing picks
    const { error: deleteError } = await supabase
      .from('gp_entry_picks')
      .delete()
      .eq('entry_id', entryId)

    if (deleteError) {
      console.error('Failed to delete existing picks:', deleteError)
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    // Insert new picks
    const newPicks = golferIds.map((golferId: string) => ({
      entry_id: entryId,
      golfer_id: golferId,
    }))

    const { error: insertError } = await supabase
      .from('gp_entry_picks')
      .insert(newPicks)

    if (insertError) {
      console.error('Failed to insert new picks:', insertError)
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update public entry error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
