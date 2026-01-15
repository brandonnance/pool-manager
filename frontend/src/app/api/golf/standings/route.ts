import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateGolferScore, calculateEntryScore } from '@/lib/golf/scoring'

// GET /api/golf/standings?poolId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const poolId = request.nextUrl.searchParams.get('poolId')
  if (!poolId) {
    return NextResponse.json({ error: 'Missing poolId' }, { status: 400 })
  }

  // Get golf pool config
  const { data: gpPool } = await supabase
    .from('gp_pools')
    .select('id, tournament_id')
    .eq('pool_id', poolId)
    .single()

  if (!gpPool || !gpPool.tournament_id) {
    return NextResponse.json({ error: 'Golf pool not configured' }, { status: 404 })
  }

  // Get tournament info including par
  const { data: tournament } = await supabase
    .from('gp_tournaments')
    .select('par')
    .eq('id', gpPool.tournament_id)
    .single()

  const parPerRound = tournament?.par ?? 72
  const totalPar = parPerRound * 4 // 4 rounds

  // Get all entries for this pool
  const { data: entries } = await supabase
    .from('gp_entries')
    .select('id, entry_name, entry_number, user_id, participant_name')
    .eq('pool_id', poolId)

  if (!entries || entries.length === 0) {
    return NextResponse.json({ standings: [] })
  }

  // Get user profiles (filter out null user_ids for public entries)
  const userIds = [...new Set(entries.map(e => e.user_id).filter((id): id is string => id !== null))]
  const { data: profiles } = userIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)
    : { data: [] }

  const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) || [])

  // Get all entry picks
  const entryIds = entries.map(e => e.id)
  const { data: picks } = await supabase
    .from('gp_entry_picks')
    .select('entry_id, golfer_id')
    .in('entry_id', entryIds)

  // Get golfer info
  const golferIds = [...new Set(picks?.map(p => p.golfer_id) || [])]
  const { data: golfers } = await supabase
    .from('gp_golfers')
    .select('id, name')
    .in('id', golferIds)

  const golferMap = new Map(golfers?.map(g => [g.id, g.name]) || [])

  // Get tier assignments
  const { data: tiers } = await supabase
    .from('gp_tier_assignments')
    .select('golfer_id, tier_value')
    .eq('pool_id', gpPool.id)

  const tierMap = new Map(tiers?.map(t => [t.golfer_id, t.tier_value]) || [])

  // Get golfer results
  const { data: results } = await supabase
    .from('gp_golfer_results')
    .select('golfer_id, round_1, round_2, round_3, round_4, made_cut, total_score')
    .eq('tournament_id', gpPool.tournament_id)

  const resultMap = new Map(results?.map(r => [r.golfer_id, r]) || [])

  // Build standings
  const standings = entries.map(entry => {
    const entryPicks = picks?.filter(p => p.entry_id === entry.id) || []
    
    // Calculate scores for each golfer
    const golferScores = entryPicks.map(pick => {
      const result = resultMap.get(pick.golfer_id)
      const madeCut = result?.made_cut ?? true
      const totalScore = calculateGolferScore(
        result?.round_1,
        result?.round_2,
        result?.round_3,
        result?.round_4,
        madeCut
      )

      return {
        golferId: pick.golfer_id,
        golferName: golferMap.get(pick.golfer_id) ?? 'Unknown',
        tier: tierMap.get(pick.golfer_id) ?? 5,
        round1: result?.round_1 ?? null,
        round2: result?.round_2 ?? null,
        round3: result?.round_3 ?? null,
        round4: result?.round_4 ?? null,
        totalScore,
        madeCut,
        counted: false, // Will be set by calculateEntryScore
      }
    })

    // Calculate entry score (best 4 of 6)
    const { totalScore, countedGolfers, droppedGolfers } = calculateEntryScore(golferScores)

    // Merge counted flags back
    const allGolferScores = [
      ...countedGolfers,
      ...droppedGolfers,
    ]

    // For public entries (no user_id), use participant_name; otherwise use profile display name
    const userName = entry.user_id
      ? profileMap.get(entry.user_id) ?? null
      : entry.participant_name ?? null

    return {
      entryId: entry.id,
      entryName: entry.entry_name,
      userName,
      userId: entry.user_id,
      score: golferScores.length === 6 ? totalScore : null,
      golferScores: allGolferScores,
    }
  })

  // Sort by score and assign ranks
  standings.sort((a, b) => {
    if (a.score === null && b.score === null) return 0
    if (a.score === null) return 1
    if (b.score === null) return -1
    return a.score - b.score
  })

  // Count how many entries have each score to determine ties
  const scoreCounts = new Map<number, number>()
  standings.forEach(entry => {
    if (entry.score !== null) {
      scoreCounts.set(entry.score, (scoreCounts.get(entry.score) || 0) + 1)
    }
  })

  let currentRank = 1

  const rankedStandings = standings.map((entry, index) => {
    // Check if this score appears more than once (tied)
    const tied = entry.score !== null && (scoreCounts.get(entry.score) || 0) > 1

    // Update rank: if this is a new score, update to current position
    if (index > 0 && entry.score !== standings[index - 1].score && entry.score !== null) {
      currentRank = index + 1
    }

    return {
      ...entry,
      rank: entry.score !== null ? currentRank : standings.length + 1,
      tied,
    }
  })

  return NextResponse.json({
    standings: rankedStandings,
    parPerRound,
    totalPar,
  })
}
