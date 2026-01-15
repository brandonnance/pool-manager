'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, Search, Save, Users, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { getTierColor, getTierLabel, TIER_INFO } from '@/lib/golf/types'
import { cn } from '@/lib/utils'

interface Golfer {
  id: string
  name: string
  country: string | null
  owgr_rank: number | null
}

interface TierAssignment {
  golfer_id: string
  tier_value: number
}

export default function TierEditorPage() {
  const params = useParams()
  const router = useRouter()
  const poolId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoAssigning, setAutoAssigning] = useState(false)
  const [pool, setPool] = useState<{ name: string } | null>(null)
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [tierAssignments, setTierAssignments] = useState<Map<string, number>>(new Map())
  const [originalAssignments, setOriginalAssignments] = useState<Map<string, number>>(new Map())
  const [gpPoolId, setGpPoolId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadData()
  }, [poolId])

  async function loadData() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Get pool info
    const { data: poolData } = await supabase
      .from('pools')
      .select('name, org_id')
      .eq('id', poolId)
      .single()

    if (!poolData) {
      setError('Pool not found')
      setLoading(false)
      return
    }

    setPool({ name: poolData.name })

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
      .eq('org_id', poolData.org_id)
      .eq('user_id', user.id)
      .single()

    const isCommissioner = poolMembership?.role === 'commissioner' || orgMembership?.role === 'admin'
    if (!isCommissioner) {
      setError('You must be a commissioner to access this page')
      setLoading(false)
      return
    }

    // Get golf pool config
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('id, tournament_id')
      .eq('pool_id', poolId)
      .single()

    if (!gpPool) {
      setError('Golf pool not found')
      setLoading(false)
      return
    }

    setGpPoolId(gpPool.id)

    if (!gpPool.tournament_id) {
      setError('No tournament linked. Set up the tournament first.')
      setLoading(false)
      return
    }

    // Get golfers in the tournament field
    const { data: fieldData } = await supabase
      .from('gp_tournament_field')
      .select(`
        golfer_id,
        gp_golfers!inner(id, name, country, owgr_rank)
      `)
      .eq('tournament_id', gpPool.tournament_id)

    if (!fieldData || fieldData.length === 0) {
      setError('No golfers in tournament field')
      setLoading(false)
      return
    }

    const golferList = fieldData.map(f => ({
      id: f.gp_golfers.id,
      name: f.gp_golfers.name,
      country: f.gp_golfers.country,
      owgr_rank: f.gp_golfers.owgr_rank,
    }))

    // Sort by OWGR rank, then by name
    golferList.sort((a, b) => {
      if (a.owgr_rank && b.owgr_rank) return a.owgr_rank - b.owgr_rank
      if (a.owgr_rank) return -1
      if (b.owgr_rank) return 1
      return a.name.localeCompare(b.name)
    })

    setGolfers(golferList)

    // Get existing tier assignments
    const { data: tiers } = await supabase
      .from('gp_tier_assignments')
      .select('golfer_id, tier_value')
      .eq('pool_id', gpPool.id)

    const assignmentMap = new Map<string, number>()
    tiers?.forEach(t => assignmentMap.set(t.golfer_id, t.tier_value))
    setTierAssignments(assignmentMap)
    setOriginalAssignments(new Map(assignmentMap))

    setLoading(false)
  }

  function updateTier(golferId: string, tier: number) {
    const newAssignments = new Map(tierAssignments)
    newAssignments.set(golferId, tier)
    setTierAssignments(newAssignments)

    // Check for changes
    const changed = Array.from(newAssignments.entries()).some(([id, value]) => {
      return originalAssignments.get(id) !== value
    })
    setHasChanges(changed)
  }

  async function handleSave() {
    if (!gpPoolId) return

    setSaving(true)
    setError(null)

    // Prepare upsert data
    const upsertData = Array.from(tierAssignments.entries()).map(([golferId, tierValue]) => ({
      pool_id: gpPoolId,
      golfer_id: golferId,
      tier_value: tierValue,
    }))

    const { error: upsertError } = await supabase
      .from('gp_tier_assignments')
      .upsert(upsertData, {
        onConflict: 'pool_id,golfer_id',
      })

    if (upsertError) {
      setError('Failed to save tier assignments')
    } else {
      setOriginalAssignments(new Map(tierAssignments))
      setHasChanges(false)
    }

    setSaving(false)
  }

  async function handleAutoAssign() {
    setAutoAssigning(true)
    setError(null)

    try {
      const response = await fetch('/api/golf/auto-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to auto-assign tiers')
      } else {
        // Reload data to get updated assignments and OWGR ranks
        await loadData()
      }
    } catch (err) {
      setError('Failed to auto-assign tiers')
    }

    setAutoAssigning(false)
  }

  // Filter golfers by search query
  const filteredGolfers = useMemo(() => {
    if (!searchQuery.trim()) return golfers
    const query = searchQuery.toLowerCase()
    return golfers.filter(g => 
      g.name.toLowerCase().includes(query) ||
      g.country?.toLowerCase().includes(query)
    )
  }, [golfers, searchQuery])

  // Group golfers by tier for stats
  const tierStats = useMemo(() => {
    const stats = new Map<number, number>()
    for (let i = 1; i <= 6; i++) stats.set(i, 0)

    tierAssignments.forEach((tier) => {
      stats.set(tier, (stats.get(tier) || 0) + 1)
    })

    // Count unassigned
    const assignedCount = tierAssignments.size
    const unassignedCount = golfers.length - assignedCount

    return { stats, unassignedCount }
  }, [tierAssignments, golfers])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && golfers.length === 0) {
    return (
      <div className="space-y-4">
        <Link href={`/pools/${poolId}/golf/setup`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Setup
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/pools/${poolId}/golf/setup`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Setup
          </Link>
          <h1 className="text-2xl font-bold">Tier Assignments</h1>
          <p className="text-muted-foreground">Assign golfers to tiers 1-6 (lower tier = better player = fewer points)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoAssign} disabled={autoAssigning || saving}>
            {autoAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Wand2 className="mr-2 h-4 w-4" />
            Auto-Assign (OWGR)
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Tier Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tier Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 6 }, (_, i) => i + 1).map((tier) => (
              <div
                key={tier}
                className={cn(
                  'px-3 py-2 rounded-md text-white text-sm font-medium',
                  getTierColor(tier)
                )}
              >
                {getTierLabel(tier)}: {tierStats.stats.get(tier) || 0}
              </div>
            ))}
            {tierStats.unassignedCount > 0 && (
              <div className="px-3 py-2 rounded-md bg-muted text-muted-foreground text-sm font-medium">
                Unassigned: {tierStats.unassignedCount}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search golfers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Golfer List */}
      <Card>
        <CardHeader>
          <CardTitle>Golfers ({filteredGolfers.length})</CardTitle>
          <CardDescription>
            Click a tier button to assign the golfer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredGolfers.map((golfer) => {
              const currentTier = tierAssignments.get(golfer.id)
              
              return (
                <div
                  key={golfer.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 text-center text-sm text-muted-foreground">
                      {golfer.owgr_rank ? `#${golfer.owgr_rank}` : '-'}
                    </div>
                    <div>
                      <div className="font-medium">{golfer.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {golfer.country}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: 6 }, (_, i) => i + 1).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => updateTier(golfer.id, tier)}
                        className={cn(
                          'w-8 h-8 rounded text-xs font-medium transition-colors',
                          currentTier === tier
                            ? cn(getTierColor(tier), 'text-white')
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        )}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Floating save button for mobile */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 md:hidden">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  )
}
