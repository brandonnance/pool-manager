'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TeamAutocomplete } from './team-autocomplete'

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
    <>
      <button
        onClick={handleOpen}
        className="text-blue-600 hover:text-blue-700"
      >
        Edit
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Edit Game
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Game Name */}
                <div>
                  <label htmlFor="editGameName" className="block text-sm font-medium text-gray-700 mb-1">
                    Bowl Name
                  </label>
                  <input
                    type="text"
                    id="editGameName"
                    value={gameNameInput}
                    onChange={(e) => setGameNameInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                <div>
                  <label htmlFor="editKickoffDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Kickoff Date
                  </label>
                  <input
                    type="date"
                    id="editKickoffDate"
                    value={kickoffDate}
                    onChange={(e) => setKickoffDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Kickoff Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kickoff Time
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={kickoffHour}
                      onChange={(e) => setKickoffHour(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="flex items-center text-gray-500">:</span>
                    <select
                      value={kickoffMinute}
                      onChange={(e) => setKickoffMinute(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {['00', '15', '30', '45'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={kickoffAmPm}
                      onChange={(e) => setKickoffAmPm(e.target.value as 'AM' | 'PM')}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* Home Team Spread */}
                <div>
                  <label htmlFor="editSpread" className="block text-sm font-medium text-gray-700 mb-1">
                    Home Team Spread
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    id="editSpread"
                    value={spread}
                    onChange={(e) => setSpread(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., -7.5 (negative = home favored)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Negative = home favored, Positive = away favored
                  </p>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
