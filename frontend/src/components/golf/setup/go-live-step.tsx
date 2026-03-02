'use client'

import { useState, useEffect } from 'react'
import { useGolfSetup } from './golf-setup-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function GoLiveStep() {
  const { poolId, gpPool, tournament, pool, tierStatus, hasEntries } = useGolfSetup()

  // Live scoring state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [syncHadData, setSyncHadData] = useState(true)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncCooldownRemaining, setSyncCooldownRemaining] = useState(0)
  const SYNC_COOLDOWN_SECONDS = 300

  useEffect(() => {
    const stored = localStorage.getItem(`golf-sync-${poolId}`)
    if (stored) {
      const storedTime = new Date(stored)
      setLastSyncTime(storedTime)
      const elapsed = Math.floor((Date.now() - storedTime.getTime()) / 1000)
      setSyncCooldownRemaining(Math.max(0, SYNC_COOLDOWN_SECONDS - elapsed))
    }
  }, [poolId])

  useEffect(() => {
    if (syncCooldownRemaining > 0) {
      const timer = setInterval(() => {
        setSyncCooldownRemaining(prev => Math.max(0, prev - 1))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [syncCooldownRemaining])

  function isTournamentHours(): boolean {
    const hour = new Date().getHours()
    return hour >= 7 && hour <= 21
  }

  function formatCooldown(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  async function handleSyncScores() {
    setSyncing(true)
    setSyncResult(null)

    try {
      const response = await fetch('/api/golf/sync-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to sync scores')

      const now = new Date()
      setLastSyncTime(now)
      setSyncCooldownRemaining(SYNC_COOLDOWN_SECONDS)
      localStorage.setItem(`golf-sync-${poolId}`, now.toISOString())

      const hadData = data.matchedGolfers > 0
      setSyncHadData(hadData)
      setSyncResult(data.message || `Synced ${data.matchedGolfers} golfer scores from live API`)
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : 'Failed to sync scores')
      setSyncHadData(false)
    }

    setSyncing(false)
  }

  // Pre-launch checklist
  const checks = [
    { label: 'Tournament linked', ok: !!tournament },
    { label: 'All golfers have tiers', ok: tierStatus.fieldCount > 0 && tierStatus.tieredCount >= tierStatus.fieldCount },
    { label: 'Picks lock time set', ok: !!gpPool.picks_lock_at },
    { label: 'Public URL configured', ok: !!gpPool.public_slug },
  ]
  const allReady = checks.every(c => c.ok)
  const isLive = pool.status !== 'draft'
  const demoMode = gpPool.demo_mode ?? false

  return (
    <div className="space-y-6">
      {/* Pre-launch Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>{isLive ? 'Pool Status' : 'Pre-Launch Checklist'}</CardTitle>
          <CardDescription>
            {isLive ? 'Your pool is live' : 'Complete all items to launch your pool'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checks.map((check, i) => (
            <div key={i} className="flex items-center gap-3">
              {check.ok ? (
                <Check className="h-5 w-5 text-green-600 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              )}
              <span className={cn('text-sm', check.ok ? 'text-foreground' : 'text-muted-foreground')}>
                {check.label}
              </span>
            </div>
          ))}

          {!isLive && allReady && (
            <div className="pt-4 border-t">
              <p className="text-sm text-green-600 font-medium mb-3">
                All checks passed! Your pool is ready to accept entries.
              </p>
              <p className="text-sm text-muted-foreground">
                The pool status will automatically transition to &quot;Accepting Entries&quot; when public entries are enabled, or you can share join links from the pool page.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Scoring */}
      {tournament && !demoMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Live Scoring
            </CardTitle>
            <CardDescription>Sync live scores from the PGA Tour leaderboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {syncResult && (
              <div className={cn(
                'px-4 py-3 rounded-md text-sm',
                syncHadData ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
              )}>
                {syncResult}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                isTournamentHours() ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              )}>
                <span className={cn('w-2 h-2 rounded-full', isTournamentHours() ? 'bg-green-500' : 'bg-amber-500')} />
                {isTournamentHours() ? 'Tournament hours (7am-9pm)' : 'Outside tournament hours'}
              </div>
              {lastSyncTime && (
                <div className="text-muted-foreground">Last synced: {lastSyncTime.toLocaleTimeString()}</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSyncScores} disabled={syncing || syncCooldownRemaining > 0}>
                {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="mr-2 h-4 w-4" />
                {syncCooldownRemaining > 0 ? `Wait ${formatCooldown(syncCooldownRemaining)}` : 'Sync Live Scores'}
              </Button>
              {syncCooldownRemaining > 0 && (
                <span className="text-sm text-muted-foreground">Cooldown prevents excessive API calls</span>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Sync every 5-10 minutes during active play.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Commissioner Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Commissioner Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href={`/pools/${poolId}/golf/tiers`}>
              <Button variant="outline">Edit Tier Assignments</Button>
            </Link>
            <Link href={`/pools/${poolId}/golf/entries`}>
              <Button variant="outline">Manage Entries</Button>
            </Link>
            <Link href={`/pools/${poolId}/golf/scores`}>
              <Button variant="outline">Edit Scores</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
