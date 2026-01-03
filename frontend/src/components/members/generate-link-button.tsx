'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface GenerateLinkButtonProps {
  poolId: string
}

function generateToken(): string {
  // Use cryptographically secure random via Web Crypto API
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

export function GenerateLinkButton({ poolId }: GenerateLinkButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)

  const [maxUses, setMaxUses] = useState<string>('')
  const [expiresIn, setExpiresIn] = useState<string>('never')

  const router = useRouter()

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    const token = generateToken()

    let expiresAt: string | null = null
    if (expiresIn === '1d') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    } else if (expiresIn === '7d') {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (expiresIn === '30d') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    const { error: insertError } = await supabase
      .from('join_links')
      .insert({
        pool_id: poolId,
        token,
        created_by: user.id,
        max_uses: maxUses ? parseInt(maxUses, 10) : null,
        expires_at: expiresAt
      })

    if (insertError) {
      setError(insertError.message)
      setIsLoading(false)
      return
    }

    const url = `${window.location.origin}/join/${token}`
    setGeneratedUrl(url)
    setIsLoading(false)
    router.refresh()
  }

  const handleCopy = async () => {
    if (generatedUrl) {
      try {
        await navigator.clipboard.writeText(generatedUrl)
        toast.success('Link copied to clipboard')
      } catch {
        toast.error('Failed to copy link')
      }
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setGeneratedUrl(null)
      setError(null)
      setMaxUses('')
      setExpiresIn('never')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Generate Invite Link</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {generatedUrl ? 'Invite Link Created!' : 'Generate Invite Link'}
          </DialogTitle>
          <DialogDescription>
            {generatedUrl
              ? 'Share this link with people you want to invite to the pool.'
              : 'Create an invite link that others can use to join this pool.'
            }
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {generatedUrl ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Share this link</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={generatedUrl}
                  className="bg-muted text-sm"
                />
                <Button onClick={handleCopy} variant="secondary" className="gap-1 shrink-0">
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="maxUses">Maximum uses (optional)</Label>
              <Input
                id="maxUses"
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresIn">Expires</Label>
              <select
                id="expiresIn"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="never">Never</option>
                <option value="1d">In 1 day</option>
                <option value="7d">In 7 days</option>
                <option value="30d">In 30 days</option>
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={isLoading}>
                {isLoading ? 'Generating...' : 'Generate'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
