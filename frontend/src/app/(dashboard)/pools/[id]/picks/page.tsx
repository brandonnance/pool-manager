/**
 * @fileoverview Pool Picks Page (Bowl Buster)
 * @route /pools/[id]/picks
 * @auth Requires pool membership (approved) or commissioner
 * @layout Dashboard layout with header/nav
 *
 * @description
 * The main picks page for Bowl Buster pools. Displays CFP bracket picker
 * (if enabled) and bowl game picks form. Handles pick locking based on
 * game kickoff times.
 *
 * @features
 * - CFP bracket picker with visual bracket display
 * - Bowl game picks with team selection
 * - Automatic lock 5 minutes before kickoff
 * - Demo mode bypasses lock times
 * - Redirects to pool page if no entry exists
 * - Shows existing picks for editing
 *
 * @locking
 * - Bowl games: Lock 5 min before individual kickoff
 * - CFP bracket: Locks at cfp_lock_at timestamp
 * - Demo mode: Never locks
 *
 * @components
 * - CfpBracketPicker: Interactive CFP bracket for making picks
 * - BowlPicksForm: List of bowl games for picking winners
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BowlPicksForm } from '@/components/picks/bowl-picks-form'
import { CfpBracketPicker } from '@/components/picks/cfp-bracket-picker'

/** Page props with dynamic route parameters */
interface PageProps {
  params: Promise<{ id: string }>
}

/**
 * Pool picks page component (Server Component)
 *
 * @param props.params - Contains the pool id from the URL
 * @returns Picks page with CFP bracket and bowl games
 *
 * @data_fetching
 * - pools: Pool details
 * - bb_entries: User's entry (redirect if none)
 * - bb_pool_games: Games in this pool
 * - bb_bowl_picks: User's existing picks
 * - bb_cfp_pool_config: CFP settings and lock time
 * - bb_cfp_pool_byes/round1: CFP bracket structure
 * - bb_cfp_entry_picks: User's CFP picks
 */
export default async function PoolPicksPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get pool
  const { data: pool } = await supabase
    .from('pools')
    .select(`
      id,
      name,
      org_id,
      status,
      demo_mode,
      organizations (name)
    `)
    .eq('id', id)
    .single()

  if (!pool) {
    notFound()
  }

  // Check if commissioner or member
  const { data: orgMembership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', pool.org_id)
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const { data: poolMembership } = await supabase
    .from('pool_memberships')
    .select('status')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .single()

  const isSuperAdmin = profile?.is_super_admin ?? false
  const isCommissioner = orgMembership?.role === 'admin' || isSuperAdmin
  const isMember = poolMembership?.status === 'approved'

  if (!isMember && !isCommissioner) {
    notFound()
  }

  // Get user's entry
  const { data: entry } = await supabase
    .from('bb_entries')
    .select('id')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .single()

  // If no entry, redirect to pool page to create one
  if (!entry) {
    redirect(`/pools/${id}`)
  }

  // Get pool games with game details
  const { data: poolGames } = await supabase
    .from('bb_pool_games')
    .select(`
      id,
      kind,
      label,
      game_id,
      bb_games (
        id,
        game_name,
        kickoff_at,
        status,
        home_score,
        away_score,
        home_spread,
        home_team:bb_teams!bb_games_home_team_id_fkey (id, name, abbrev, logo_url, color),
        away_team:bb_teams!bb_games_away_team_id_fkey (id, name, abbrev, logo_url, color)
      )
    `)
    .eq('pool_id', id)
    .order('created_at', { ascending: true })

  // Get user's existing bowl picks
  const { data: existingPicks } = await supabase
    .from('bb_bowl_picks')
    .select('id, pool_game_id, picked_team_id')
    .eq('entry_id', entry.id)

  // Create a map of pool_game_id -> picked_team_id
  const picksMap: Record<string, string | null> = {}
  existingPicks?.forEach(pick => {
    picksMap[pick.pool_game_id] = pick.picked_team_id
  })

  // Get CFP config for this pool
  const { data: cfpConfig } = await supabase
    .from('bb_cfp_pool_config')
    .select('pool_id, template_id, cfp_lock_at')
    .eq('pool_id', id)
    .single()

  // Get CFP data if enabled
  let cfpByeTeams: Array<{
    seed: number
    team_id: string | null
    team: { id: string; name: string; abbrev: string | null; logo_url: string | null; color: string | null } | null
  }> = []
  let cfpRound1Matchups: Array<{
    slot_key: string
    team_a_id: string | null
    team_b_id: string | null
    team_a: { id: string; name: string; abbrev: string | null; logo_url: string | null; color: string | null } | null
    team_b: { id: string; name: string; abbrev: string | null; logo_url: string | null; color: string | null } | null
  }> = []
  let cfpExistingPicks: Array<{ slot_key: string; picked_team_id: string | null }> = []
  let cfpIsLocked = false

  if (cfpConfig) {
    // Get bye teams
    const { data: byeTeams } = await supabase
      .from('bb_cfp_pool_byes')
      .select(`
        seed,
        team_id,
        team:bb_teams (id, name, abbrev, logo_url, color)
      `)
      .eq('pool_id', id)
      .order('seed')

    cfpByeTeams = (byeTeams ?? []) as typeof cfpByeTeams

    // Get R1 matchups
    const { data: round1Matchups } = await supabase
      .from('bb_cfp_pool_round1')
      .select(`
        slot_key,
        team_a_id,
        team_b_id,
        team_a:bb_teams!bb_cfp_pool_round1_team_a_id_fkey (id, name, abbrev, logo_url, color),
        team_b:bb_teams!bb_cfp_pool_round1_team_b_id_fkey (id, name, abbrev, logo_url, color)
      `)
      .eq('pool_id', id)
      .order('slot_key')

    cfpRound1Matchups = (round1Matchups ?? []) as typeof cfpRound1Matchups

    // Get user's existing CFP picks
    const { data: cfpPicks } = await supabase
      .from('bb_cfp_entry_picks')
      .select('slot_key, picked_team_id')
      .eq('entry_id', entry.id)

    cfpExistingPicks = cfpPicks ?? []

    // Check if CFP is locked (unless demo_mode is enabled)
    cfpIsLocked = pool.demo_mode ? false : (cfpConfig.cfp_lock_at ? new Date() >= new Date(cfpConfig.cfp_lock_at) : false)
  }

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4">
        <ol className="flex items-center space-x-2 text-sm text-gray-500">
          <li>
            <Link href="/orgs" className="hover:text-gray-700">
              Organizations
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/orgs/${pool.org_id}`} className="hover:text-gray-700">
              {pool.organizations?.name}
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/pools/${id}`} className="hover:text-gray-700">
              {pool.name}
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 font-medium">Bowl Picks</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Picks</h1>
        <p className="text-gray-600 mt-1">
          Pick winners for bowl games and the CFP bracket. Games lock 5 minutes before kickoff.
        </p>
      </div>

      {/* CFP Bracket Picker */}
      {cfpConfig && cfpRound1Matchups.length > 0 && (
        <div className="mb-8">
          <CfpBracketPicker
            poolId={id}
            entryId={entry.id}
            byeTeams={cfpByeTeams}
            round1Matchups={cfpRound1Matchups}
            existingPicks={cfpExistingPicks}
            isLocked={cfpIsLocked}
          />
        </div>
      )}

      {/* Bowl Picks Form - filter out CFP games since they're handled by the bracket */}
      {(() => {
        const bowlGames = poolGames?.filter(pg => pg.kind === 'bowl') ?? []
        // Filter picksMap to only include picks for bowl games
        const bowlGameIds = new Set(bowlGames.map(pg => pg.id))
        const bowlPicksMap: Record<string, string | null> = {}
        Object.entries(picksMap).forEach(([poolGameId, teamId]) => {
          if (bowlGameIds.has(poolGameId)) {
            bowlPicksMap[poolGameId] = teamId
          }
        })
        return (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Bowl Games</h2>
            </div>
            {bowlGames.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No bowl games yet</h3>
                <p className="text-gray-600">The commissioner hasn&apos;t added any bowl games to this pool yet.</p>
              </div>
            ) : (
              <BowlPicksForm
                poolId={id}
                entryId={entry.id}
                poolGames={bowlGames}
                picksMap={bowlPicksMap}
                demoMode={pool.demo_mode}
              />
            )}
          </>
        )
      })()}

      {/* Back to Pool */}
      <div className="mt-6">
        <Link
          href={`/pools/${id}`}
          className="text-blue-600 hover:text-blue-700 text-sm"
        >
          &larr; Back to Pool
        </Link>
      </div>
    </div>
  )
}
