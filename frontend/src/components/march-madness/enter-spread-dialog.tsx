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

interface EnterSpreadDialogProps {
  gameId: string
  higherSeedTeamName: string
  lowerSeedTeamName: string
  currentSpread: number | null
  trigger?: React.ReactNode
}

export function EnterSpreadDialog({
  gameId,
  higherSeedTeamName,
  lowerSeedTeamName,
  currentSpread,
  trigger,
}: EnterSpreadDialogProps) {
  const [open, setOpen] = useState(false)
  const [spread, setSpread] = useState(currentSpread?.toString() ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const spreadValue = parseFloat(spread)
    if (isNaN(spreadValue)) {
      setError('Please enter a valid spread')
      setIsSubmitting(false)
      return
    }

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('mm_games')
      .update({ spread: spreadValue })
      .eq('id', gameId)

    if (updateError) {
      setError(updateError.message)
      setIsSubmitting(false)
      return
    }

    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            {currentSpread !== null ? 'Edit Spread' : 'Enter Spread'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enter Spread</DialogTitle>
            <DialogDescription>
              Enter the point spread for this game. Negative means the higher seed is favored.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="text-sm text-muted-foreground text-center">
              <span className="font-medium text-foreground">{higherSeedTeamName}</span>
              {' vs '}
              <span className="font-medium text-foreground">{lowerSeedTeamName}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="spread">
                Spread (negative = {higherSeedTeamName} favored)
              </Label>
              <Input
                id="spread"
                type="number"
                step="0.5"
                value={spread}
                onChange={(e) => setSpread(e.target.value)}
                placeholder="-5.5"
                className="text-center text-lg font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Example: -5.5 means {higherSeedTeamName} is favored by 5.5 points
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Spread'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
