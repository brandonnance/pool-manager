'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check, ExternalLink, Link2 } from 'lucide-react'

interface PublicLinkManagerProps {
  mmPoolId: string
  currentSlug: string | null
}

export function PublicLinkManager({ mmPoolId, currentSlug }: PublicLinkManagerProps) {
  const [slug, setSlug] = useState(currentSlug || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const generateSlug = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setSlug(result)
    setError(null)
  }

  const handleSave = async () => {
    if (!slug.trim()) {
      setError('Please enter or generate a slug')
      return
    }

    setIsSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('mm_pools')
      .update({ public_slug: slug.trim().toLowerCase() })
      .eq('id', mmPoolId)

    if (updateError) {
      if (updateError.code === '23505') {
        setError('This link is already in use. Try a different one.')
      } else {
        setError('Failed to save. Please try again.')
      }
    } else {
      router.refresh()
    }
    setIsSaving(false)
  }

  const handleRemove = async () => {
    setIsSaving(true)
    const supabase = createClient()
    await supabase
      .from('mm_pools')
      .update({ public_slug: null })
      .eq('id', mmPoolId)

    setSlug('')
    router.refresh()
    setIsSaving(false)
  }

  const copyLink = () => {
    if (!currentSlug) return
    const url = `${window.location.origin}/madness/${currentSlug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const publicUrl = currentSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/madness/${currentSlug}`
    : null

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Public Entry Request Link</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Share this link to let people request entry to your pool. You can approve or deny requests.
        </p>
      </div>

      {currentSlug ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 p-2 bg-muted rounded-md text-sm font-mono truncate">
              {publicUrl}
            </div>
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={publicUrl!} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleRemove} disabled={isSaving}>
            Remove Public Link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">/madness/</span>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  setError(null)
                }}
                placeholder="your-pool-slug"
                className="flex-1"
              />
            </div>
            <Button size="sm" variant="outline" onClick={generateSlug}>
              <Link2 className="h-4 w-4 mr-1" />
              Generate
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSave} disabled={isSaving || !slug.trim()}>
            {isSaving ? 'Saving...' : 'Enable Public Link'}
          </Button>
        </div>
      )}
    </div>
  )
}
