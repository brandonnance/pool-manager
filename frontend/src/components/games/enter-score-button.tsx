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

interface EnterScoreButtonProps {
  gameId: string
  gameName: string
  homeTeamName: string
  awayTeamName: string
  currentHomeScore: number | null
  currentAwayScore: number | null
  currentStatus: string | null
}

export function EnterScoreButton({
  gameId,
  gameName,
  homeTeamName,
  awayTeamName,
  currentHomeScore,
  currentAwayScore,
  currentStatus,
}: EnterScoreButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [homeScore, setHomeScore] = useState(currentHomeScore?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(currentAwayScore?.toString() ?? '')
  const [status, setStatus] = useState(currentStatus ?? 'scheduled')

  const handleOpen = () => {
    setHomeScore(currentHomeScore?.toString() ?? '')
    setAwayScore(currentAwayScore?.toString() ?? '')
    setStatus(currentStatus ?? 'scheduled')
    setError(null)
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate scores if status is final or in_progress
    if (status === 'final' || status === 'in_progress') {
      if (homeScore === '' || awayScore === '') {
        setError('Please enter both scores')
        setIsLoading(false)
        return
      }
    }

    const supabase = createClient()

    const updates: Record<string, unknown> = {
      status,
      home_score: homeScore !== '' ? parseInt(homeScore, 10) : null,
      away_score: awayScore !== '' ? parseInt(awayScore, 10) : null,
    }

    const { error: updateError } = await supabase
      .from('bb_games')
      .update(updates)
      .eq('id', gameId)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setIsOpen(false)
    router.refresh()
  }

  const isFinal = currentStatus === 'final'

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          onClick={handleOpen}
          className={`text-sm font-medium ${
            isFinal
              ? 'text-muted-foreground hover:text-foreground'
              : 'text-primary hover:text-primary/80'
          }`}
        >
          {isFinal ? 'Edit Score' : 'Score'}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Score</DialogTitle>
          <DialogDescription>{gameName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Score Entry */}
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Away Team */}
              <div className="text-center">
                <Label className="block mb-2">{awayTeamName}</Label>
                <Input
                  type="number"
                  min="0"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  className="text-2xl font-bold text-center h-14"
                  placeholder="0"
                />
              </div>

              {/* VS */}
              <div className="text-center text-muted-foreground text-lg font-medium pt-6">
                @
              </div>

              {/* Home Team */}
              <div className="text-center">
                <Label className="block mb-2">{homeTeamName}</Label>
                <Input
                  type="number"
                  min="0"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  className="text-2xl font-bold text-center h-14"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Game Status</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={status === 'scheduled' ? 'default' : 'outline'}
                  onClick={() => setStatus('scheduled')}
                  className={status === 'scheduled' ? '' : ''}
                >
                  Scheduled
                </Button>
                <Button
                  type="button"
                  variant={status === 'in_progress' ? 'default' : 'outline'}
                  onClick={() => setStatus('in_progress')}
                  className={status === 'in_progress' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                >
                  In Progress
                </Button>
                <Button
                  type="button"
                  variant={status === 'final' ? 'default' : 'outline'}
                  onClick={() => setStatus('final')}
                >
                  Final
                </Button>
              </div>
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
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Score'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
