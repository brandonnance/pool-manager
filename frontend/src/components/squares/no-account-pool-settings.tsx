'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, ExternalLink, Lock, Edit2, Check, X } from 'lucide-react'

interface NoAccountPoolSettingsProps {
  sqPoolId: string
  poolId: string
  publicSlug: string | null
  numbersLocked: boolean
  reverseScoring: boolean
  mode: string | null
  scoringMode: string | null
  poolStatus: string
  onBulkAssignClick: () => void
}

export function NoAccountPoolSettings({
  sqPoolId,
  poolId,
  publicSlug,
  numbersLocked,
  reverseScoring,
  mode,
  scoringMode,
  poolStatus,
  onBulkAssignClick,
}: NoAccountPoolSettingsProps) {
  const router = useRouter()
  const [isLocking, setIsLocking] = useState(false)
  const [isUpdatingSlug, setIsUpdatingSlug] = useState(false)
  const [isUpdatingReverse, setIsUpdatingReverse] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Slug editing
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const [slugInput, setSlugInput] = useState(publicSlug ?? '')

  const publicUrl = publicSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/view/${publicSlug}`
    : null

  const copyToClipboard = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  const handleLockNumbers = async () => {
    if (numbersLocked) return

    setIsLocking(true)
    setError(null)

    const supabase = createClient()

    // Generate shuffled numbers using Fisher-Yates
    const shuffleArray = (arr: number[]) => {
      const result = [...arr]
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
      }
      return result
    }

    const rowNumbers = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const colNumbers = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

    const { error: updateError } = await supabase
      .from('sq_pools')
      .update({
        numbers_locked: true,
        row_numbers: rowNumbers,
        col_numbers: colNumbers,
      })
      .eq('id', sqPoolId)

    if (updateError) {
      setError(updateError.message)
      setIsLocking(false)
      return
    }

    setIsLocking(false)
    router.refresh()
  }

  const handleUpdateSlug = async () => {
    const trimmedSlug = slugInput.trim().toLowerCase()
    if (!trimmedSlug) {
      setError('Please enter a valid slug')
      return
    }

    // Validate format
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens')
      return
    }
    if (trimmedSlug.length < 3 || trimmedSlug.length > 50) {
      setError('Slug must be between 3 and 50 characters')
      return
    }

    setIsUpdatingSlug(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('sq_pools')
      .update({ public_slug: trimmedSlug })
      .eq('id', sqPoolId)

    if (updateError) {
      if (updateError.code === '23505') {
        setError('This slug is already in use. Please choose a different one.')
      } else {
        setError(updateError.message)
      }
      setIsUpdatingSlug(false)
      return
    }

    setIsUpdatingSlug(false)
    setIsEditingSlug(false)
    router.refresh()
  }

  const handleToggleReverse = async (checked: boolean) => {
    setIsUpdatingReverse(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('sq_pools')
      .update({ reverse_scoring: checked })
      .eq('id', sqPoolId)

    if (updateError) {
      setError(updateError.message)
      setIsUpdatingReverse(false)
      return
    }

    setIsUpdatingReverse(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pool Settings</CardTitle>
        <CardDescription>
          {mode === 'single_game' ? 'Single Game' : 'NFL Playoffs'} -{' '}
          {scoringMode === 'score_change' ? 'Score Change' : 'Quarter'} Scoring
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Public URL */}
        <div className="space-y-3">
          <Label>Public View URL</Label>
          {isEditingSlug ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="your-pool-name"
                  disabled={isUpdatingSlug}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleUpdateSlug}
                  disabled={isUpdatingSlug}
                  className="flex-1"
                >
                  <Check className="size-4 mr-1" />
                  {isUpdatingSlug ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditingSlug(false)
                    setSlugInput(publicSlug ?? '')
                  }}
                  disabled={isUpdatingSlug}
                  className="flex-1"
                >
                  <X className="size-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : publicUrl ? (
            <div className="space-y-2">
              {/* URL Display - full width, wrapped */}
              <div className="p-3 bg-muted rounded-md border">
                <p className="text-sm font-mono break-all text-foreground">
                  {publicUrl}
                </p>
              </div>
              {/* Action buttons - full width row */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <Check className="size-4 mr-1.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4 mr-1.5" />
                      Copy Link
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 mr-1.5" />
                    Open
                  </a>
                </Button>
              </div>
              {!numbersLocked && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingSlug(true)}
                  className="w-full text-muted-foreground"
                >
                  <Edit2 className="size-4 mr-1.5" />
                  Edit URL Slug
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-pool-name"
                disabled={isUpdatingSlug}
              />
              <p className="text-xs text-muted-foreground">
                Your URL will be: {typeof window !== 'undefined' ? window.location.origin : ''}/view/<span className="font-medium">{slugInput || 'your-pool-name'}</span>
              </p>
              <Button
                onClick={handleUpdateSlug}
                disabled={isUpdatingSlug || !slugInput.trim()}
                className="w-full"
              >
                {isUpdatingSlug ? 'Saving...' : 'Set Public URL'}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Share this URL with participants to view the grid
          </p>
        </div>

        {/* Lock Numbers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label>Grid Numbers</Label>
              <p className="text-xs text-muted-foreground">
                {numbersLocked
                  ? 'Numbers have been assigned'
                  : 'Lock to randomly assign row/column numbers'}
              </p>
            </div>
            {numbersLocked ? (
              <Badge variant="default" className="gap-1">
                <Lock className="size-3" />
                Locked
              </Badge>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleLockNumbers}
                disabled={isLocking}
              >
                {isLocking ? 'Locking...' : 'Lock Numbers'}
              </Button>
            )}
          </div>
        </div>

        {/* Reverse Scoring */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Reverse Scoring</Label>
            <p className="text-xs text-muted-foreground">
              Award winners for both forward and reverse digit matches
            </p>
          </div>
          <Switch
            checked={reverseScoring}
            onCheckedChange={handleToggleReverse}
            disabled={isUpdatingReverse}
          />
        </div>

        {/* Bulk Assign */}
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={onBulkAssignClick}
          >
            Bulk Assign Squares
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
