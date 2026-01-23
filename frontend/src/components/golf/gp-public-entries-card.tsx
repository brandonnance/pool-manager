'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, ExternalLink, Edit2, X, AlertCircle, Users } from 'lucide-react'

interface GpPublicEntriesCardProps {
  gpPoolId: string
  poolId: string
  tournamentId: string | null
  publicSlug: string | null
  publicEntriesEnabled: boolean
  picksLockAt: string | null
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function GpPublicEntriesCard({
  gpPoolId,
  poolId,
  tournamentId,
  publicSlug,
  publicEntriesEnabled,
  picksLockAt,
}: GpPublicEntriesCardProps) {
  const router = useRouter()
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const [slugInput, setSlugInput] = useState(publicSlug ?? '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [checkingValidation, setCheckingValidation] = useState(false)
  const [enabled, setEnabled] = useState(publicEntriesEnabled)

  // Set origin on client-side only
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // Check validation when component mounts or dependencies change
  useEffect(() => {
    checkReadyForPublicEntries()
  }, [gpPoolId, tournamentId, picksLockAt])

  const publicUrl = publicSlug && origin
    ? `${origin}/pools/golf/${publicSlug}`
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

  // Check if pool is ready for public entries
  async function checkReadyForPublicEntries() {
    setCheckingValidation(true)
    const supabase = createClient()
    const errors: string[] = []

    // Check tournament is linked
    if (!tournamentId) {
      errors.push('No tournament linked')
    }

    // Check picks lock time is set
    if (!picksLockAt) {
      errors.push('Picks lock time not set')
    }

    // Check all golfers have tier assignments
    if (tournamentId) {
      const { count: fieldCount } = await supabase
        .from('gp_tournament_field')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId)

      const { count: tierCount } = await supabase
        .from('gp_tier_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', gpPoolId)

      const missing = (fieldCount ?? 0) - (tierCount ?? 0)
      if (missing > 0) {
        errors.push(`${missing} golfer${missing === 1 ? '' : 's'} missing tier assignments`)
      } else if ((fieldCount ?? 0) === 0) {
        errors.push('No golfers in tournament field')
      }
    }

    setValidation({
      valid: errors.length === 0,
      errors,
    })
    setCheckingValidation(false)
  }

  // Check if slug is available
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null)
      return
    }

    if (slug === publicSlug) {
      setSlugAvailable(true)
      return
    }

    setCheckingSlug(true)
    const supabase = createClient()

    const { data, error: checkError } = await supabase
      .from('gp_pools')
      .select('id')
      .eq('public_slug', slug)
      .maybeSingle()

    setCheckingSlug(false)

    if (checkError) {
      setSlugAvailable(null)
      return
    }

    setSlugAvailable(data === null)
  }, [publicSlug])

  // Debounced slug availability check
  useEffect(() => {
    if (!isEditingSlug || !slugInput || slugInput.length < 3) {
      setSlugAvailable(null)
      return
    }

    const timeoutId = setTimeout(() => {
      checkSlugAvailability(slugInput)
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [slugInput, isEditingSlug, checkSlugAvailability])

  const handleSlugChange = (value: string) => {
    const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setSlugInput(formatted)
    setError(null)
  }

  const handleUpdateSlug = async () => {
    const trimmedSlug = slugInput.trim().toLowerCase()
    if (!trimmedSlug) {
      setError('Please enter a valid slug')
      return
    }

    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens')
      return
    }
    if (trimmedSlug.length < 3 || trimmedSlug.length > 50) {
      setError('Slug must be between 3 and 50 characters')
      return
    }

    setIsUpdating(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('gp_pools')
      .update({ public_slug: trimmedSlug })
      .eq('id', gpPoolId)

    if (updateError) {
      if (updateError.code === '23505') {
        setError('This slug is already in use. Please choose a different one.')
      } else {
        setError(updateError.message)
      }
      setIsUpdating(false)
      return
    }

    setIsUpdating(false)
    setIsEditingSlug(false)
    router.refresh()
  }

  const handleToggleEnabled = async (newEnabled: boolean) => {
    // Don't allow enabling if validation fails
    if (newEnabled && validation && !validation.valid) {
      setError('Cannot enable public entries. Please fix the issues below.')
      return
    }

    // Don't allow enabling without a slug
    if (newEnabled && !publicSlug) {
      setError('Please set a public URL first.')
      return
    }

    setIsUpdating(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('gp_pools')
      .update({ public_entries_enabled: newEnabled })
      .eq('id', gpPoolId)

    if (updateError) {
      setError(updateError.message)
      setIsUpdating(false)
      return
    }

    // Sync pool status after toggling public entries
    try {
      await fetch('/api/golf/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId }),
      })
    } catch (e) {
      console.error('Failed to sync pool status:', e)
    }

    setEnabled(newEnabled)
    setIsUpdating(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Public Entry URL
        </CardTitle>
        <CardDescription>
          Allow anyone to submit entries without creating an account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Slug Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Public URL</Label>

          {isEditingSlug ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">{origin}/pools/golf/</span>
                <Input
                  value={slugInput}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="your-pool-name"
                  disabled={isUpdating}
                  className={`flex-1 font-mono text-sm ${
                    slugAvailable === false ? 'border-destructive' :
                    slugAvailable === true ? 'border-green-500' : ''
                  }`}
                />
                {checkingSlug && (
                  <span className="text-xs text-muted-foreground animate-pulse">...</span>
                )}
              </div>
              {slugAvailable === false && (
                <p className="text-xs text-destructive">This slug is already taken.</p>
              )}
              {slugAvailable === true && slugInput !== publicSlug && (
                <p className="text-xs text-green-600">This slug is available!</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleUpdateSlug}
                  disabled={isUpdating || slugAvailable === false || checkingSlug}
                  className="flex-1"
                >
                  <Check className="size-4 mr-1" />
                  {isUpdating ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditingSlug(false)
                    setSlugInput(publicSlug ?? '')
                    setError(null)
                    setSlugAvailable(null)
                  }}
                  disabled={isUpdating}
                  className="flex-1"
                >
                  <X className="size-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : publicUrl ? (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-md border">
                <p className="text-sm font-mono break-all text-foreground">
                  {publicUrl}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyToClipboard}>
                  {copied ? (
                    <><Check className="size-4 mr-1.5" />Copied!</>
                  ) : (
                    <><Copy className="size-4 mr-1.5" />Copy</>
                  )}
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 mr-1.5" />
                    Open
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingSlug(true)}>
                  <Edit2 className="size-4 mr-1.5" />
                  Edit
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">{origin}/pools/golf/</span>
                <Input
                  value={slugInput}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="your-pool-name"
                  disabled={isUpdating}
                  className={`flex-1 font-mono text-sm ${
                    slugAvailable === false ? 'border-destructive' :
                    slugAvailable === true ? 'border-green-500' : ''
                  }`}
                />
                {checkingSlug && (
                  <span className="text-xs text-muted-foreground animate-pulse">...</span>
                )}
              </div>
              {slugAvailable === false && (
                <p className="text-xs text-destructive">This slug is already taken.</p>
              )}
              {slugAvailable === true && (
                <p className="text-xs text-green-600">This slug is available!</p>
              )}
              <Button
                onClick={handleUpdateSlug}
                disabled={isUpdating || !slugInput.trim() || slugAvailable === false || checkingSlug}
                className="w-full"
              >
                {isUpdating ? 'Saving...' : 'Set Public URL'}
              </Button>
            </div>
          )}
        </div>

        {/* Enable Toggle Section */}
        {publicSlug && (
          <div className="pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="publicEntriesEnabled" className="text-sm font-medium">
                  Accept Public Entries
                </Label>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? 'Anyone with the link can submit entries'
                    : 'Public URL is disabled'}
                </p>
              </div>
              <Switch
                id="publicEntriesEnabled"
                checked={enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isUpdating || checkingValidation || (!!validation && !validation.valid && !enabled)}
              />
            </div>

            {/* Validation Errors */}
            {validation && !validation.valid && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Cannot enable public entries
                </div>
                <ul className="text-sm text-amber-600 space-y-1 ml-6 list-disc">
                  {validation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Success indicator */}
            {enabled && validation?.valid && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-700 flex items-center gap-2">
                <Check className="h-4 w-4" />
                Public entries are active. Share the URL above to collect entries.
              </div>
            )}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
