'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, ExternalLink } from 'lucide-react'

interface GpPublicUrlDisplayProps {
  publicSlug: string
}

export function GpPublicUrlDisplay({ publicSlug }: GpPublicUrlDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')

  // Set origin on client-side only to avoid hydration mismatch
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const publicUrl = origin ? `${origin}/pools/golf/${publicSlug}` : null

  const copyToClipboard = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silently fail
    }
  }

  if (!publicUrl) return null

  return (
    <div className="pt-3 mt-3 border-t space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Public Leaderboard URL</p>
      <div className="p-2 bg-muted rounded-md">
        <p className="text-xs font-mono break-all text-foreground">
          {publicUrl}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={copyToClipboard}
          className="flex-1"
        >
          {copied ? (
            <>
              <Check className="size-3 mr-1" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="size-3 mr-1" />
              Copy
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" asChild className="flex-1">
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3 mr-1" />
            Open
          </a>
        </Button>
      </div>
    </div>
  )
}
