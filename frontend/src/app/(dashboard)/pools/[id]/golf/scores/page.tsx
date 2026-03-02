'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/ui/data-table'
import { ArrowLeft, Loader2, RefreshCw, Save, Check, AlertCircle, UserX } from 'lucide-react'
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
  status: string | null // 'withdrawn' | null
}

interface Tournament {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string | null
  par: number | null
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
  const [isCommissioner, setIsCommissioner] = useState(false)

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

  // Withdrawal dialog state
  const [withdrawingGolfer, setWithdrawingGolfer] = useState<GolferResult | null>(null)
  const [withdrawalProcessing, setWithdrawalProcessing] = useState(false)
  const [withdrawalResult, setWithdrawalResult] = useState<{
    success: boolean
    message: string
    replacements?: { entryName: string; participantName: string | null; replacement: string; tier: number }[]
  } | null>(null)

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

    // Get golf pool config
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('tournament_id')
      .eq('pool_id', poolId)
      .single()

    if (!gpPool?.tournament_id) {
      setError('No tournament linked to this pool')
      setLoading(false)
      return
    }

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
        status,
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
        status: f.status ?? null,
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
    let toPar = 0
    if (roundsPlayed > 0) {
      if (!editForm.made_cut && roundsPlayed === 2) {
        // For missed cut: to_par based on all 4 rounds (including 80s for R3/R4)
        toPar = totalScore - (par * 4)
      } else {
        // Normal calculation based on rounds played
        toPar = totalScore - (par * roundsPlayed)
      }
    }

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

  async function handleWithdrawal() {
    if (!withdrawingGolfer) return

    setWithdrawalProcessing(true)
    setWithdrawalResult(null)

    try {
      const response = await fetch('/api/golf/process-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId,
          golferId: withdrawingGolfer.golfer_id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setWithdrawalResult({
          success: false,
          message: data.error || 'Failed to process withdrawal',
        })
      } else {
        setWithdrawalResult({
          success: true,
          message: data.message,
          replacements: data.replacements,
        })
        // Reload data after successful withdrawal
        await loadData()
      }
    } catch (err) {
      setWithdrawalResult({
        success: false,
        message: 'Failed to process withdrawal',
      })
    }

    setWithdrawalProcessing(false)
  }

  // Column definitions for the golfer scores table
  const columns = useMemo<ColumnDef<GolferResult>[]>(() => [
    {
      accessorKey: 'position',
      header: 'Pos',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.status === 'withdrawn' ? 'WD' : (row.original.position || '-')}
        </span>
      ),
    },
    {
      accessorKey: 'golfer_name',
      header: 'Golfer',
      cell: ({ row }) => (
        <span className={cn(row.original.status === 'withdrawn' && 'line-through')}>
          {row.original.golfer_name}
        </span>
      ),
    },
    {
      accessorKey: 'round_1',
      header: 'R1',
      enableSorting: false,
      cell: ({ row }) => <span className="text-center block">{row.original.round_1 ?? '-'}</span>,
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'round_2',
      header: 'R2',
      enableSorting: false,
      cell: ({ row }) => <span className="text-center block">{row.original.round_2 ?? '-'}</span>,
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'round_3',
      header: 'R3',
      enableSorting: false,
      cell: ({ row }) => <span className="text-center block">{row.original.round_3 ?? '-'}</span>,
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'round_4',
      header: 'R4',
      enableSorting: false,
      cell: ({ row }) => <span className="text-center block">{row.original.round_4 ?? '-'}</span>,
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'total_score',
      header: 'Total',
      cell: ({ row }) => (
        <span className="text-center block font-medium">{row.original.total_score ?? '-'}</span>
      ),
      meta: { className: 'text-center' },
    },
    {
      accessorKey: 'to_par',
      header: 'To Par',
      cell: ({ row }) => {
        const toPar = row.original.to_par
        return (
          <span className={cn(
            'text-center block font-medium',
            (toPar ?? 0) < 0 && 'text-red-600',
            (toPar ?? 0) > 0 && 'text-blue-600'
          )}>
            {toPar !== null
              ? (toPar > 0 ? `+${toPar}` : toPar === 0 ? 'E' : toPar)
              : '-'}
          </span>
        )
      },
      meta: { className: 'text-center' },
    },
    {
      id: 'cut',
      header: 'Cut',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-center block">
          {row.original.made_cut === false ? (
            <span className="text-red-600 text-xs font-medium">MC</span>
          ) : row.original.made_cut === true ? (
            <Check className="h-4 w-4 text-green-600 mx-auto" />
          ) : (
            '-'
          )}
        </span>
      ),
      meta: { className: 'text-center' },
    },
    {
      id: 'wd',
      header: 'WD',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-center block">
          {row.original.status === 'withdrawn' ? (
            <span className="text-amber-600 text-xs font-medium">WD</span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-amber-600"
              onClick={(e) => {
                e.stopPropagation()
                setWithdrawingGolfer(row.original)
                setWithdrawalResult(null)
              }}
            >
              <UserX className="h-3 w-3" />
            </Button>
          )}
        </span>
      ),
      meta: { className: 'text-center' },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            openEditDialog(row.original)
          }}
        >
          Edit
        </Button>
      ),
    },
  ], [])

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

      {/* Sync Card */}
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

      {/* Manual Score Entry */}
      <Card>
        <CardHeader>
          <CardTitle>Golfer Scores</CardTitle>
          <CardDescription>
            Click on a golfer to manually edit their scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={golferResults}
            searchPlaceholder="Search golfers..."
            searchColumn="golfer_name"
            emptyMessage="No golfers in field"
            onRowClick={openEditDialog}
            getRowClassName={(golfer) => cn(
              golfer.made_cut === false && 'bg-red-50/50',
              golfer.status === 'withdrawn' && 'bg-amber-50/50 opacity-60'
            )}
          />
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

      {/* Withdrawal Dialog */}
      <Dialog open={!!withdrawingGolfer} onOpenChange={(open) => {
        if (!open) {
          setWithdrawingGolfer(null)
          setWithdrawalResult(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-amber-600" />
              Mark as Withdrawn
            </DialogTitle>
            <DialogDescription>
              {withdrawingGolfer?.golfer_name} will be marked as withdrawn from the tournament.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {withdrawalResult ? (
              <div className={cn(
                'px-4 py-3 rounded-md',
                withdrawalResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              )}>
                <p className={cn(
                  'font-medium mb-2',
                  withdrawalResult.success ? 'text-green-800' : 'text-red-800'
                )}>
                  {withdrawalResult.success ? 'Withdrawal Processed' : 'Error'}
                </p>
                <p className={cn(
                  'text-sm',
                  withdrawalResult.success ? 'text-green-700' : 'text-red-700'
                )}>
                  {withdrawalResult.message}
                </p>

                {withdrawalResult.replacements && withdrawalResult.replacements.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-green-800">Replacements Made:</p>
                    <ul className="text-sm text-green-700 space-y-1">
                      {withdrawalResult.replacements.map((r, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="font-medium">{r.entryName}</span>
                          <span className="text-green-600">→</span>
                          <span>{r.replacement} (T{r.tier})</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-green-600 mt-2">
                      Notification emails have been sent to affected participants.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-md">
                <p className="text-amber-800 text-sm">
                  <strong>This will:</strong>
                </p>
                <ul className="text-amber-700 text-sm mt-2 space-y-1 list-disc list-inside">
                  <li>Mark {withdrawingGolfer?.golfer_name} as withdrawn</li>
                  <li>Find all entries that have this golfer picked</li>
                  <li>Auto-replace with the best available golfer in the same tier (by OWGR)</li>
                  <li>Send notification emails to affected participants</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            {withdrawalResult ? (
              <Button onClick={() => {
                setWithdrawingGolfer(null)
                setWithdrawalResult(null)
              }}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setWithdrawingGolfer(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleWithdrawal}
                  disabled={withdrawalProcessing}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {withdrawalProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <UserX className="mr-2 h-4 w-4" />
                  Process Withdrawal
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
