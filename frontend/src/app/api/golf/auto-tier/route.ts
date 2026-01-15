import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSlashGolfClient } from '@/lib/slashgolf/client'

// OWGR rank ranges for each tier
// Tier = Points (lower tier = better player = fewer points)
const TIER_RANGES = [
  { tier: 1, minRank: 1, maxRank: 15 },    // Elite
  { tier: 2, minRank: 16, maxRank: 40 },   // Top players
  { tier: 3, minRank: 41, maxRank: 75 },   // Solid players
  { tier: 4, minRank: 76, maxRank: 125 },  // Mid-tier
  { tier: 5, minRank: 126, maxRank: 200 }, // Lower tier
  { tier: 6, minRank: 201, maxRank: 9999 }, // Longshots / unranked
]

function getTierForRank(rank: number | null): number {
  if (!rank) return 6 // Unranked golfers go to tier 6

  for (const range of TIER_RANGES) {
    if (rank >= range.minRank && rank <= range.maxRank) {
      return range.tier
    }
  }

  return 6 // Default to tier 6
}

export async function POST(request: NextRequest) {
  try {
    const { poolId } = await request.json()

    if (!poolId) {
      return NextResponse.json({ error: 'Pool ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify user is commissioner
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get pool info
    const { data: pool } = await supabase
      .from('pools')
      .select('org_id')
      .eq('id', poolId)
      .single()

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    // Check commissioner access
    const { data: poolMembership } = await supabase
      .from('pool_memberships')
      .select('role')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .single()

    const { data: orgMembership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', pool.org_id)
      .eq('user_id', user.id)
      .single()

    const isCommissioner = poolMembership?.role === 'commissioner' || orgMembership?.role === 'admin'
    if (!isCommissioner) {
      return NextResponse.json({ error: 'Must be commissioner' }, { status: 403 })
    }

    // Get golf pool config
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('id, tournament_id')
      .eq('pool_id', poolId)
      .single()

    if (!gpPool || !gpPool.tournament_id) {
      return NextResponse.json({ error: 'Golf pool not configured or no tournament linked' }, { status: 400 })
    }

    // Get golfers in the tournament field
    console.log('Querying tournament field for tournament_id:', gpPool.tournament_id)

    const { data: fieldData, error: fieldError } = await supabase
      .from('gp_tournament_field')
      .select(`
        golfer_id,
        gp_golfers!inner(id, name, external_player_id)
      `)
      .eq('tournament_id', gpPool.tournament_id)

    console.log('Field query result:', { fieldData: fieldData?.length, fieldError })

    if (fieldError) {
      console.error('Field query error:', fieldError)
      return NextResponse.json({ error: `Database error: ${fieldError.message}` }, { status: 400 })
    }

    if (!fieldData || fieldData.length === 0) {
      // Try a simpler query to debug
      const { data: simpleField, error: simpleError } = await supabase
        .from('gp_tournament_field')
        .select('*')
        .eq('tournament_id', gpPool.tournament_id)

      console.log('Simple field query:', { count: simpleField?.length, error: simpleError })

      return NextResponse.json({
        error: 'No golfers in tournament field',
        debug: {
          tournamentId: gpPool.tournament_id,
          simpleQueryCount: simpleField?.length || 0,
          simpleError: simpleError?.message
        }
      }, { status: 400 })
    }

    // Fetch OWGR rankings from Slash Golf API
    const client = getSlashGolfClient()
    const rankingsResponse = await client.getWorldRankings()

    // Build a map of playerId -> rank
    const rankingsMap = new Map<string, number>()
    rankingsResponse.rankings.forEach(r => {
      rankingsMap.set(r.playerId, r.rank)
    })

    // Assign tiers based on OWGR rank
    const tierAssignments: { pool_id: string; golfer_id: string; tier_value: number }[] = []
    const results: { name: string; rank: number | null; tier: number }[] = []

    for (const field of fieldData) {
      const golfer = field.gp_golfers
      const externalId = golfer.external_player_id
      const rank = externalId ? rankingsMap.get(externalId) ?? null : null
      const tier = getTierForRank(rank)

      tierAssignments.push({
        pool_id: gpPool.id,
        golfer_id: golfer.id,
        tier_value: tier,
      })

      results.push({
        name: golfer.name,
        rank,
        tier,
      })
    }

    // Upsert all tier assignments
    const { error: upsertError } = await supabase
      .from('gp_tier_assignments')
      .upsert(tierAssignments, {
        onConflict: 'pool_id,golfer_id',
      })

    if (upsertError) {
      console.error('Error upserting tier assignments:', upsertError)
      return NextResponse.json({ error: 'Failed to save tier assignments' }, { status: 500 })
    }

    // Also update the owgr_rank in gp_golfers for reference
    for (const field of fieldData) {
      const golfer = field.gp_golfers
      const externalId = golfer.external_player_id
      const rank = externalId ? rankingsMap.get(externalId) ?? null : null

      if (rank) {
        await supabase
          .from('gp_golfers')
          .update({ owgr_rank: rank })
          .eq('id', golfer.id)
      }
    }

    // Count by tier for summary
    const tierCounts = new Map<number, number>()
    results.forEach(r => {
      tierCounts.set(r.tier, (tierCounts.get(r.tier) || 0) + 1)
    })

    return NextResponse.json({
      success: true,
      message: `Auto-assigned ${tierAssignments.length} golfers to tiers`,
      tierCounts: Object.fromEntries(tierCounts),
      totalRanked: results.filter(r => r.rank !== null).length,
      totalUnranked: results.filter(r => r.rank === null).length,
    })

  } catch (error) {
    console.error('Error in auto-tier:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto-assign tiers' },
      { status: 500 }
    )
  }
}
