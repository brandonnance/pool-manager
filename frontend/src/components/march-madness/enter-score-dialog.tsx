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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EnterScoreDialogProps {
  gameId: string
  higherSeedTeamName: string
  lowerSeedTeamName: string
  higherSeedSeed: number
  lowerSeedSeed: number
  currentHigherScore: number | null
  currentLowerScore: number | null
  currentStatus: string
  spread: number | null
  trigger?: React.ReactNode
}

export function EnterScoreDialog({
  gameId,
  higherSeedTeamName,
  lowerSeedTeamName,
  higherSeedSeed,
  lowerSeedSeed,
  currentHigherScore,
  currentLowerScore,
  currentStatus,
  spread,
  trigger,
}: EnterScoreDialogProps) {
  const [open, setOpen] = useState(false)
  const [higherScore, setHigherScore] = useState(currentHigherScore?.toString() ?? '')
  const [lowerScore, setLowerScore] = useState(currentLowerScore?.toString() ?? '')
  const [status, setStatus] = useState(currentStatus)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const higherScoreNum = parseInt(higherScore)
    const lowerScoreNum = parseInt(lowerScore)

    if (isNaN(higherScoreNum) || isNaN(lowerScoreNum)) {
      setError('Please enter valid scores')
      setIsSubmitting(false)
      return
    }

    if (higherScoreNum < 0 || lowerScoreNum < 0) {
      setError('Scores cannot be negative')
      setIsSubmitting(false)
      return
    }

    if (status === 'final' && higherScoreNum === lowerScoreNum) {
      setError('Final score cannot be a tie')
      setIsSubmitting(false)
      return
    }

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('mm_games')
      .update({
        higher_seed_score: higherScoreNum,
        lower_seed_score: lowerScoreNum,
        status,
      })
      .eq('id', gameId)

    if (updateError) {
      setError(updateError.message)
      setIsSubmitting(false)
      return
    }

    setOpen(false)
    router.refresh()
  }

  // Calculate who covers if we have spread and scores
  let spreadCoverPreview = ''
  if (spread !== null && higherScore && lowerScore) {
    const hScore = parseInt(higherScore)
    const lScore = parseInt(lowerScore)
    if (!isNaN(hScore) && !isNaN(lScore)) {
      const adjustedHigher = hScore + spread
      if (adjustedHigher > lScore) {
        spreadCoverPreview = `${higherSeedTeamName} covers`
      } else if (adjustedHigher < lScore) {
        spreadCoverPreview = `${lowerSeedTeamName} covers`
      } else {
        spreadCoverPreview = 'Push (tie against spread)'
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            {currentHigherScore !== null ? 'Edit Score' : 'Enter Score'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enter Game Score</DialogTitle>
            <DialogDescription>
              Enter the final or current score for this game.
              {spread !== null && (
                <span className="block mt-1">
                  Spread: {spread > 0 ? '+' : ''}{spread} ({spread < 0 ? higherSeedTeamName : lowerSeedTeamName} favored)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Higher seed team */}
            <div className="space-y-2">
              <Label htmlFor="higherScore">
                #{higherSeedSeed} {higherSeedTeamName}
              </Label>
              <Input
                id="higherScore"
                type="number"
                min="0"
                value={higherScore}
                onChange={(e) => setHigherScore(e.target.value)}
                placeholder="0"
                className="text-center text-2xl font-bold"
              />
            </div>

            {/* Lower seed team */}
            <div className="space-y-2">
              <Label htmlFor="lowerScore">
                #{lowerSeedSeed} {lowerSeedTeamName}
              </Label>
              <Input
                id="lowerScore"
                type="number"
                min="0"
                value={lowerScore}
                onChange={(e) => setLowerScore(e.target.value)}
                placeholder="0"
                className="text-center text-2xl font-bold"
              />
            </div>

            {/* Spread cover preview */}
            {spreadCoverPreview && (
              <div className="p-2 bg-muted rounded-md text-center text-sm">
                {spreadCoverPreview}
              </div>
            )}

            {/* Game status */}
            <div className="space-y-2">
              <Label htmlFor="status">Game Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="final">Final</SelectItem>
                </SelectContent>
              </Select>
              {status === 'final' && (
                <p className="text-xs text-amber-600">
                  Setting to final will process advancement and elimination.
                </p>
              )}
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
              {isSubmitting ? 'Saving...' : 'Save Score'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
