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

interface AddGameButtonProps {
  poolId: string
  teams: Team[]
}

export function AddGameButton({ poolId, teams }: AddGameButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Form state
  const [gameName, setGameName] = useState('')
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [kickoffDate, setKickoffDate] = useState('')
  const [kickoffHour, setKickoffHour] = useState('12')
  const [kickoffMinute, setKickoffMinute] = useState('00')
  const [kickoffAmPm, setKickoffAmPm] = useState<'AM' | 'PM'>('PM')
  const [homeSpread, setHomeSpread] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamAbbrev, setNewTeamAbbrev] = useState('')
  const [showNewTeamForm, setShowNewTeamForm] = useState(false)
  const [localTeams, setLocalTeams] = useState<Team[]>(teams)

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return

    setIsLoading(true)
    const supabase = createClient()

    const { data: team, error: teamError } = await supabase
      .from('bb_teams')
      .insert({
        name: newTeamName.trim(),
        abbrev: newTeamAbbrev.trim() || null
      })
      .select()
      .single()

    if (teamError) {
      setError(teamError.message)
      setIsLoading(false)
      return
    }

    setLocalTeams([...localTeams, team].sort((a, b) => a.name.localeCompare(b.name)))
    setNewTeamName('')
    setNewTeamAbbrev('')
    setShowNewTeamForm(false)
    setIsLoading(false)
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
    if (homeSpread) {
      const spreadNum = parseFloat(homeSpread)
      const decimal = Math.abs(spreadNum % 1)
      if (decimal !== 0 && decimal !== 0.5) {
        setError('Spread must be a whole number or end in .5')
        setIsLoading(false)
        return
      }
    }

    const supabase = createClient()

    // Build kickoff datetime from separate fields
    let kickoffIso: string | null = null
    if (kickoffDate) {
      let hour24 = parseInt(kickoffHour, 10)
      if (kickoffAmPm === 'PM' && hour24 !== 12) hour24 += 12
      if (kickoffAmPm === 'AM' && hour24 === 12) hour24 = 0
      const kickoffDateTime = new Date(`${kickoffDate}T${hour24.toString().padStart(2, '0')}:${kickoffMinute}:00`)
      kickoffIso = kickoffDateTime.toISOString()
    }

    // Create the game in bb_games
    const { data: game, error: gameError } = await supabase
      .from('bb_games')
      .insert({
        game_name: gameName.trim() || null,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_at: kickoffIso,
        home_spread: homeSpread ? parseFloat(homeSpread) : null,
        status: 'scheduled',
        external_game_id: `manual_${Date.now()}`,
        external_source: 'manual'
      })
      .select()
      .single()

    if (gameError) {
      setError(gameError.message)
      setIsLoading(false)
      return
    }

    // Add the game to the pool
    const { error: poolGameError } = await supabase
      .from('bb_pool_games')
      .insert({
        pool_id: poolId,
        game_id: game.id,
        kind: 'bowl',
        label: gameName.trim() || null
      })

    if (poolGameError) {
      setError(poolGameError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setIsOpen(false)
    resetForm()
    router.refresh()
  }

  const resetForm = () => {
    setGameName('')
    setHomeTeamId('')
    setAwayTeamId('')
    setKickoffDate('')
    setKickoffHour('12')
    setKickoffMinute('00')
    setKickoffAmPm('PM')
    setHomeSpread('')
    setError(null)
    setIsLoading(false)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      resetForm()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Add Game</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Bowl Game</DialogTitle>
          <DialogDescription>
            Add a new bowl game to this pool.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Game Name */}
            <div className="space-y-2">
              <Label htmlFor="gameName">Bowl Name</Label>
              <Input
                id="gameName"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="e.g., Rose Bowl"
              />
            </div>

            {/* Away Team */}
            <TeamAutocomplete
              teams={localTeams}
              selectedTeamId={awayTeamId}
              onSelect={setAwayTeamId}
              label="Away Team"
              id="awayTeam"
              placeholder="Search for away team..."
            />

            {/* Home Team */}
            <TeamAutocomplete
              teams={localTeams}
              selectedTeamId={homeTeamId}
              onSelect={setHomeTeamId}
              label="Home Team"
              id="homeTeam"
              placeholder="Search for home team..."
            />

            {/* Add New Team Toggle */}
            {!showNewTeamForm ? (
              <button
                type="button"
                onClick={() => setShowNewTeamForm(true)}
                className="text-sm text-primary hover:text-primary/80"
              >
                + Add a new team
              </button>
            ) : (
              <div className="bg-muted p-4 rounded-md space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">New Team</span>
                  <button
                    type="button"
                    onClick={() => setShowNewTeamForm(false)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Team name"
                  />
                  <Input
                    value={newTeamAbbrev}
                    onChange={(e) => setNewTeamAbbrev(e.target.value)}
                    placeholder="Abbrev (e.g., OSU)"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleAddTeam}
                  disabled={isLoading || !newTeamName.trim()}
                >
                  Add Team
                </Button>
              </div>
            )}

            {/* Kickoff Date */}
            <div className="space-y-2">
              <Label htmlFor="kickoffDate">Kickoff Date</Label>
              <Input
                type="date"
                id="kickoffDate"
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
              <Label htmlFor="homeSpread">Home Team Spread</Label>
              <Input
                type="number"
                step="0.5"
                id="homeSpread"
                value={homeSpread}
                onChange={(e) => setHomeSpread(e.target.value)}
                placeholder="e.g., -7.5 (negative = home favored)"
              />
              <p className="text-xs text-muted-foreground">
                Negative = home team favored, Positive = away team favored
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
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Game'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
