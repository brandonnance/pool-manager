'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Calendar, Flag, RefreshCw, Play, RotateCcw, Search, Download } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { GpPublicEntriesCard } from '@/components/golf/gp-public-entries-card'
import { GpElitePromotionModal } from '@/components/golf/gp-elite-promotion-modal'
import { Badge } from '@/components/ui/badge'

interface SlashGolfTournament {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'upcoming' | 'in_progress' | 'completed'
  venue?: string
  courseName?: string
  city?: string
  state?: string
  par?: number
}

interface GpPool {
  id: string
  pool_id: string
  tournament_id: string | null
  min_tier_points: number | null
  picks_lock_at: string | null
  demo_mode: boolean | null
  public_slug: string | null
  public_entries_enabled: boolean | null
  scoring_source: string | null
  event_id: string | null
}

interface Tournament {
  id: string
  name: string
  start_date: string
  end_date: string
  venue: string | null
  course_name: string | null
  status: string | null
}

export default function GolfSetupPage() {
  const params = useParams()
  const router = useRouter()
  const poolId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [syncHadData, setSyncHadData] = useState(true) // Whether last sync found actual data
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncCooldownRemaining, setSyncCooldownRemaining] = useState(0)
  const [gpPool, setGpPool] = useState<GpPool | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [pool, setPool] = useState<{ name: string; status: string } | null>(null)
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tournament browser state
  const [searchYear, setSearchYear] = useState(new Date().getFullYear())
  const [searchQuery, setSearchQuery] = useState('')
  const [slashGolfTournaments, setSlashGolfTournaments] = useState<SlashGolfTournament[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)

  // Form state
  const [minTierPoints, setMinTierPoints] = useState(21)
  const [picksLockAt, setPicksLockAt] = useState('')
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => {
    loadData()
  }, [poolId])

  // Cooldown timer for sync button (5 minutes = 300 seconds)
  const SYNC_COOLDOWN_SECONDS = 300

  useEffect(() => {
    // Load last sync time from localStorage
    const stored = localStorage.getItem(`golf-sync-${poolId}`)
    if (stored) {
      const storedTime = new Date(stored)
      setLastSyncTime(storedTime)
      const elapsed = Math.floor((Date.now() - storedTime.getTime()) / 1000)
      const remaining = Math.max(0, SYNC_COOLDOWN_SECONDS - elapsed)
      setSyncCooldownRemaining(remaining)
    }
  }, [poolId])

  useEffect(() => {
    // Countdown timer for cooldown
    if (syncCooldownRemaining > 0) {
      const timer = setInterval(() => {
        setSyncCooldownRemaining(prev => Math.max(0, prev - 1))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [syncCooldownRemaining])

  // Check if we're in typical tournament play hours (7am - 9pm local time)
  function isTournamentHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    return hour >= 7 && hour <= 21
  }

  // Format cooldown remaining
  function formatCooldown(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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
      .select('name, status, org_id')
      .eq('id', poolId)
      .single()

    if (!poolData) {
      setError('Pool not found')
      setLoading(false)
      return
    }

    // Sync status on load (lazy update for time-based transitions)
    try {
      const syncResponse = await fetch('/api/golf/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      })
      const syncData = await syncResponse.json()
      // Use synced status if available, otherwise use fetched status
      setPool({ name: poolData.name, status: syncData.status || poolData.status })
    } catch {
      // Fall back to fetched status if sync fails
      setPool({ name: poolData.name, status: poolData.status })
    }

    // Check if commissioner
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

    const commissioner = poolMembership?.role === 'commissioner' || orgMembership?.role === 'admin'
    setIsCommissioner(commissioner)

    if (!commissioner) {
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

    if (!gpPoolData) {
      setError('Golf pool configuration not found')
      setLoading(false)
      return
    }

    setGpPool(gpPoolData)
    setMinTierPoints(gpPoolData.min_tier_points ?? 21)
    setDemoMode(gpPoolData.demo_mode ?? false)

    if (gpPoolData.picks_lock_at) {
      // Convert to local datetime-local format (not UTC)
      const date = new Date(gpPoolData.picks_lock_at)
      const localDatetime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      setPicksLockAt(localDatetime)
    }

    // Get tournament if linked
    if (gpPoolData.tournament_id) {
      const { data: tournamentData } = await supabase
        .from('gp_tournaments')
        .select('*')
        .eq('id', gpPoolData.tournament_id)
        .single()

      setTournament(tournamentData)
    }

    setLoading(false)
  }

  async function handleSave() {
    if (!gpPool) return

    setSaving(true)
    setError(null)

    const updates: Partial<GpPool> = {
      min_tier_points: minTierPoints,
      demo_mode: demoMode,
    }

    if (picksLockAt) {
      updates.picks_lock_at = new Date(picksLockAt).toISOString()
    } else {
      updates.picks_lock_at = null
    }

    const { error: updateError } = await supabase
      .from('gp_pools')
      .update(updates)
      .eq('id', gpPool.id)

    if (updateError) {
      setError('Failed to save settings')
    } else {
      // Reload data to refresh gpPool state (updates public entries card validation)
      await loadData()
    }

    setSaving(false)
  }

  async function handleSeedDemo() {
    setSeeding(true)
    setError(null)

    try {
      const response = await fetch('/api/golf/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed', poolId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed demo data')
      }

      // Reload data to show tournament
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed demo data')
    }

    setSeeding(false)
  }

  async function handleSimulateRound() {
    setSimulating(true)
    setError(null)

    try {
      const response = await fetch('/api/golf/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate-round', poolId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to simulate round')
      }

      // Reload data
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to simulate round')
    }

    setSimulating(false)
  }

  async function handleResetScores() {
    setResetting(true)
    setError(null)

    try {
      const response = await fetch('/api/golf/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', poolId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset scores')
      }

      // Reload data
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset scores')
    }

    setResetting(false)
  }

  async function handleSyncScores() {
    setSyncing(true)
    setError(null)
    setSyncResult(null)

    try {
      const response = await fetch('/api/golf/sync-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync scores')
      }

      // Save sync time and start cooldown
      const now = new Date()
      setLastSyncTime(now)
      setSyncCooldownRemaining(SYNC_COOLDOWN_SECONDS)
      localStorage.setItem(`golf-sync-${poolId}`, now.toISOString())

      // Track whether we actually got data
      const hadData = data.matchedGolfers > 0
      setSyncHadData(hadData)

      // Use message from API if provided (e.g., "No leaderboard data available yet")
      const resultMessage = data.message || `Synced ${data.matchedGolfers} golfer scores from live API`
      setSyncResult(resultMessage)
      // Reload data to show updated status
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync scores')
    }

    setSyncing(false)
  }

  async function fetchTournaments() {
    setLoadingTournaments(true)
    setError(null)

    try {
      const response = await fetch(`/api/golf/tournaments?year=${searchYear}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tournaments')
      }

      setSlashGolfTournaments(data.tournaments || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournaments')
    }

    setLoadingTournaments(false)
  }

  async function handleImportTournament(tournament: SlashGolfTournament) {
    setImporting(tournament.id)
    setError(null)
    setImportSuccess(null)

    try {
      const response = await fetch('/api/golf/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId,
          tournamentData: {
            tournId: tournament.id,
            name: tournament.name,
            startDate: tournament.startDate,
            endDate: tournament.endDate,
            venue: tournament.venue,
            courseName: tournament.courseName,
            par: tournament.par,
            status: tournament.status,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import tournament')
      }

      if (data.fieldError) {
        setImportSuccess(`Imported ${tournament.name}. ${data.fieldError}`)
      } else {
        setImportSuccess(`Imported ${data.totalPlayers} players from ${tournament.name}`)
      }
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import tournament')
    }

    setImporting(null)
  }

  // Filter tournaments by search query
  const filteredTournaments = slashGolfTournaments.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !gpPool) {
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
    <div className="space-y-6">
      {/* Header with Pool Status */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/pools/${poolId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to {pool?.name}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Tournament Setup</h1>
            {pool?.status && (
              <Badge
                variant={
                  pool.status === 'open' ? 'default' :
                  pool.status === 'locked' ? 'default' :
                  pool.status === 'completed' ? 'secondary' :
                  'outline'
                }
                className={
                  pool.status === 'open' ? 'bg-green-600' :
                  pool.status === 'locked' ? 'bg-blue-600' :
                  pool.status === 'draft' ? 'border-amber-500 text-amber-600' :
                  ''
                }
              >
                {pool.status === 'locked' ? 'In Progress' :
                 pool.status === 'completed' ? 'Completed' :
                 pool.status === 'open' ? 'Accepting Entries' :
                 pool.status === 'draft' ? 'Draft' :
                 pool.status}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Tournament Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Tournament
          </CardTitle>
          <CardDescription>
            {tournament ? 'Tournament linked' : demoMode ? 'Use demo mode to seed test data' : 'Import a tournament from PGA Tour data'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tournament ? (
            <div className="space-y-2">
              <div className="font-medium text-lg">{tournament.name}</div>
              {tournament.venue && (
                <div className="text-muted-foreground">{tournament.venue}</div>
              )}
              <div className="text-sm text-muted-foreground">
                {new Date(tournament.start_date).toLocaleDateString()} - {new Date(tournament.end_date).toLocaleDateString()}
              </div>
              <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium bg-muted">
                Status: {tournament.status}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              {demoMode
                ? 'Click "Seed Demo Data" below to create a test tournament with golfers.'
                : 'Search for a PGA Tour tournament below to import it with the full player field.'
              }
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tournament Browser - Show when no tournament and not in demo mode */}
      {!tournament && !demoMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Import PGA Tour Tournament
            </CardTitle>
            <CardDescription>
              Browse and import PGA Tour tournaments with their full player fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importSuccess && (
              <div className="bg-green-50 text-green-700 px-4 py-3 rounded-md text-sm">
                {importSuccess}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="searchYear" className="whitespace-nowrap">Year:</Label>
                <Input
                  id="searchYear"
                  type="number"
                  min={2020}
                  max={2030}
                  value={searchYear}
                  onChange={(e) => setSearchYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-24"
                />
              </div>
              <Button onClick={fetchTournaments} disabled={loadingTournaments}>
                {loadingTournaments && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="mr-2 h-4 w-4" />
                Load Tournaments
              </Button>
            </div>

            {slashGolfTournaments.length > 0 && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tournaments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {filteredTournaments.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No tournaments match your search
                    </div>
                  ) : (
                    filteredTournaments.map((t) => {
                      const startDate = new Date(t.startDate)
                      const endDate = new Date(t.endDate)
                      const isPast = endDate < new Date()
                      const isUpcoming = startDate > new Date()

                      return (
                        <div
                          key={t.id}
                          className={cn(
                            'p-3 flex items-center justify-between gap-4',
                            isPast && 'bg-muted/30'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{t.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                              {t.venue && ` • ${t.venue}`}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full',
                                t.status === 'completed' && 'bg-gray-100 text-gray-600',
                                t.status === 'in_progress' && 'bg-green-100 text-green-700',
                                t.status === 'upcoming' && 'bg-blue-100 text-blue-700'
                              )}>
                                {t.status === 'completed' ? 'Completed' :
                                 t.status === 'in_progress' ? 'In Progress' : 'Upcoming'}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleImportTournament(t)}
                            disabled={importing !== null}
                          >
                            {importing === t.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-1" />
                                Import
                              </>
                            )}
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Showing {filteredTournaments.length} of {slashGolfTournaments.length} tournaments
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live Scoring - Show when tournament exists and not in demo mode */}
      {tournament && !demoMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Live Scoring
            </CardTitle>
            <CardDescription>
              {gpPool?.scoring_source === 'global'
                ? 'Scores are automatically synced by the global events system'
                : 'Sync live scores from the PGA Tour leaderboard'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Global scoring auto-sync indicator */}
            {gpPool?.scoring_source === 'global' && gpPool?.event_id ? (
              <div className="bg-green-50 text-green-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-600 text-white text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Auto-Sync
                </div>
                <span>
                  This pool uses the global events system for automatic score updates. Manual sync is not needed.
                </span>
              </div>
            ) : (
              <>
                {syncResult && (
                  <div className={cn(
                    'px-4 py-3 rounded-md text-sm',
                    syncHadData
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                  )}>
                    {syncResult}
                  </div>
                )}

                {/* Status indicators */}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {/* Tournament hours indicator */}
                  <div className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                    isTournamentHours()
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  )}>
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      isTournamentHours() ? 'bg-green-500' : 'bg-amber-500'
                    )} />
                    {isTournamentHours() ? 'Tournament hours (7am-9pm)' : 'Outside tournament hours'}
                  </div>

                  {/* Last sync time */}
                  {lastSyncTime && (
                    <div className="text-muted-foreground">
                      Last synced: {lastSyncTime.toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleSyncScores}
                    disabled={syncing || syncCooldownRemaining > 0}
                  >
                    {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {syncCooldownRemaining > 0
                      ? `Wait ${formatCooldown(syncCooldownRemaining)}`
                      : 'Sync Live Scores'}
                  </Button>

                  {syncCooldownRemaining > 0 && (
                    <span className="text-sm text-muted-foreground">
                      Cooldown prevents excessive API calls
                    </span>
                  )}
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <strong>Tip:</strong> Sync every 5-10 minutes during active play.
                    Scores typically update after each group finishes a hole.
                  </p>
                  {!isTournamentHours() && (
                    <p className="text-amber-600">
                      Tournament play usually occurs between 7am-9pm. Syncing now may return stale data.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pool Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Pool Settings</CardTitle>
          <CardDescription>Configure tier points and picks lock time</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="minTierPoints">Minimum Tier Points</Label>
            <Input
              id="minTierPoints"
              type="number"
              min={0}
              max={42}
              value={minTierPoints}
              onChange={(e) => setMinTierPoints(parseInt(e.target.value) || 0)}
              className="max-w-[200px]"
            />
            <p className="text-sm text-muted-foreground">
              Participants must select 6 golfers with at least this many tier points.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="picksLockAt">Picks Lock Time</Label>
            <Input
              id="picksLockAt"
              type="datetime-local"
              value={picksLockAt}
              onChange={(e) => setPicksLockAt(e.target.value)}
              className="max-w-[300px]"
            />
            <p className="text-sm text-muted-foreground">
              Participants cannot change picks after this time.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="demoMode">Demo Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable to test with mock data. Bypasses pick lock time.
              </p>
            </div>
            <Switch
              id="demoMode"
              checked={demoMode}
              onCheckedChange={setDemoMode}
            />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Demo Controls */}
      {demoMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Demo Controls
            </CardTitle>
            <CardDescription>
              Seed test data and simulate tournament rounds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {!tournament && (
                <Button onClick={handleSeedDemo} disabled={seeding}>
                  {seeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Seed Demo Data
                </Button>
              )}

              {tournament && (
                <>
                  <Button onClick={handleSimulateRound} disabled={simulating}>
                    {simulating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Calendar className="mr-2 h-4 w-4" />
                    Simulate Next Round
                  </Button>

                  <Button variant="outline" onClick={handleResetScores} disabled={resetting}>
                    {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset Scores
                  </Button>
                </>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {!tournament 
                ? 'Seeding will create a Demo Masters tournament with 50 golfers and default tier assignments.'
                : 'Simulating will advance the tournament by one round. Reset will clear all scores.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Public Entry URL */}
      {tournament && gpPool && (
        <GpPublicEntriesCard
          gpPoolId={gpPool.id}
          poolId={poolId}
          tournamentId={gpPool.tournament_id}
          publicSlug={gpPool.public_slug}
          publicEntriesEnabled={gpPool.public_entries_enabled ?? false}
          picksLockAt={gpPool.picks_lock_at}
        />
      )}

      {/* Quick Links */}
      {tournament && gpPool && (
        <Card>
          <CardHeader>
            <CardTitle>Commissioner Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link href={`/pools/${poolId}/golf/tiers`}>
                <Button variant="outline">Edit Tier Assignments</Button>
              </Link>
              <GpElitePromotionModal
                gpPoolId={gpPool.id}
                tournamentId={gpPool.tournament_id}
              />
              <Link href={`/pools/${poolId}/golf/entries`}>
                <Button variant="outline">Manage Entries</Button>
              </Link>
              <Link href={`/pools/${poolId}/golf/scores`}>
                <Button variant="outline">Edit Scores</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
