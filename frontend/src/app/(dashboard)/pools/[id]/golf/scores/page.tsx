'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, RefreshCw, Search, Save, X, Check, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

interface GolferResult {
  id: string
  golfer_id: string
  golfer_name: string
  position: string | null
  round_1: number | null
  round_2: number | null
  round_3: number | null
  round_4: number | null
  total_score: number | null
  to_par: number | null
  thru: number | null
  made_cut: boolean | null
}

interface Tournament {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string | null
  par: number | null
}

interface GpPoolConfig {
  tournament_id: string
  scoring_source: string | null
  event_id: string | null
}

export default function GolfScoresPage() {
  const params = useParams()
  const router = useRouter()
  const poolId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ message: string; success: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pool, setPool] = useState<{ name: string } | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [golferResults, setGolferResults] = useState<GolferResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [gpPoolConfig, setGpPoolConfig] = useState<GpPoolConfig | null>(null)

  // Sync cooldown state
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncCooldownRemaining, setSyncCooldownRemaining] = useState(0)
  const SYNC_COOLDOWN_SECONDS = 300

  // Edit dialog state
  const [editingGolfer, setEditingGolfer] = useState<GolferResult | null>(null)
  const [editForm, setEditForm] = useState({
    round_1: '',
    round_2: '',
    round_3: '',
    round_4: '',
    position: '',
    made_cut: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [poolId])

  // Load cooldown from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`golf-sync-${poolId}`)
    if (stored) {
      const storedTime = new Date(stored)
      setLastSyncTime(storedTime)
      const elapsed = Math.floor((Date.now() - storedTime.getTime()) / 1000)
      const remaining = Math.max(0, SYNC_COOLDOWN_SECONDS - elapsed)
      setSyncCooldownRemaining(remaining)
    }
  }, [poolId])

  // Cooldown countdown
  useEffect(() => {
    if (syncCooldownRemaining > 0) {
      const timer = setInterval(() => {
        setSyncCooldownRemaining(prev => Math.max(0, prev - 1))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [syncCooldownRemaining])

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
      .select('name, org_id')
      .eq('id', poolId)
      .single()

    if (!poolData) {
      setError('Pool not found')
      setLoading(false)
      return
    }

    setPool({ name: poolData.name })

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

    // Get golf pool config including scoring_source
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('tournament_id, scoring_source, event_id')
      .eq('pool_id', poolId)
      .single()

    if (!gpPool?.tournament_id) {
      setError('No tournament linked to this pool')
      setLoading(false)
      return
    }

    setGpPoolConfig({
      tournament_id: gpPool.tournament_id,
      scoring_source: gpPool.scoring_source,
      event_id: gpPool.event_id,
    })

    // Get tournament
    const { data: tournamentData } = await supabase
      .from('gp_tournaments')
      .select('*')
      .eq('id', gpPool.tournament_id)
      .single()

    if (!tournamentData) {
      setError('Tournament not found')
      setLoading(false)
      return
    }

    setTournament(tournamentData)

    // Get all golfers in field with their results
    const { data: fieldData, error: fieldError } = await supabase
      .from('gp_tournament_field')
      .select(`
        golfer_id,
        gp_golfers!inner (
          id,
          name
        )
      `)
      .eq('tournament_id', tournamentData.id)

    if (fieldError) {
      setError('Failed to load golfers')
      setLoading(false)
      return
    }

    // Get results
    const { data: resultsData } = await supabase
      .from('gp_golfer_results')
      .select('*')
      .eq('tournament_id', tournamentData.id)

    // Build results map
    const resultsMap = new Map(
      (resultsData ?? []).map(r => [r.golfer_id, r])
    )

    // Combine field with results
    const combined: GolferResult[] = (fieldData ?? []).map(f => {
      const golfer = f.gp_golfers as unknown as { id: string; name: string }
      const result = resultsMap.get(golfer.id)

      return {
        id: result?.id ?? '',
        golfer_id: golfer.id,
        golfer_name: golfer.name,
        position: result?.position ?? null,
        round_1: result?.round_1 ?? null,
        round_2: result?.round_2 ?? null,
        round_3: result?.round_3 ?? null,
        round_4: result?.round_4 ?? null,
        total_score: result?.total_score ?? null,
        to_par: result?.to_par ?? null,
        thru: result?.thru ?? null,
        made_cut: result?.made_cut ?? null,
      }
    })

    // Sort by position (numeric), then by name
    combined.sort((a, b) => {
      // Parse position for sorting
      const posA = parsePosition(a.position)
      const posB = parsePosition(b.position)

      if (posA !== posB) return posA - posB
      return a.golfer_name.localeCompare(b.golfer_name)
    })

    setGolferResults(combined)
    setLoading(false)
  }

  function parsePosition(pos: string | null): number {
    if (!pos || pos === '-') return 9999
    // Handle T1, T2, etc.
    const num = parseInt(pos.replace('T', ''))
    return isNaN(num) ? 9999 : num
  }

  async function handleSync() {
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

      const hadData = data.matchedGolfers > 0
      setSyncResult({
        message: data.message || `Synced ${data.matchedGolfers} golfer scores`,
        success: hadData,
      })

      // Reload data
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync scores')
    }

    setSyncing(false)
  }

  function openEditDialog(golfer: GolferResult) {
    setEditingGolfer(golfer)
    setEditForm({
      round_1: golfer.round_1?.toString() ?? '',
      round_2: golfer.round_2?.toString() ?? '',
      round_3: golfer.round_3?.toString() ?? '',
      round_4: golfer.round_4?.toString() ?? '',
      position: golfer.position ?? '',
      made_cut: golfer.made_cut ?? true,
    })
  }

  async function handleSaveEdit() {
    if (!editingGolfer || !tournament) return

    setSaving(true)
    setError(null)

    const r1 = editForm.round_1 ? parseInt(editForm.round_1) : null
    const r2 = editForm.round_2 ? parseInt(editForm.round_2) : null
    const r3 = editForm.round_3 ? parseInt(editForm.round_3) : null
    const r4 = editForm.round_4 ? parseInt(editForm.round_4) : null

    // Calculate total score
    let totalScore = 0
    let roundsPlayed = 0
    if (r1 !== null) { totalScore += r1; roundsPlayed++ }
    if (r2 !== null) { totalScore += r2; roundsPlayed++ }
    if (r3 !== null) { totalScore += r3; roundsPlayed++ }
    if (r4 !== null) { totalScore += r4; roundsPlayed++ }

    // Add penalty for missed cut (80 per missed round)
    if (!editForm.made_cut && roundsPlayed === 2) {
      totalScore += 160 // 80 + 80 for R3 and R4
    }

    // Calculate to_par
    const par = tournament.par || 72
    const toPar = roundsPlayed > 0 ? totalScore - (par * roundsPlayed) : 0

    const upsertData = {
      tournament_id: tournament.id,
      golfer_id: editingGolfer.golfer_id,
      round_1: r1,
      round_2: r2,
      round_3: r3,
      round_4: r4,
      total_score: roundsPlayed > 0 ? totalScore : null,
      to_par: toPar,
      position: editForm.position || null,
      made_cut: editForm.made_cut,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('gp_golfer_results')
      .upsert(upsertData, {
        onConflict: 'tournament_id,golfer_id',
      })

    if (upsertError) {
      setError('Failed to save score')
      setSaving(false)
      return
    }

    setEditingGolfer(null)
    setSaving(false)
    await loadData()
  }

  // Check if using global scoring
  const useGlobalScoring = gpPoolConfig?.scoring_source === 'global' && gpPoolConfig?.event_id !== null

  // Filter golfers by search query
  const filteredGolfers = golferResults.filter(g =>
    g.golfer_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !tournament) {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/pools/${poolId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to {pool?.name}
          </Link>
          <h1 className="text-2xl font-bold">Score Management</h1>
          {tournament && (
            <p className="text-muted-foreground">{tournament.name}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Scoring Source Info */}
      {useGlobalScoring ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Auto-Sync Enabled
            </CardTitle>
            <CardDescription>
              Scores are automatically synced by the global events system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>
                This pool uses the global events system for automatic score updates.
                Manual sync is not needed.
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              You can still use manual editing below to override or correct individual scores if needed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sync Live Scores
            </CardTitle>
            <CardDescription>
              Pull latest scores from the PGA Tour leaderboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncResult && (
              <div className={cn(
                'px-4 py-3 rounded-md text-sm flex items-center gap-2',
                syncResult.success
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700'
              )}>
                {syncResult.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {syncResult.message}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleSync}
                disabled={syncing || syncCooldownRemaining > 0}
              >
                {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="mr-2 h-4 w-4" />
                {syncCooldownRemaining > 0
                  ? `Wait ${formatCooldown(syncCooldownRemaining)}`
                  : 'Sync Scores'}
              </Button>

              {lastSyncTime && (
                <span className="text-sm text-muted-foreground">
                  Last synced: {lastSyncTime.toLocaleTimeString()}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Syncing pulls scores from the Slash Golf API. Use manual editing below to override or correct individual scores.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manual Score Entry */}
      <Card>
        <CardHeader>
          <CardTitle>Golfer Scores</CardTitle>
          <CardDescription>
            Click on a golfer to manually edit their scores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search golfers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Golfers Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Pos</th>
                    <th className="text-left px-3 py-2 font-medium">Golfer</th>
                    <th className="text-center px-3 py-2 font-medium">R1</th>
                    <th className="text-center px-3 py-2 font-medium">R2</th>
                    <th className="text-center px-3 py-2 font-medium">R3</th>
                    <th className="text-center px-3 py-2 font-medium">R4</th>
                    <th className="text-center px-3 py-2 font-medium">Total</th>
                    <th className="text-center px-3 py-2 font-medium">To Par</th>
                    <th className="text-center px-3 py-2 font-medium">Cut</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredGolfers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                        {searchQuery ? 'No golfers match your search' : 'No golfers in field'}
                      </td>
                    </tr>
                  ) : (
                    filteredGolfers.map((golfer) => (
                      <tr
                        key={golfer.golfer_id}
                        className={cn(
                          'hover:bg-muted/30 cursor-pointer',
                          golfer.made_cut === false && 'bg-red-50/50'
                        )}
                        onClick={() => openEditDialog(golfer)}
                      >
                        <td className="px-3 py-2 font-medium">
                          {golfer.position || '-'}
                        </td>
                        <td className="px-3 py-2">
                          {golfer.golfer_name}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {golfer.round_1 ?? '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {golfer.round_2 ?? '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {golfer.round_3 ?? '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {golfer.round_4 ?? '-'}
                        </td>
                        <td className="px-3 py-2 text-center font-medium">
                          {golfer.total_score ?? '-'}
                        </td>
                        <td className={cn(
                          'px-3 py-2 text-center font-medium',
                          (golfer.to_par ?? 0) < 0 && 'text-red-600',
                          (golfer.to_par ?? 0) > 0 && 'text-blue-600'
                        )}>
                          {golfer.to_par !== null
                            ? (golfer.to_par > 0 ? `+${golfer.to_par}` : golfer.to_par === 0 ? 'E' : golfer.to_par)
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {golfer.made_cut === false ? (
                            <span className="text-red-600 text-xs font-medium">MC</span>
                          ) : golfer.made_cut === true ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditDialog(golfer)
                            }}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Showing {filteredGolfers.length} of {golferResults.length} golfers
          </p>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingGolfer} onOpenChange={(open) => !open && setEditingGolfer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Score: {editingGolfer?.golfer_name}</DialogTitle>
            <DialogDescription>
              Manually override this golfer's scores. Leave rounds blank if not played.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="round_1">Round 1</Label>
                <Input
                  id="round_1"
                  type="number"
                  min={50}
                  max={100}
                  value={editForm.round_1}
                  onChange={(e) => setEditForm({ ...editForm, round_1: e.target.value })}
                  placeholder="-"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="round_2">Round 2</Label>
                <Input
                  id="round_2"
                  type="number"
                  min={50}
                  max={100}
                  value={editForm.round_2}
                  onChange={(e) => setEditForm({ ...editForm, round_2: e.target.value })}
                  placeholder="-"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="round_3">Round 3</Label>
                <Input
                  id="round_3"
                  type="number"
                  min={50}
                  max={100}
                  value={editForm.round_3}
                  onChange={(e) => setEditForm({ ...editForm, round_3: e.target.value })}
                  placeholder="-"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="round_4">Round 4</Label>
                <Input
                  id="round_4"
                  type="number"
                  min={50}
                  max={100}
                  value={editForm.round_4}
                  onChange={(e) => setEditForm({ ...editForm, round_4: e.target.value })}
                  placeholder="-"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={editForm.position}
                onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                placeholder="e.g., 1, T2, T15"
                className="max-w-[120px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="made_cut"
                checked={editForm.made_cut}
                onCheckedChange={(checked) => setEditForm({ ...editForm, made_cut: !!checked })}
              />
              <Label htmlFor="made_cut" className="cursor-pointer">Made the cut</Label>
            </div>

            {!editForm.made_cut && (
              <p className="text-sm text-amber-600">
                Missed cut penalty: 80 strokes will be added for each of R3 and R4.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGolfer(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
