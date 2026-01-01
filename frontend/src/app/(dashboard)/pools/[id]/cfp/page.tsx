import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EnableCfpButton } from '@/components/cfp/enable-cfp-button'
import { CfpBracketSetup } from '@/components/cfp/cfp-bracket-setup'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PoolCfpPage({ params }: PageProps) {
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
      organizations (name)
    `)
    .eq('id', id)
    .single()

  if (!pool) {
    notFound()
  }

  // Check if commissioner
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

  const isSuperAdmin = profile?.is_super_admin ?? false
  const isCommissioner = orgMembership?.role === 'admin' || isSuperAdmin

  if (!isCommissioner) {
    notFound()
  }

  // Get CFP config for this pool
  const { data: cfpConfig } = await supabase
    .from('bb_cfp_pool_config')
    .select(`
      pool_id,
      template_id,
      cfp_lock_at,
      bb_cfp_templates (
        id,
        name,
        description
      )
    `)
    .eq('pool_id', id)
    .single()

  // Get CFP template (for enable button)
  const { data: templates } = await supabase
    .from('bb_cfp_templates')
    .select('id, name, description')

  // Get Round 1 matchups if CFP is enabled
  const { data: round1Matchups } = cfpConfig ? await supabase
    .from('bb_cfp_pool_round1')
    .select(`
      id,
      slot_key,
      team_a_id,
      team_b_id,
      game_id,
      team_a:bb_teams!bb_cfp_pool_round1_team_a_id_fkey (id, name, abbrev, logo_url),
      team_b:bb_teams!bb_cfp_pool_round1_team_b_id_fkey (id, name, abbrev, logo_url),
      game:bb_games!bb_cfp_pool_round1_game_id_fkey (id, game_name, kickoff_at, home_spread, status)
    `)
    .eq('pool_id', id)
    .order('slot_key') : { data: null }

  // Get bye teams (seeds 1-4) if CFP is enabled
  const { data: byeTeams } = cfpConfig ? await supabase
    .from('bb_cfp_pool_byes')
    .select(`
      id,
      seed,
      team_id,
      team:bb_teams (id, name, abbrev, logo_url, color)
    `)
    .eq('pool_id', id)
    .order('seed') : { data: null }

  // Get all teams for team selection
  const { data: teams } = await supabase
    .from('bb_teams')
    .select('id, name, abbrev, logo_url, color')
    .order('name')

  // Get template slots for reference
  const { data: templateSlots } = cfpConfig ? await supabase
    .from('bb_cfp_template_slots')
    .select('*')
    .eq('template_id', cfpConfig.template_id)
    .order('display_order') : { data: null }

  // Get slot games for later rounds (QF, SF, F)
  const { data: slotGames } = cfpConfig ? await supabase
    .from('bb_cfp_pool_slot_games')
    .select(`
      id,
      slot_key,
      game_id,
      game:bb_games (id, game_name, kickoff_at, status)
    `)
    .eq('pool_id', id) : { data: null }

  const cfpEnabled = !!cfpConfig

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
          <li className="text-gray-900 font-medium">CFP Bracket</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CFP Bracket Setup</h1>
          <p className="text-gray-600 mt-1">
            {cfpEnabled
              ? 'Configure the College Football Playoff bracket for this pool.'
              : 'Enable the CFP bracket to allow participants to make playoff picks.'}
          </p>
        </div>
        {cfpEnabled && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            CFP Enabled
          </span>
        )}
      </div>

      {/* Main Content */}
      {!cfpEnabled ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Enable CFP Bracket</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              The College Football Playoff bracket allows participants to pick winners through each round
              of the 12-team playoff, from the First Round through the National Championship.
            </p>
            <EnableCfpButton
              poolId={id}
              templates={templates ?? []}
            />
          </div>
        </div>
      ) : (
        <CfpBracketSetup
          poolId={id}
          cfpConfig={cfpConfig}
          round1Matchups={round1Matchups ?? []}
          byeTeams={byeTeams ?? []}
          slotGames={slotGames ?? []}
          templateSlots={templateSlots ?? []}
          teams={teams ?? []}
        />
      )}

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
