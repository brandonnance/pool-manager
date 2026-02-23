'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface AddEntryDialogProps {
  mmPoolId: string
  currentEntryCount: number
  drawCompleted: boolean
}

export function AddEntryDialog({
  mmPoolId,
  currentEntryCount,
  drawCompleted,
}: AddEntryDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [verified, setVerified] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const spotsRemaining = 64 - currentEntryCount

  const handleAdd = async () => {
    if (!name.trim()) {
      setError('Please enter a name')
      return
    }

    const trimmedEmail = email.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const insertData: { mm_pool_id: string; display_name: string; email?: string; verified: boolean } = {
      mm_pool_id: mmPoolId,
      display_name: name.trim(),
      verified,
    }
    if (trimmedEmail) {
      insertData.email = trimmedEmail
    }

    const { error: insertError } = await supabase.from('mm_entries').insert(insertData)

    if (insertError) {
      if (insertError.code === '23505') {
        if (insertError.message?.includes('email')) {
          setError('This email is already entered in this pool')
        } else {
          setError('This name is already entered')
        }
      } else {
        setError(insertError.message)
      }
      setIsSubmitting(false)
      return
    }

    setName('')
    setEmail('')
    setVerified(false)
    setOpen(false)
    setIsSubmitting(false)
    router.refresh()
  }

  if (drawCompleted) {
    return null
  }

  if (spotsRemaining === 0) {
    return (
      <Button disabled>Pool Full (64/64)</Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) {
        setError(null)
        setName('')
        setEmail('')
        setVerified(false)
      }
    }}>
      <DialogTrigger asChild>
        <Button>Add Entry</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Entry</DialogTitle>
          <DialogDescription>
            {spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''} remaining
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Participant Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="verified"
              checked={verified}
              onCheckedChange={(val) => setVerified(val === true)}
            />
            <Label htmlFor="verified" className="text-sm font-normal cursor-pointer">
              Mark as verified
            </Label>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
