'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGolfSetup } from './golf-setup-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { GpPublicEntriesCard } from '@/components/golf/gp-public-entries-card'
import { Loader2 } from 'lucide-react'

export function SettingsStep() {
  const { poolId, gpPool, reload } = useGolfSetup()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minTierPoints, setMinTierPoints] = useState(gpPool.min_tier_points ?? 21)
  const [demoMode, setDemoMode] = useState(gpPool.demo_mode ?? false)
  const [picksLockAt, setPicksLockAt] = useState(() => {
    if (!gpPool.picks_lock_at) return ''
    const date = new Date(gpPool.picks_lock_at)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  })

  async function handleSave() {
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('gp_pools')
      .update({
        min_tier_points: minTierPoints,
        demo_mode: demoMode,
        picks_lock_at: picksLockAt ? new Date(picksLockAt).toISOString() : null,
      })
      .eq('id', gpPool.id)

    if (updateError) {
      setError('Failed to save settings')
    } else {
      await reload()
    }

    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">{error}</div>
      )}

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
            <Switch id="demoMode" checked={demoMode} onCheckedChange={setDemoMode} />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Public Entry URL */}
      {gpPool.tournament_id && (
        <GpPublicEntriesCard
          gpPoolId={gpPool.id}
          poolId={poolId}
          tournamentId={gpPool.tournament_id}
          publicSlug={gpPool.public_slug}
          publicEntriesEnabled={gpPool.public_entries_enabled ?? false}
          picksLockAt={gpPool.picks_lock_at}
        />
      )}
    </div>
  )
}
