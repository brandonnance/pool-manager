import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSlashGolfClient } from '@/lib/slashgolf/client'

// Helper to parse rank which may be a plain number or MongoDB Extended JSON
function parseRank(val: unknown): number | undefined {
  if (val === undefined || val === null) return undefined
  if (typeof val === 'number') return val
  if (typeof val === 'object' && val !== null) {
    const mongoVal = val as { $numberInt?: string; $numberLong?: string }
    if (mongoVal.$numberInt) return parseInt(mongoVal.$numberInt)
    if (mongoVal.$numberLong) return parseInt(mongoVal.$numberLong)
  }
  return undefined
}

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

    // Check if entries exist - if so, block tier changes
    const { count: entryCount } = await supabase
      .from('gp_entries')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId)

    if ((entryCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Cannot modify tiers: entries already exist for this pool' },
        { status: 400 }
      )
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
    const { data: fieldData, error: fieldError } = await supabase
      .from('gp_tournament_field')
      .select(`
        golfer_id,
        gp_golfers!inner(id, name, external_player_id)
      `)
      .eq('tournament_id', gpPool.tournament_id)

    if (fieldError) {
      return NextResponse.json({ error: `Database error: ${fieldError.message}` }, { status: 400 })
    }

    if (!fieldData || fieldData.length === 0) {
      return NextResponse.json({ error: 'No golfers in tournament field' }, { status: 400 })
    }

    // Fetch OWGR rankings from Slash Golf API
    const client = getSlashGolfClient()
    const rankingsResponse = await client.getWorldRankings()

    if (!rankingsResponse.rankings) {
      return NextResponse.json({ error: 'Invalid rankings response from API' }, { status: 500 })
    }

    const { yearUsed, usedFallback } = rankingsResponse

    // Build a map of playerId -> rank
    // Note: API may return MongoDB Extended JSON format for some fields
    const rankingsMap = new Map<string, number>()
    rankingsResponse.rankings.forEach((r) => {
      const playerId = r.playerId
      // Handle both plain number and MongoDB Extended JSON format
      const rankValue = parseRank(r.rank)
      if (playerId && rankValue !== undefined) {
        rankingsMap.set(playerId, rankValue)
      }
    })

    console.log(`Loaded ${rankingsMap.size} rankings from API`)

    // Log a few sample rankings for debugging
    const sampleRankings = Array.from(rankingsMap.entries()).slice(0, 5)
    console.log('Sample rankings from API:', sampleRankings)

    // Assign tiers based on OWGR rank
    const tierAssignments: { pool_id: string; golfer_id: string; tier_value: number }[] = []
    const results: { name: string; rank: number | null; tier: number }[] = []
    let matchedCount = 0

    for (const field of fieldData) {
      const golfer = field.gp_golfers
      const externalId = golfer.external_player_id
      const rank = externalId ? rankingsMap.get(externalId) ?? null : null
      const tier = getTierForRank(rank)

      if (rank !== null) {
        matchedCount++
      } else if (externalId) {
        // Log unmatched golfers with external IDs for debugging
        console.log(`No rank found for ${golfer.name} (external_id: ${externalId})`)
      }

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

    // Also update the owgr_rank and headshot_url in gp_golfers
    for (const field of fieldData) {
      const golfer = field.gp_golfers
      const externalId = golfer.external_player_id
      const rank = externalId ? rankingsMap.get(externalId) ?? null : null

      // Build update object
      const updateData: { owgr_rank?: number; headshot_url?: string } = {}

      if (rank) {
        updateData.owgr_rank = rank
      }

      // Generate headshot URL from PGA Tour Cloudinary CDN
      if (externalId) {
        updateData.headshot_url = `https://res.cloudinary.com/pga-tour/image/upload/q_auto,w_200/headshots_${externalId}`
      }

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('gp_golfers')
          .update(updateData)
          .eq('id', golfer.id)
      }
    }

    // Count by tier for summary
    const tierCounts = new Map<number, number>()
    results.forEach(r => {
      tierCounts.set(r.tier, (tierCounts.get(r.tier) || 0) + 1)
    })

    console.log(`Matched ${matchedCount} of ${fieldData.length} golfers to rankings`)

    // Build message with fallback notice if applicable
    let message = `Auto-assigned ${tierAssignments.length} golfers to tiers`
    if (usedFallback) {
      message += ` (Note: ${yearUsed} OWGR rankings used - current year data not yet available)`
    }

    return NextResponse.json({
      success: true,
      message,
      tierCounts: Object.fromEntries(tierCounts),
      totalRanked: results.filter(r => r.rank !== null).length,
      totalUnranked: results.filter(r => r.rank === null).length,
      rankingsLoaded: rankingsMap.size,
      yearUsed,
      usedFallback,
    })

  } catch (error) {
    console.error('Error in auto-tier:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto-assign tiers' },
      { status: 500 }
    )
  }
}
