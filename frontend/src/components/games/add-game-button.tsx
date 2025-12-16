'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Team {
  id: string
  name: string
  abbrev: string | null
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
  const [kickoffAt, setKickoffAt] = useState('')
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

    const supabase = createClient()

    // Create the game in bb_games
    const { data: game, error: gameError } = await supabase
      .from('bb_games')
      .insert({
        game_name: gameName.trim() || null,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff_at: kickoffAt ? new Date(kickoffAt).toISOString() : null,
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
    setKickoffAt('')
    setError(null)
    setIsLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Add Game
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Add Bowl Game
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Game Name */}
                <div>
                  <label htmlFor="gameName" className="block text-sm font-medium text-gray-700 mb-1">
                    Bowl Name
                  </label>
                  <input
                    type="text"
                    id="gameName"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Rose Bowl"
                  />
                </div>

                {/* Away Team */}
                <div>
                  <label htmlFor="awayTeam" className="block text-sm font-medium text-gray-700 mb-1">
                    Away Team
                  </label>
                  <select
                    id="awayTeam"
                    value={awayTeamId}
                    onChange={(e) => setAwayTeamId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select team...</option>
                    {localTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} {team.abbrev ? `(${team.abbrev})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Home Team */}
                <div>
                  <label htmlFor="homeTeam" className="block text-sm font-medium text-gray-700 mb-1">
                    Home Team
                  </label>
                  <select
                    id="homeTeam"
                    value={homeTeamId}
                    onChange={(e) => setHomeTeamId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select team...</option>
                    {localTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} {team.abbrev ? `(${team.abbrev})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Add New Team Toggle */}
                {!showNewTeamForm ? (
                  <button
                    type="button"
                    onClick={() => setShowNewTeamForm(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add a new team
                  </button>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-md space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">New Team</span>
                      <button
                        type="button"
                        onClick={() => setShowNewTeamForm(false)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="Team name"
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={newTeamAbbrev}
                        onChange={(e) => setNewTeamAbbrev(e.target.value)}
                        placeholder="Abbrev (e.g., OSU)"
                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTeam}
                      disabled={isLoading || !newTeamName.trim()}
                      className="w-full px-3 py-2 text-sm border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50"
                    >
                      Add Team
                    </button>
                  </div>
                )}

                {/* Kickoff Time */}
                <div>
                  <label htmlFor="kickoff" className="block text-sm font-medium text-gray-700 mb-1">
                    Kickoff Date/Time
                  </label>
                  <input
                    type="datetime-local"
                    id="kickoff"
                    value={kickoffAt}
                    onChange={(e) => setKickoffAt(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
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
                  onClick={() => {
                    setIsOpen(false)
                    resetForm()
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Adding...' : 'Add Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
