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
import { Textarea } from '@/components/ui/textarea'

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
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [name, setName] = useState('')
  const [bulkNames, setBulkNames] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const spotsRemaining = 64 - currentEntryCount

  const handleAddSingle = async () => {
    if (!name.trim()) {
      setError('Please enter a name')
      return
    }

    setError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('mm_entries').insert({
      mm_pool_id: mmPoolId,
      display_name: name.trim(),
    })

    if (insertError) {
      if (insertError.code === '23505') {
        setError('This name is already entered')
      } else {
        setError(insertError.message)
      }
      setIsSubmitting(false)
      return
    }

    setName('')
    setOpen(false)
    setIsSubmitting(false)
    router.refresh()
  }

  const handleAddBulk = async () => {
    const names = bulkNames
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0)

    if (names.length === 0) {
      setError('Please enter at least one name')
      return
    }

    if (names.length > spotsRemaining) {
      setError(`Only ${spotsRemaining} spots remaining. You entered ${names.length} names.`)
      return
    }

    // Check for duplicates in the input
    const uniqueNames = new Set(names)
    if (uniqueNames.size !== names.length) {
      setError('Duplicate names found in your list')
      return
    }

    setError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const entries = names.map(n => ({
      mm_pool_id: mmPoolId,
      display_name: n,
    }))

    const { error: insertError } = await supabase.from('mm_entries').insert(entries)

    if (insertError) {
      if (insertError.code === '23505') {
        setError('One or more names are already entered')
      } else {
        setError(insertError.message)
      }
      setIsSubmitting(false)
      return
    }

    setBulkNames('')
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
    <Dialog open={open} onOpenChange={setOpen}>
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

        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === 'single' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('single')}
          >
            Single
          </Button>
          <Button
            variant={mode === 'bulk' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('bulk')}
          >
            Bulk Add
          </Button>
        </div>

        {mode === 'single' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Participant Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                onKeyDown={(e) => e.key === 'Enter' && handleAddSingle()}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulkNames">Names (one per line)</Label>
              <Textarea
                id="bulkNames"
                value={bulkNames}
                onChange={(e) => setBulkNames(e.target.value)}
                placeholder={"John Smith\nJane Doe\nBob Johnson"}
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                {bulkNames.split('\n').filter(n => n.trim()).length} names entered
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={mode === 'single' ? handleAddSingle : handleAddBulk}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding...' : mode === 'single' ? 'Add Entry' : 'Add All'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
