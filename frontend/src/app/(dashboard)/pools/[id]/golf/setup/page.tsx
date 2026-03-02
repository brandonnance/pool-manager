'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { WizardProgress } from '@/components/ui/wizard'
import { GolfSetupProvider, type GpPool, type Tournament, type Pool, type TierStatus } from '@/components/golf/setup/golf-setup-context'
import { TournamentStep } from '@/components/golf/setup/tournament-step'
import { TiersStep } from '@/components/golf/setup/tiers-step'
import { SettingsStep } from '@/components/golf/setup/settings-step'
import { GoLiveStep } from '@/components/golf/setup/go-live-step'

const STEPS = [
  { label: 'Tournament' },
  { label: 'Tiers' },
  { label: 'Settings' },
  { label: 'Go Live' },
]

export default function GolfSetupPage() {
  const params = useParams()
  const router = useRouter()
  const poolId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gpPool, setGpPool] = useState<GpPool | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [pool, setPool] = useState<Pool | null>(null)
  const [hasEntries, setHasEntries] = useState(false)
  const [tierStatus, setTierStatus] = useState<TierStatus>({ fieldCount: 0, tieredCount: 0 })
  const [step, setStep] = useState(0)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: poolData } = await supabase
      .from('pools')
      .select('name, status, org_id')
      .eq('id', poolId)
      .single()

    if (!poolData) { setError('Pool not found'); setLoading(false); return }

    // Sync status on load
    try {
      const syncResponse = await fetch('/api/golf/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      })
      const syncData = await syncResponse.json()
      setPool({ name: poolData.name, status: syncData.status || poolData.status })
    } catch {
      setPool({ name: poolData.name, status: poolData.status })
    }

    // Check commissioner
    const { data: poolMembership } = await supabase
      .from('pool_memberships')
      .select('role')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .single()

    const { data: orgMembership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', poolData.org_id)
      .eq('user_id', user.id)
      .single()

    if (poolMembership?.role !== 'commissioner' && orgMembership?.role !== 'admin') {
      setError('You must be a commissioner to access this page')
      setLoading(false)
      return
    }

    // Get golf pool config
    const { data: gpPoolData } = await supabase
      .from('gp_pools')
      .select('*')
      .eq('pool_id', poolId)
      .single()

    if (!gpPoolData) { setError('Golf pool configuration not found'); setLoading(false); return }
    setGpPool(gpPoolData)

    // Get tournament
    let tournamentData: Tournament | null = null
    if (gpPoolData.tournament_id) {
      const { data } = await supabase
        .from('gp_tournaments')
        .select('*')
        .eq('id', gpPoolData.tournament_id)
        .single()
      tournamentData = data
    }
    setTournament(tournamentData)

    // Check entries
    const { count: entryCount } = await supabase
      .from('gp_entries')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', poolId)
    setHasEntries((entryCount ?? 0) > 0)

    // Check tier status
    let fieldCount = 0
    let tieredCount = 0
    if (gpPoolData.tournament_id) {
      const { count: fc } = await supabase
        .from('gp_tournament_field')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', gpPoolData.tournament_id)
      fieldCount = fc ?? 0

      const { count: tc } = await supabase
        .from('gp_tier_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', gpPoolData.id)
      tieredCount = tc ?? 0
    }
    setTierStatus({ fieldCount, tieredCount })

    // Auto-step: determine which step to show
    if (!tournamentData) {
      setStep(0)
    } else if (fieldCount > 0 && tieredCount < fieldCount) {
      setStep(1)
    } else if (!gpPoolData.picks_lock_at) {
      setStep(2)
    } else {
      setStep(3)
    }

    setLoading(false)
  }, [poolId, router])

  useEffect(() => { loadData() }, [loadData])

  // Compute completed steps
  const completedSteps: number[] = []
  if (tournament) completedSteps.push(0)
  if (tierStatus.fieldCount > 0 && tierStatus.tieredCount >= tierStatus.fieldCount) completedSteps.push(1)
  if (gpPool?.picks_lock_at) completedSteps.push(2)
  if (completedSteps.length === 3) completedSteps.push(3)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !gpPool || !pool) {
    return (
      <div className="space-y-4">
        <Link href={`/pools/${poolId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Pool
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error || 'Something went wrong'}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <GolfSetupProvider value={{ poolId, gpPool, tournament, pool, hasEntries, tierStatus, reload: loadData }}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Link href={`/pools/${poolId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to {pool.name}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Tournament Setup</h1>
            <Badge
              variant={pool.status === 'completed' ? 'secondary' : pool.status === 'draft' ? 'outline' : 'default'}
              className={
                pool.status === 'open' ? 'bg-green-600' :
                pool.status === 'locked' ? 'bg-blue-600' :
                pool.status === 'draft' ? 'border-amber-500 text-amber-600' : ''
              }
            >
              {pool.status === 'locked' ? 'In Progress' :
               pool.status === 'completed' ? 'Completed' :
               pool.status === 'open' ? 'Accepting Entries' :
               pool.status === 'draft' ? 'Draft' : pool.status}
            </Badge>
          </div>
        </div>

        {/* Wizard Progress */}
        <WizardProgress
          steps={STEPS}
          currentStep={step}
          completedSteps={completedSteps}
          onStepClick={setStep}
        />

        {/* Step Content */}
        {step === 0 && <TournamentStep />}
        {step === 1 && <TiersStep />}
        {step === 2 && <SettingsStep />}
        {step === 3 && <GoLiveStep />}
      </div>
    </GolfSetupProvider>
  )
}
