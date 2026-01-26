/**
 * @fileoverview Public golf pool entry edit page
 * @route /pools/golf/[slug]/edit/[token]
 * @auth Public (validated via edit token)
 *
 * @description
 * Page for editing a golf pool entry via secure edit token.
 * Token is sent in confirmation email and expires at picks lock time.
 */
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { GolfPublicEditForm } from '@/components/golf/golf-public-edit-form'

interface PageProps {
  params: Promise<{ slug: string; token: string }>
}

function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function GolfPublicEditPage({ params }: PageProps) {
  const { slug, token } = await params
  const supabase = createAnonClient()

  // Look up pool by public_slug where public_entries_enabled = true
  const { data: gpPool } = await supabase
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

  if (!gpPool) {
    notFound()
  }

  // Check if we're past the lock time
  const now = new Date()
  const lockTime = gpPool.picks_lock_at ? new Date(gpPool.picks_lock_at) : null
  const isLocked = lockTime ? now >= lockTime : false

  // Find entry by edit token
  const { data: entry } = await supabase
    .from('gp_entries')
    .select(`
      id,
      entry_name,
      participant_name,
      participant_email,
      edit_token_expires_at,
      gp_entry_picks (
        id,
        golfer_id
      )
    `)
    .eq('pool_id', gpPool.pool_id)
    .eq('edit_token', token)
    .single()

  if (!entry) {
    notFound()
  }

  // Check if token is expired
  const tokenExpired = entry.edit_token_expires_at
    ? new Date(entry.edit_token_expires_at) < now
    : false

  // Get pool info
  const { data: pool } = await supabase
    .from('pools')
    .select('id, name')
    .eq('id', gpPool.pool_id)
    .single()

  if (!pool) {
    notFound()
  }

  // Get tournament info
  const { data: tournament } = gpPool.tournament_id
    ? await supabase
        .from('gp_tournaments')
        .select('id, name, start_date, end_date, venue, course_name')
        .eq('id', gpPool.tournament_id)
        .single()
    : { data: null }

  if (!tournament) {
    notFound()
  }

  // Get tier assignments with golfer info
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

  // Build the current picks as a set of golfer IDs
  const currentPicks = new Set(
    (entry.gp_entry_picks ?? []).map(p => p.golfer_id)
  )

  // Build golfer map for easy lookup
  const golferMap = new Map<string, {
    id: string
    name: string
    country: string | null
    headshot_url: string | null
    owgr_rank: number | null
    tier_value: number
  }>()
  for (const tier of Object.values(golfersByTier)) {
    for (const golfer of tier) {
      golferMap.set(golfer.id, golfer)
    }
  }

  return (
    <GolfPublicEditForm
      poolName={pool.name}
      tournamentName={tournament.name}
      tournamentVenue={tournament.venue}
      lockTime={gpPool.picks_lock_at}
      gpPoolId={gpPool.id}
      poolId={gpPool.pool_id}
      minTierPoints={gpPool.min_tier_points ?? 21}
      golfersByTier={golfersByTier}
      entryId={entry.id}
      entryName={entry.entry_name ?? ''}
      participantName={entry.participant_name ?? ''}
      participantEmail={entry.participant_email ?? ''}
      currentPicks={currentPicks}
      golferMap={golferMap}
      editToken={token}
      isLocked={isLocked || tokenExpired}
      lockReason={isLocked ? 'locked' : tokenExpired ? 'expired' : null}
      slug={slug}
    />
  )
}
