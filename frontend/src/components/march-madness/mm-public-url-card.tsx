'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, ExternalLink, Edit2, X } from 'lucide-react'

interface MmPublicUrlCardProps {
  mmPoolId: string
  publicSlug: string | null
}

export function MmPublicUrlCard({ mmPoolId, publicSlug }: MmPublicUrlCardProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [slugInput, setSlugInput] = useState(publicSlug ?? '')
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)

  // Set origin on client-side only to avoid hydration mismatch
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const publicUrl = publicSlug && origin
    ? `${origin}/view/mm/${publicSlug}`
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

  // Check if slug is available
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null)
      return
    }

    // Don't check if it's the current slug
    if (slug === publicSlug) {
      setSlugAvailable(true)
      return
    }

    setCheckingSlug(true)
    const supabase = createClient()

    const { data, error: checkError } = await supabase
      .from('mm_pools')
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
    if (!isEditing || !slugInput || slugInput.length < 3) {
      setSlugAvailable(null)
      return
    }

    const timeoutId = setTimeout(() => {
      checkSlugAvailability(slugInput)
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [slugInput, isEditing, checkSlugAvailability])

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

    // Validate format
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
      .from('mm_pools')
      .update({ public_slug: trimmedSlug })
      .eq('id', mmPoolId)

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
    setIsEditing(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Public View URL</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Share this URL with participants to view the bracket and standings without logging in.
        </p>

        {isEditing ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{origin}/view/mm/</span>
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
              <p className="text-xs text-destructive">This slug is already taken. Try a different one.</p>
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
                  setIsEditing(false)
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
            {/* URL Display */}
            <div className="p-3 bg-muted rounded-md border">
              <p className="text-sm font-mono break-all text-foreground">
                {publicUrl}
              </p>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <>
                    <Check className="size-4 mr-1.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-4 mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4 mr-1.5" />
                  Open
                </a>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="size-4 mr-1.5" />
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">{origin}/view/mm/</span>
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
              <p className="text-xs text-destructive">This slug is already taken. Try a different one.</p>
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
