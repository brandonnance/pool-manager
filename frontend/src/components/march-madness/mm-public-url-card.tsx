'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSlug } from '@/hooks/use-slug'
import { validateSlugFormat, getPublicUrl } from '@/lib/slug'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')

  const { slugInput, setSlugInput, handleSlugChange, slugAvailable, checkingSlug } = useSlug({
    table: 'mm_pools',
    initialSlug: publicSlug,
  })

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const publicUrl = publicSlug
    ? `${origin}${getPublicUrl(publicSlug, 'mm_pools').replace(/^.*?\/view/, '/view')}`
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

  const handleUpdateSlug = async () => {
    const trimmedSlug = slugInput.trim().toLowerCase()
    const validationError = validateSlugFormat(trimmedSlug)
    if (validationError) {
      setError(validationError)
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
                onChange={(e) => { handleSlugChange(e.target.value); setError(null) }}
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
                onChange={(e) => { handleSlugChange(e.target.value); setError(null) }}
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
