'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TeamAutocomplete } from './team-autocomplete'
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

interface Team {
  id: string
  name: string
  abbrev: string | null
  logo_url?: string | null
  color?: string | null
}

interface EditSpreadButtonProps {
  gameId: string
  poolGameId: string
  poolId: string
  kind: 'bowl' | 'cfp'
  currentSpread: number | null
  gameName: string
  currentGameName?: string | null
  currentHomeTeamId?: string | null
  currentAwayTeamId?: string | null
  currentKickoffAt?: string | null
  teams?: Team[]
}

export function EditSpreadButton({
  gameId,
  poolGameId,
  poolId,
  kind,
  currentSpread,
  gameName,
  currentGameName,
  currentHomeTeamId,
  currentAwayTeamId,
  currentKickoffAt,
  teams = []
}: EditSpreadButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Form state
  const [gameNameInput, setGameNameInput] = useState(currentGameName ?? '')
  const [homeTeamId, setHomeTeamId] = useState(currentHomeTeamId ?? '')
  const [awayTeamId, setAwayTeamId] = useState(currentAwayTeamId ?? '')
  const [spread, setSpread] = useState(currentSpread?.toString() ?? '')

  // Parse kickoff time into separate fields
  const parseKickoff = (kickoffAt: string | null | undefined) => {
    if (!kickoffAt) return { date: '', hour: '12', minute: '00', ampm: 'PM' as const }
    const d = new Date(kickoffAt)
    const hours = d.getHours()
    const ampm = hours >= 12 ? 'PM' as const : 'AM' as const
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    const minute = d.getMinutes()
    const nearestMinute = Math.round(minute / 15) * 15
    return {
      date: d.toISOString().split('T')[0],
      hour: hour12.toString(),
      minute: (nearestMinute === 60 ? 0 : nearestMinute).toString().padStart(2, '0'),
      ampm
    }
  }

  const parsed = parseKickoff(currentKickoffAt)
  const [kickoffDate, setKickoffDate] = useState(parsed.date)
  const [kickoffHour, setKickoffHour] = useState(parsed.hour)
  const [kickoffMinute, setKickoffMinute] = useState(parsed.minute)
  const [kickoffAmPm, setKickoffAmPm] = useState<'AM' | 'PM'>(parsed.ampm)

  const handleOpen = () => {
    // Reset form to current values when opening
    setGameNameInput(currentGameName ?? '')
    setHomeTeamId(currentHomeTeamId ?? '')
    setAwayTeamId(currentAwayTeamId ?? '')
    setSpread(currentSpread?.toString() ?? '')
    const p = parseKickoff(currentKickoffAt)
    setKickoffDate(p.date)
    setKickoffHour(p.hour)
    setKickoffMinute(p.minute)
    setKickoffAmPm(p.ampm)
    setError(null)
    setIsOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!homeTeamId || !awayTeamId) {
      setError('Please select both teams')
      setIsLoading(false)
      return
    }

    if (homeTeamId === awayTeamId) {
      setError('Home and away teams must be different')
      setIsLoading(false)
      return
    }

    // Validate spread is whole number or .5
    if (spread) {
      const spreadNum = parseFloat(spread)
      const decimal = Math.abs(spreadNum % 1)
      if (decimal !== 0 && decimal !== 0.5) {
        setError('Spread must be a whole number or end in .5')
        setIsLoading(false)
        return
      }
    }

    // Build kickoff datetime
    let kickoffIso: string | null = null
    if (kickoffDate) {
      let hour24 = parseInt(kickoffHour, 10)
      if (kickoffAmPm === 'PM' && hour24 !== 12) hour24 += 12
      if (kickoffAmPm === 'AM' && hour24 === 12) hour24 = 0
      const kickoffDateTime = new Date(`${kickoffDate}T${hour24.toString().padStart(2, '0')}:${kickoffMinute}:00`)
      kickoffIso = kickoffDateTime.toISOString()
    }

    const supabase = createClient()

    // Check if teams changed - if so, we need to delete picks
    const teamsChanged = homeTeamId !== currentHomeTeamId || awayTeamId !== currentAwayTeamId

    if (teamsChanged) {
      if (kind === 'cfp') {
        // For CFP games, delete ALL CFP picks for ALL entries in this pool
        const confirmed = confirm(
          'Changing teams on a CFP game will delete ALL CFP bracket picks for ALL users in this pool. ' +
          'Users will need to redo their entire bracket. Are you sure you want to continue?'
        )
        if (!confirmed) {
          setIsLoading(false)
          return
        }

        // Get all entry IDs for this pool
        const { data: entries, error: entriesError } = await supabase
          .from('bb_entries')
          .select('id')
          .eq('pool_id', poolId)

        if (entriesError) {
          setError(`Failed to get entries: ${entriesError.message}`)
          setIsLoading(false)
          return
        }

        if (entries && entries.length > 0) {
          const entryIds = entries.map(e => e.id)
          const { error: deleteError } = await supabase
            .from('bb_cfp_entry_picks')
            .delete()
            .in('entry_id', entryIds)

          if (deleteError) {
            setError(`Failed to clear CFP picks: ${deleteError.message}`)
            setIsLoading(false)
            return
          }
        }
      } else {
        // For bowl games, only delete picks for this specific game
        const confirmed = confirm(
          'Changing teams will delete all existing picks for this game. Are you sure you want to continue?'
        )
        if (!confirmed) {
          setIsLoading(false)
          return
        }

        const { error: deleteError } = await supabase
          .from('bb_bowl_picks')
          .delete()
          .eq('pool_game_id', poolGameId)

        if (deleteError) {
          setError(`Failed to clear picks: ${deleteError.message}`)
          setIsLoading(false)
          return
        }
      }
    }

    const { error: updateError } = await supabase
      .from('bb_games')
      .update({
        game_name: gameNameInput.trim() || null,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_at: kickoffIso,
        home_spread: spread ? parseFloat(spread) : null
      })
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          onClick={handleOpen}
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          Edit
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Game</DialogTitle>
          <DialogDescription>
            Update game details for {gameName || 'this game'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Game Name */}
            <div className="space-y-2">
              <Label htmlFor="editGameName">Bowl Name</Label>
              <Input
                id="editGameName"
                value={gameNameInput}
                onChange={(e) => setGameNameInput(e.target.value)}
                placeholder="e.g., Rose Bowl"
              />
            </div>

            {/* Away Team */}
            <TeamAutocomplete
              teams={teams}
              selectedTeamId={awayTeamId}
              onSelect={setAwayTeamId}
              label="Away Team"
              id="editAwayTeam"
              placeholder="Search for away team..."
            />

            {/* Home Team */}
            <TeamAutocomplete
              teams={teams}
              selectedTeamId={homeTeamId}
              onSelect={setHomeTeamId}
              label="Home Team"
              id="editHomeTeam"
              placeholder="Search for home team..."
            />

            {/* Kickoff Date */}
            <div className="space-y-2">
              <Label htmlFor="editKickoffDate">Kickoff Date</Label>
              <Input
                type="date"
                id="editKickoffDate"
                value={kickoffDate}
                onChange={(e) => setKickoffDate(e.target.value)}
              />
            </div>

            {/* Kickoff Time */}
            <div className="space-y-2">
              <Label>Kickoff Time</Label>
              <div className="flex gap-2">
                <select
                  value={kickoffHour}
                  onChange={(e) => setKickoffHour(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="flex items-center text-muted-foreground">:</span>
                <select
                  value={kickoffMinute}
                  onChange={(e) => setKickoffMinute(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {['00', '15', '30', '45'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  value={kickoffAmPm}
                  onChange={(e) => setKickoffAmPm(e.target.value as 'AM' | 'PM')}
                  className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            {/* Home Team Spread */}
            <div className="space-y-2">
              <Label htmlFor="editSpread">Home Team Spread</Label>
              <Input
                type="number"
                step="0.5"
                id="editSpread"
                value={spread}
                onChange={(e) => setSpread(e.target.value)}
                placeholder="e.g., -7.5 (negative = home favored)"
              />
              <p className="text-xs text-muted-foreground">
                Negative = home favored, Positive = away favored
              </p>
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
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
