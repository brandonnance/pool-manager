'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Json } from '@/types/database'

interface Pool {
  id: string
  name: string
  status: string
  settings: Json | null
  visibility: string
  demo_mode: boolean
}

interface PoolSettingsProps {
  pool: Pool
  allGamesFinal?: boolean
  finalGamesCount?: number
  totalGamesCount?: number
}

export function PoolSettings({ pool, allGamesFinal, finalGamesCount, totalGamesCount }: PoolSettingsProps) {
  const [isActivating, setIsActivating] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false)
  const [isUpdatingDemoMode, setIsUpdatingDemoMode] = useState(false)
  const [visibility, setVisibility] = useState(pool.visibility)
  const [demoMode, setDemoMode] = useState(pool.demo_mode)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleVisibilityChange = async (newVisibility: string) => {
    setIsUpdatingVisibility(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ visibility: newVisibility })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsUpdatingVisibility(false)
      return
    }

    setVisibility(newVisibility)
    setIsUpdatingVisibility(false)
    router.refresh()
  }

  const handleActivate = async () => {
    if (!confirm('Are you sure you want to activate this pool? Members will be able to make picks.')) {
      return
    }

    setIsActivating(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'open' })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsActivating(false)
      return
    }

    router.refresh()
  }

  const handleComplete = async () => {
    if (!confirm('Are you sure you want to complete this pool? This will finalize standings and no more picks can be made.')) {
      return
    }

    setIsCompleting(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'completed' })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsCompleting(false)
      return
    }

    router.refresh()
  }

  const handleDemoModeToggle = async (checked: boolean) => {
    setIsUpdatingDemoMode(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ demo_mode: checked })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsUpdatingDemoMode(false)
      return
    }

    setDemoMode(checked)
    setIsUpdatingDemoMode(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pool Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {pool.status === 'draft' && (
          <Button
            onClick={handleActivate}
            disabled={isActivating}
            className="w-full"
          >
            {isActivating ? 'Activating...' : 'Activate Pool'}
          </Button>
        )}

        {pool.status === 'open' && (
          <>
            {allGamesFinal ? (
              <Button
                onClick={handleComplete}
                disabled={isCompleting}
                className="w-full"
              >
                {isCompleting ? 'Completing...' : 'Complete Pool'}
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted rounded-md p-3">
                <p className="font-medium">Games in progress</p>
                <p className="text-xs mt-1">
                  {finalGamesCount ?? 0} of {totalGamesCount ?? 0} games final
                </p>
              </div>
            )}
          </>
        )}

        {/* Visibility Toggle */}
        <div className="pt-3 border-t border-border">
          <Label className="text-sm font-medium block mb-3">
            Pool Visibility
          </Label>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="invite_only"
                checked={visibility === 'invite_only'}
                onChange={() => handleVisibilityChange('invite_only')}
                disabled={isUpdatingVisibility}
                className="h-4 w-4 text-primary focus:ring-primary border-input"
              />
              <span className="ml-2 text-sm">
                Invite Only
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="open_to_org"
                checked={visibility === 'open_to_org'}
                onChange={() => handleVisibilityChange('open_to_org')}
                disabled={isUpdatingVisibility}
                className="h-4 w-4 text-primary focus:ring-primary border-input"
              />
              <span className="ml-2 text-sm">
                Open to Organization
              </span>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {visibility === 'invite_only'
              ? 'Only users with an invite link can join'
              : 'Any organization member can see and request to join'}
          </p>
        </div>

        {/* Demo Mode Toggle */}
        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">
                Demo Mode
              </Label>
              <p className="text-xs text-muted-foreground">
                Bypass pick locking for testing
              </p>
            </div>
            <Switch
              checked={demoMode}
              onCheckedChange={handleDemoModeToggle}
              disabled={isUpdatingDemoMode}
            />
          </div>
          {demoMode && (
            <Alert className="mt-3 bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-700 text-xs">
                Demo mode is ON - all pick locks are bypassed
              </AlertDescription>
            </Alert>
          )}
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Status: <span className="font-medium">{pool.status}</span>
        </p>
      </CardContent>
    </Card>
  )
}
