'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface CreatePoolButtonProps {
  orgId: string
}

export function CreatePoolButton({ orgId }: CreatePoolButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [seasonLabel, setSeasonLabel] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    // Create the pool
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({
        name,
        org_id: orgId,
        type: 'bowl_buster',
        status: 'draft',
        season_label: seasonLabel || null,
        created_by: user.id
      })
      .select()
      .single()

    if (poolError) {
      setError(poolError.message)
      setIsLoading(false)
      return
    }

    // Add the creator as an approved member
    const { error: memberError } = await supabase
      .from('pool_memberships')
      .insert({
        pool_id: pool.id,
        user_id: user.id,
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString()
      })

    if (memberError) {
      setError(memberError.message)
      setIsLoading(false)
      return
    }

    setIsOpen(false)
    setName('')
    setSeasonLabel('')
    router.refresh()
    router.push(`/pools/${pool.id}`)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setName('')
      setSeasonLabel('')
      setError(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Create Pool</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Bowl Buster Pool</DialogTitle>
          <DialogDescription>
            Set up a new bowl pool for your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Pool Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Bowl Pool"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seasonLabel">Season Label (optional)</Label>
              <Input
                id="seasonLabel"
                value={seasonLabel}
                onChange={(e) => setSeasonLabel(e.target.value)}
                placeholder="2024-2025"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Creating...' : 'Create Pool'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
