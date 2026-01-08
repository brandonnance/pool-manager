'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Loader2, Search, Check, X, Clock, AlertCircle, User, Globe, Trophy } from 'lucide-react'
import Link from 'next/link'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { getTierColor, getTierLabel, getTierPoints } from '@/lib/golf/types'
import { validateRoster, getTierPointsSummary } from '@/lib/golf/validation'
import { arePicksLocked, getTimeUntilLock } from '@/lib/golf/scoring'
import { cn } from '@/lib/utils'

interface Golfer {
  id: string
  name: string
  country: string | null
  tier: number
  owgrRank: number | null
  headshotUrl: string | null
  fieldStatus: 'active' | 'withdrawn' | 'cut' | 'dq' | null
}

// Reusable golfer info content for both HoverCard and Popover
function GolferInfoContent({ golfer }: { golfer: Golfer }) {
  return (
    <div className="flex gap-3">
      {/* Golfer photo or placeholder */}
      <div className="flex-shrink-0">
        {golfer.headshotUrl ? (
          <img
            src={golfer.headshotUrl}
            alt={golfer.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Golfer info */}
      <div className="flex-1 space-y-1">
        <h4 className="font-semibold">{golfer.name}</h4>

        {golfer.country && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            <span>{golfer.country}</span>
          </div>
        )}

        {golfer.owgrRank && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" />
            <span>OWGR #{golfer.owgrRank}</span>
          </div>
        )}

        {/* Tier badge */}
        <div className="pt-1">
          <span className={cn(
            'inline-block px-2 py-0.5 rounded text-xs text-white',
            getTierColor(golfer.tier)
          )}>
            {getTierLabel(golfer.tier)} ({getTierPoints(golfer.tier)} pts)
          </span>
        </div>

        {/* Field status if not active */}
        {golfer.fieldStatus && golfer.fieldStatus !== 'active' && (
          <div className={cn(
            'text-xs font-medium mt-1',
            golfer.fieldStatus === 'withdrawn' && 'text-yellow-600',
            golfer.fieldStatus === 'cut' && 'text-orange-600',
            golfer.fieldStatus === 'dq' && 'text-red-600'
          )}>
            {golfer.fieldStatus === 'withdrawn' && 'WITHDRAWN'}
            {golfer.fieldStatus === 'cut' && 'MISSED CUT'}
            {golfer.fieldStatus === 'dq' && 'DISQUALIFIED'}
          </div>
        )}
      </div>
    </div>
  )
}

interface Pick {
  golferId: string
  golferName: string
  tier: number
}

interface Entry {
  id: string
  entry_name: string | null
  entry_number: number | null
  submitted_at: string | null
}

export default function GolfPicksPage() {
  const params = useParams()
  const router = useRouter()
  const poolId = params.id as string
  const supabase = createClient()
  const loadingRef = useRef(false) // Prevent double execution in Strict Mode

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pool, setPool] = useState<{ name: string } | null>(null)
  const [tournament, setTournament] = useState<{ name: string } | null>(null)
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [picks, setPicks] = useState<Pick[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null)
  const [minTierPoints, setMinTierPoints] = useState(21)
  const [picksLockAt, setPicksLockAt] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (loadingRef.current) return // Prevent double execution
    loadingRef.current = true
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
    setUserId(user.id)

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

    // Check membership
    const { data: poolMembership } = await supabase
      .from('pool_memberships')
      .select('status')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .single()

    if (!poolMembership || poolMembership.status !== 'approved') {
      setError('You must be a member of this pool to make picks')
      setLoading(false)
      return
    }

    // Get golf pool config
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('id, tournament_id, min_tier_points, picks_lock_at, demo_mode')
      .eq('pool_id', poolId)
      .single()

    if (!gpPool || !gpPool.tournament_id) {
      setError('Golf pool not configured. Commissioner needs to set up the tournament.')
      setLoading(false)
      return
    }

    setMinTierPoints(gpPool.min_tier_points ?? 21)
    setPicksLockAt(gpPool.picks_lock_at)
    setDemoMode(gpPool.demo_mode ?? false)

    // Get tournament info
    const { data: tournamentData } = await supabase
      .from('gp_tournaments')
      .select('name')
      .eq('id', gpPool.tournament_id)
      .single()

    setTournament(tournamentData)

    // Get golfers with tier assignments and field status
    const { data: fieldData } = await supabase
      .from('gp_tournament_field')
      .select('golfer_id, status')
      .eq('tournament_id', gpPool.tournament_id)

    if (!fieldData || fieldData.length === 0) {
      setError('No golfers in tournament. Commissioner needs to seed data.')
      setLoading(false)
      return
    }

    // Create field status map
    const fieldStatusMap = new Map(fieldData.map(f => [f.golfer_id, f.status]))

    // Get tier assignments
    const { data: tierData } = await supabase
      .from('gp_tier_assignments')
      .select('golfer_id, tier_value')
      .eq('pool_id', gpPool.id)

    const tierMap = new Map(tierData?.map(t => [t.golfer_id, t.tier_value]) || [])

    // Get golfer details including OWGR rank and headshot
    const { data: golferData } = await supabase
      .from('gp_golfers')
      .select('id, name, country, owgr_rank, headshot_url')
      .in('id', fieldData.map(f => f.golfer_id))

    if (!golferData) {
      setError('Failed to load golfers')
      setLoading(false)
      return
    }

    // Combine golfer data with tier assignments and field status
    const golferList: Golfer[] = golferData.map(g => ({
      id: g.id,
      name: g.name,
      country: g.country,
      tier: tierMap.get(g.id) ?? 5,
      owgrRank: g.owgr_rank,
      headshotUrl: g.headshot_url,
      fieldStatus: fieldStatusMap.get(g.id) as Golfer['fieldStatus'] ?? null,
    }))

    // Sort by tier, then by name
    golferList.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier
      return a.name.localeCompare(b.name)
    })

    setGolfers(golferList)

    // Get user's entries
    const { data: entryData } = await supabase
      .from('gp_entries')
      .select('id, entry_name, entry_number, submitted_at')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .order('entry_number')

    if (!entryData || entryData.length === 0) {
      // Create first entry for user
      const { data: newEntry, error: createError } = await supabase
        .from('gp_entries')
        .insert({
          pool_id: poolId,
          user_id: user.id,
          entry_name: 'Entry 1',
          entry_number: 1,
        })
        .select()
        .single()

      if (createError) {
        setError('Failed to create entry')
        setLoading(false)
        return
      }

      setEntries([newEntry])
      setCurrentEntryId(newEntry.id)
    } else {
      setEntries(entryData)
      setCurrentEntryId(entryData[0].id)
      
      // Load picks for first entry
      await loadEntryPicks(entryData[0].id, golferList)
    }

    setLoading(false)
  }

  async function loadEntryPicks(entryId: string, golferList: Golfer[]) {
    const { data: pickData } = await supabase
      .from('gp_entry_picks')
      .select('golfer_id')
      .eq('entry_id', entryId)

    if (pickData) {
      const loadedPicks: Pick[] = pickData.map(p => {
        const golfer = golferList.find(g => g.id === p.golfer_id)
        return {
          golferId: p.golfer_id,
          golferName: golfer?.name ?? 'Unknown',
          tier: golfer?.tier ?? 5,
        }
      })
      setPicks(loadedPicks)
    } else {
      setPicks([])
    }
  }

  function toggleGolfer(golfer: Golfer) {
    const existingIndex = picks.findIndex(p => p.golferId === golfer.id)
    
    if (existingIndex >= 0) {
      // Remove pick
      setPicks(picks.filter(p => p.golferId !== golfer.id))
    } else if (picks.length < 6) {
      // Add pick
      setPicks([...picks, {
        golferId: golfer.id,
        golferName: golfer.name,
        tier: golfer.tier,
      }])
    }
  }

  async function handleSave() {
    if (!currentEntryId || !userId) return

    const validation = validateRoster(picks, minTierPoints)
    if (!validation.valid) {
      setError(validation.errors.join('. '))
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    // Delete existing picks
    await supabase
      .from('gp_entry_picks')
      .delete()
      .eq('entry_id', currentEntryId)

    // Insert new picks
    const pickInserts = picks.map(p => ({
      entry_id: currentEntryId,
      golfer_id: p.golferId,
    }))

    const { error: insertError } = await supabase
      .from('gp_entry_picks')
      .insert(pickInserts)

    if (insertError) {
      setError('Failed to save picks')
      setSaving(false)
      return
    }

    // Update entry submitted_at
    await supabase
      .from('gp_entries')
      .update({ submitted_at: new Date().toISOString() })
      .eq('id', currentEntryId)

    setSuccessMessage('Picks saved successfully!')
    setSaving(false)
  }

  // Filter golfers by search and group by tier
  const filteredGolfers = useMemo(() => {
    if (!searchQuery.trim()) return golfers
    const query = searchQuery.toLowerCase()
    return golfers.filter(g => 
      g.name.toLowerCase().includes(query) ||
      g.country?.toLowerCase().includes(query)
    )
  }, [golfers, searchQuery])

  const golfersByTier = useMemo(() => {
    const grouped = new Map<number, Golfer[]>()
    for (let i = 0; i <= 6; i++) grouped.set(i, [])
    
    filteredGolfers.forEach(g => {
      const tier = g.tier
      const list = grouped.get(tier) || []
      list.push(g)
      grouped.set(tier, list)
    })
    
    return grouped
  }, [filteredGolfers])

  const validation = useMemo(() => validateRoster(picks, minTierPoints), [picks, minTierPoints])
  const tierSummary = useMemo(() => getTierPointsSummary(picks, minTierPoints), [picks, minTierPoints])
  const lockInfo = useMemo(() => getTimeUntilLock(picksLockAt), [picksLockAt])
  const isLocked = arePicksLocked(picksLockAt, demoMode)

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
        <Link href={`/pools/${poolId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Pool
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
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div>
        <Link href={`/pools/${poolId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" />
          Back to {pool?.name}
        </Link>
        <h1 className="text-2xl font-bold">{tournament?.name ?? 'Golf'} Picks</h1>
        
        {/* Lock status */}
        <div className="flex items-center gap-2 mt-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {isLocked ? (
            <span className="text-destructive font-medium">Picks are locked</span>
          ) : lockInfo.timeString ? (
            <span className={cn(
              lockInfo.urgency === 'danger' && 'text-destructive',
              lockInfo.urgency === 'warning' && 'text-yellow-600'
            )}>
              Locks in {lockInfo.timeString}
            </span>
          ) : (
            <span className="text-muted-foreground">No lock time set</span>
          )}
          {demoMode && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Demo Mode</span>}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 text-green-800 px-4 py-3 rounded-md flex items-center gap-2">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      )}

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

      {/* Golfer Table by Tier */}
      <div className="border rounded-lg overflow-hidden">
        {Array.from({ length: 7 }, (_, tier) => {
          const tierGolfers = golfersByTier.get(tier) || []
          if (tierGolfers.length === 0) return null

          // Tier colors matching the screenshot style
          const tierBgColor = tier <= 1 ? 'bg-blue-900' : tier <= 3 ? 'bg-blue-800' : 'bg-amber-500'
          const tierTextColor = 'text-white'

          return (
            <div key={tier}>
              {/* Tier Header */}
              <div className={cn('px-4 py-2 font-bold text-center text-sm', tierBgColor, tierTextColor)}>
                TIER {tier === 0 ? '0 (Elite)' : tier}
              </div>

              {/* Golfers Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 border-b last:border-b-0">
                {tierGolfers.map((golfer) => {
                  const isSelected = picks.some(p => p.golferId === golfer.id)
                  const canSelect = !isLocked && (isSelected || picks.length < 6)

                  return (
                    <HoverCard key={golfer.id} openDelay={300} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <button
                          onClick={() => !isLocked && toggleGolfer(golfer)}
                          disabled={isLocked || (!isSelected && picks.length >= 6)}
                          className={cn(
                            'relative px-3 py-3 text-sm font-medium text-center border-r border-b last:border-r-0 transition-all',
                            'md:[&:nth-child(4n)]:border-r-0',
                            '[&:nth-child(2n)]:border-r-0 md:[&:nth-child(2n)]:border-r',
                            isSelected
                              ? 'bg-green-600 text-white'
                              : canSelect
                              ? 'bg-slate-100 hover:bg-slate-200'
                              : 'bg-slate-100 opacity-50 cursor-not-allowed'
                          )}
                        >
                          <span className="block truncate">
                            {golfer.name.split(' ').map((part, i, arr) =>
                              i === arr.length - 1 ? part.toUpperCase() : `${part.charAt(0)}. `
                            ).join('')}
                          </span>
                          {isSelected && (
                            <Check className="absolute top-1 right-1 h-4 w-4" />
                          )}
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent side="top" align="center" className="w-72">
                        <GolferInfoContent golfer={golfer} />
                        {/* Mobile-friendly tap hint */}
                        <p className="text-xs text-muted-foreground mt-2 md:hidden">
                          Tap name to {isSelected ? 'deselect' : 'select'}
                        </p>
                      </HoverCardContent>
                    </HoverCard>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky Roster Panel */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Selected Picks */}
            <div className="flex-1">
              <div className="text-sm font-medium mb-2">
                Your Roster ({picks.length}/6)
              </div>
              <div className="flex flex-wrap gap-2">
                {picks.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Select 6 golfers</span>
                ) : (
                  picks.map(pick => (
                    <div
                      key={pick.golferId}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-white',
                        getTierColor(pick.tier)
                      )}
                    >
                      {pick.golferName}
                      {!isLocked && (
                        <button
                          onClick={() => setPicks(picks.filter(p => p.golferId !== pick.golferId))}
                          className="ml-1 hover:bg-white/20 rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tier Points & Submit */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className={cn(
                  'text-lg font-bold',
                  tierSummary.status === 'below' && 'text-destructive',
                  tierSummary.status === 'at' && 'text-green-600',
                  tierSummary.status === 'above' && 'text-yellow-600'
                )}>
                  {tierSummary.current}/{tierSummary.minimum} pts
                </div>
                <div className="text-xs text-muted-foreground">
                  {tierSummary.message}
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || isLocked || !validation.valid}
                size="lg"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLocked ? 'Locked' : 'Save Picks'}
              </Button>
            </div>
          </div>

          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <div className="mt-2 text-sm text-destructive">
              {validation.errors.join(' • ')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
