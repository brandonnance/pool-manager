/**
 * @fileoverview Public golf pool entry/leaderboard page
 * @route /pools/golf/[slug]
 * @auth Public (no authentication required)
 *
 * @description
 * Public page for golf pools that allows anyone to submit entries
 * before the lock time, or view the leaderboard after lock.
 * Same URL behaves differently based on picks_lock_at time.
 *
 * @features
 * - Before lock: Entry form with pick sheet
 * - After lock: Public leaderboard with scores
 * - Live countdown timer to lock
 * - Blocking modal when lock time passes
 */
import { notFound } from 'next/navigation'

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { GolfPublicEntryForm } from '@/components/golf/golf-public-entry-form'
import { GolfPublicLeaderboard } from '@/components/golf/golf-public-leaderboard'

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * Create an anonymous Supabase client for public access
 */
function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function GolfPublicPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = createAnonClient()

  console.log('[GolfPublicPage] Looking up slug:', slug)

  // Look up pool by public_slug where public_entries_enabled = true
  const { data: gpPool, error: gpPoolError } = await supabase
    .from('gp_pools')
    .select(`
      id,
      pool_id,
      tournament_id,
      min_tier_points,
      picks_lock_at,
      public_slug,
      public_entries_enabled
    `)
    .eq('public_slug', slug)
    .eq('public_entries_enabled', true)
    .single()

  console.log('[GolfPublicPage] gp_pools result:', { gpPool, error: gpPoolError?.message })

  if (!gpPool) {
    console.log('[GolfPublicPage] 404: gp_pools not found')
    notFound()
  }

  // Get pool info
  const { data: pool, error: poolError } = await supabase
    .from('pools')
    .select('id, name')
    .eq('id', gpPool.pool_id)
    .single()

  console.log('[GolfPublicPage] pools result:', { pool, error: poolError?.message })

  if (!pool) {
    console.log('[GolfPublicPage] 404: pools not found')
    notFound()
  }

  // Get tournament info
  const { data: tournament, error: tournamentError } = gpPool.tournament_id
    ? await supabase
        .from('gp_tournaments')
        .select('id, name, start_date, end_date, venue, course_name')
        .eq('id', gpPool.tournament_id)
        .single()
    : { data: null, error: null }

  console.log('[GolfPublicPage] gp_tournaments result:', { tournament, error: tournamentError?.message })

  if (!tournament) {
    console.log('[GolfPublicPage] 404: tournament not found')
    notFound()
  }

  // Get tier assignments with golfer info for the pick sheet
  const { data: tierAssignments } = await supabase
    .from('gp_tier_assignments')
    .select(`
      id,
      golfer_id,
      tier_value,
      gp_golfers!inner (
        id,
        name,
        country,
        headshot_url,
        owgr_rank
      )
    `)
    .eq('pool_id', gpPool.id)
    .order('tier_value', { ascending: true })

  const golfersByTier = (tierAssignments ?? []).reduce<Record<number, Array<{
    id: string
    name: string
    country: string | null
    headshot_url: string | null
    owgr_rank: number | null
    tier_value: number
  }>>>((acc, ta) => {
    const golfer = ta.gp_golfers as unknown as {
      id: string
      name: string
      country: string | null
      headshot_url: string | null
      owgr_rank: number | null
    }
    if (!acc[ta.tier_value]) {
      acc[ta.tier_value] = []
    }
    acc[ta.tier_value].push({
      ...golfer,
      tier_value: ta.tier_value,
    })
    return acc
  }, {})

  // Check if we're past the lock time
  const now = new Date()
  const lockTime = gpPool.picks_lock_at ? new Date(gpPool.picks_lock_at) : null
  const isLocked = lockTime ? now >= lockTime : false

  // Common props for both views
  const commonProps = {
    poolName: pool.name,
    tournamentName: tournament.name,
    tournamentVenue: tournament.venue,
    lockTime: gpPool.picks_lock_at,
  }

  if (isLocked) {
    // After lock: Show leaderboard
    // Get all entries with their picks and golfer results
    const { data: entries } = await supabase
      .from('gp_entries')
      .select(`
        id,
        entry_name,
        participant_name,
        submitted_at,
        gp_entry_picks (
          id,
          golfer_id,
          gp_golfers!inner (
            id,
            name
          )
        )
      `)
      .eq('pool_id', gpPool.pool_id)
      .order('submitted_at', { ascending: true })

    // Get golfer results separately (they may not exist yet)
    const golferIds = (entries ?? []).flatMap(e =>
      (e.gp_entry_picks ?? []).map(p => (p.gp_golfers as { id: string }).id)
    )

    const { data: golferResults } = golferIds.length > 0
      ? await supabase
          .from('gp_golfer_results')
          .select('golfer_id, total_score, position, made_cut, round_1, round_2, round_3, round_4, thru')
          .eq('tournament_id', tournament.id)
          .in('golfer_id', golferIds)
      : { data: [] }

    const resultsMap = new Map(
      (golferResults ?? []).map(r => [r.golfer_id, r])
    )

    // Calculate scores for each entry
    const entriesWithScores = (entries ?? []).map((entry) => {
      let totalScore = 0
      const picks = (entry.gp_entry_picks ?? []).map((pick) => {
        const golfer = pick.gp_golfers as unknown as {
          id: string
          name: string
        }
        const result = resultsMap.get(golfer.id)
        const golferScore = result?.total_score ?? 0
        totalScore += golferScore

        return {
          golferId: golfer.id,
          golferName: golfer.name,
          score: golferScore,
          position: result?.position ?? '-',
          madeCut: result?.made_cut ?? true,
          thru: result?.thru ?? null,
        }
      })

      return {
        id: entry.id,
        entryName: entry.entry_name ?? 'Entry',
        participantName: entry.participant_name,
        totalScore,
        picks,
      }
    }).sort((a, b) => a.totalScore - b.totalScore) // Lower score is better

    return (
      <GolfPublicLeaderboard
        {...commonProps}
        entries={entriesWithScores}
        tournamentId={tournament.id}
      />
    )
  }

  // Before lock: Show entry form
  return (
    <GolfPublicEntryForm
      {...commonProps}
      gpPoolId={gpPool.id}
      poolId={gpPool.pool_id}
      minTierPoints={gpPool.min_tier_points ?? 21}
      golfersByTier={golfersByTier}
    />
  )
}
