'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'

interface EditGameTeamsButtonProps {
  gameId: string
  gameName: string
  homeTeam: string
  awayTeam: string
  espnGameId: string | null
}

export function EditGameTeamsButton({
  gameId,
  gameName,
  homeTeam,
  awayTeam,
  espnGameId,
}: EditGameTeamsButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [home, setHome] = useState(homeTeam)
  const [away, setAway] = useState(awayTeam)
  const [espnId, setEspnId] = useState(espnGameId ?? '')

  const handleSave = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('sq_games')
      .update({
        home_team: home.trim(),
        away_team: away.trim(),
        espn_game_id: espnId.trim() || null,
      })
      .eq('id', gameId)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setOpen(false)
    router.refresh()
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      // Reset to current values when opening
      setHome(homeTeam)
      setAway(awayTeam)
      setEspnId(espnGameId ?? '')
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Pencil className="h-3 w-3" />
          <span className="sr-only">Edit teams</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Teams</DialogTitle>
          <DialogDescription>{gameName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="away-team">Away Team</Label>
            <Input
              id="away-team"
              value={away}
              onChange={(e) => setAway(e.target.value)}
              placeholder="e.g., Chiefs"
            />
          </div>

          <div className="text-center text-muted-foreground">@</div>

          <div className="space-y-2">
            <Label htmlFor="home-team">Home Team</Label>
            <Input
              id="home-team"
              value={home}
              onChange={(e) => setHome(e.target.value)}
              placeholder="e.g., Bills"
            />
          </div>

          <div className="pt-4 border-t space-y-2">
            <Label htmlFor="espn-game-id">
              ESPN Game ID <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="espn-game-id"
              value={espnId}
              onChange={(e) => setEspnId(e.target.value)}
              placeholder="e.g., 401772979"
            />
            <p className="text-xs text-muted-foreground">
              Enter the ESPN game ID to enable live score syncing. Find this in the ESPN game URL.
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !home.trim() || !away.trim()}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
