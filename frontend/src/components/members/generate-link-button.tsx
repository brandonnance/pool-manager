'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { generateLinkSchema, type GenerateLinkValues } from '@/lib/form-schemas'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface GenerateLinkButtonProps {
  poolId: string
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

function computeExpiresAt(expiresIn: 'never' | '1d' | '7d' | '30d'): string | null {
  const DAY_MS = 24 * 60 * 60 * 1000
  switch (expiresIn) {
    case '1d': return new Date(Date.now() + DAY_MS).toISOString()
    case '7d': return new Date(Date.now() + 7 * DAY_MS).toISOString()
    case '30d': return new Date(Date.now() + 30 * DAY_MS).toISOString()
    default: return null
  }
}

export function GenerateLinkButton({ poolId }: GenerateLinkButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const router = useRouter()

  const form = useForm<GenerateLinkValues>({
    resolver: zodResolver(generateLinkSchema),
    defaultValues: { maxUses: '', expiresIn: 'never' },
  })

  const onSubmit = async (values: GenerateLinkValues) => {
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      return
    }

    const token = generateToken()
    const expiresAt = computeExpiresAt(values.expiresIn)

    const { error: insertError } = await supabase
      .from('join_links')
      .insert({
        pool_id: poolId,
        token,
        created_by: user.id,
        max_uses: values.maxUses ? parseInt(values.maxUses, 10) : null,
        expires_at: expiresAt,
      })

    if (insertError) {
      setError(insertError.message)
      return
    }

    const url = `${window.location.origin}/join/${token}`
    setGeneratedUrl(url)
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
      form.reset({ maxUses: '', expiresIn: 'never' })
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="maxUses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum uses (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Unlimited"
                        min="1"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expires</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="never">Never</option>
                        <option value="1d">In 1 day</option>
                        <option value="7d">In 7 days</option>
                        <option value="30d">In 30 days</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Generating...' : 'Generate'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
