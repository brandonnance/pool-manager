'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TeamAutocomplete } from '../games/team-autocomplete'

interface Team {
  id: string
  name: string
  abbrev: string | null
  logo_url?: string | null
  color?: string | null
}

interface Game {
  id: string
  game_name: string | null
  kickoff_at: string | null
  home_spread: number | null
  status: string
}

interface Round1Matchup {
  id: string
  slot_key: string
  team_a_id: string | null
  team_b_id: string | null
  game_id: string | null
  team_a: Team | null
  team_b: Team | null
  game: Game | null
}

interface CfpRound1FormProps {
  poolId: string
  matchup: Round1Matchup
  teams: Team[]
  slotLabel: string
  onSave: () => void
}

export function CfpRound1Form({ poolId, matchup, teams, slotLabel, onSave }: CfpRound1FormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Form state
  const [higherSeedId, setHigherSeedId] = useState(matchup.team_a_id ?? '')
  const [lowerSeedId, setLowerSeedId] = useState(matchup.team_b_id ?? '')
  const [gameName, setGameName] = useState(matchup.game?.game_name ?? '')
  const [homeSpread, setHomeSpread] = useState(matchup.game?.home_spread?.toString() ?? '')

  // Parse kickoff time
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

  const parsed = parseKickoff(matchup.game?.kickoff_at)
  const [kickoffDate, setKickoffDate] = useState(parsed.date)
  const [kickoffHour, setKickoffHour] = useState(parsed.hour)
  const [kickoffMinute, setKickoffMinute] = useState(parsed.minute)
  const [kickoffAmPm, setKickoffAmPm] = useState<'AM' | 'PM'>(parsed.ampm)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!higherSeedId || !lowerSeedId) {
      setError('Please select both teams')
      setIsLoading(false)
      return
    }

    if (higherSeedId === lowerSeedId) {
      setError('Teams must be different')
      setIsLoading(false)
      return
    }

    // Validate spread
    if (homeSpread) {
      const spreadNum = parseFloat(homeSpread)
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

    // Check if teams changed - if so, delete ALL CFP picks for the pool
    const teamsChanged =
      higherSeedId !== matchup.team_a_id ||
      lowerSeedId !== matchup.team_b_id

    if (teamsChanged && matchup.game_id) {
      // Only prompt if there's an existing game (meaning picks might exist)
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
    }

    // Create or update the game
    let gameId = matchup.game_id

    if (gameId) {
      // Update existing game
      const { error: gameError } = await supabase
        .from('bb_games')
        .update({
          game_name: gameName.trim() || null,
          home_team_id: higherSeedId, // Higher seed is typically "home"
          away_team_id: lowerSeedId,
          kickoff_at: kickoffIso,
          home_spread: homeSpread ? parseFloat(homeSpread) : null
        })
        .eq('id', gameId)

      if (gameError) {
        setError(gameError.message)
        setIsLoading(false)
        return
      }
    } else {
      // Create new game
      const { data: game, error: gameError } = await supabase
        .from('bb_games')
        .insert({
          game_name: gameName.trim() || null,
          home_team_id: higherSeedId,
          away_team_id: lowerSeedId,
          kickoff_at: kickoffIso,
          home_spread: homeSpread ? parseFloat(homeSpread) : null,
          status: 'scheduled',
          external_game_id: `cfp_${matchup.slot_key}_${Date.now()}`,
          external_source: 'manual'
        })
        .select()
        .single()

      if (gameError) {
        setError(gameError.message)
        setIsLoading(false)
        return
      }

      gameId = game.id

      // Also add to bb_pool_games as a CFP game
      const { error: poolGameError } = await supabase
        .from('bb_pool_games')
        .insert({
          pool_id: poolId,
          game_id: gameId,
          kind: 'cfp',
          label: gameName.trim() || `CFP ${matchup.slot_key}`
        })

      if (poolGameError) {
        setError(poolGameError.message)
        setIsLoading(false)
        return
      }
    }

    // Update the Round 1 matchup record
    const { error: matchupError } = await supabase
      .from('bb_cfp_pool_round1')
      .update({
        team_a_id: higherSeedId,
        team_b_id: lowerSeedId,
        game_id: gameId
      })
      .eq('id', matchup.id)

    if (matchupError) {
      setError(matchupError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    router.refresh()
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Lower Seed Team (Away) */}
        <TeamAutocomplete
          teams={teams}
          selectedTeamId={lowerSeedId}
          onSelect={setLowerSeedId}
          label="Lower Seed (Away)"
          id={`${matchup.slot_key}-lower-seed`}
          placeholder="Search for team..."
        />

        {/* Higher Seed Team (Home) */}
        <TeamAutocomplete
          teams={teams}
          selectedTeamId={higherSeedId}
          onSelect={setHigherSeedId}
          label="Higher Seed (Home)"
          id={`${matchup.slot_key}-higher-seed`}
          placeholder="Search for team..."
        />
      </div>

      {/* Game Name */}
      <div>
        <label htmlFor={`${matchup.slot_key}-game-name`} className="block text-sm font-medium text-gray-700 mb-1">
          Game Name (optional)
        </label>
        <input
          type="text"
          id={`${matchup.slot_key}-game-name`}
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Fiesta Bowl (CFP First Round)"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Kickoff Date */}
        <div>
          <label htmlFor={`${matchup.slot_key}-date`} className="block text-sm font-medium text-gray-700 mb-1">
            Kickoff Date
          </label>
          <input
            type="date"
            id={`${matchup.slot_key}-date`}
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
      </div>

      {/* Spread */}
      <div>
        <label htmlFor={`${matchup.slot_key}-spread`} className="block text-sm font-medium text-gray-700 mb-1">
          Higher Seed Spread
        </label>
        <input
          type="number"
          step="0.5"
          id={`${matchup.slot_key}-spread`}
          value={homeSpread}
          onChange={(e) => setHomeSpread(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., -7.5 (negative = higher seed favored)"
        />
        <p className="mt-1 text-xs text-gray-500">
          Negative = higher seed favored, Positive = lower seed favored
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save Matchup'}
        </button>
      </div>
    </form>
  )
}
