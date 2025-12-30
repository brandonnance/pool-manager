'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  status: string | null
  home_score: number | null
  away_score: number | null
  home_spread: number | null
  home_team: Team | null
  away_team: Team | null
}

interface PoolGame {
  id: string
  kind: string | null
  label: string | null
  game_id: string | null
  bb_games: Game | null
}

interface BowlPicksFormProps {
  poolId: string
  entryId: string
  poolGames: PoolGame[]
  picksMap: Record<string, string | null>
  demoMode?: boolean
}

export function BowlPicksForm({ poolId, entryId, poolGames, picksMap, demoMode }: BowlPicksFormProps) {
  const [picks, setPicks] = useState<Record<string, string | null>>(picksMap)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isGameLocked = (kickoffAt: string | null): boolean => {
    if (demoMode) return false // Demo mode bypasses locking
    if (!kickoffAt) return false
    const lockTime = new Date(kickoffAt)
    lockTime.setMinutes(lockTime.getMinutes() - 5) // Lock 5 minutes before kickoff
    return new Date() >= lockTime
  }

  const handlePick = async (poolGameId: string, teamId: string) => {
    const game = poolGames.find(pg => pg.id === poolGameId)?.bb_games
    if (game && isGameLocked(game.kickoff_at)) {
      setError('This game is locked. Picks lock 5 minutes before kickoff.')
      return
    }

    setSaving(poolGameId)
    setError(null)

    const supabase = createClient()
    const existingPickId = picks[poolGameId]

    if (existingPickId === teamId) {
      // Already picked this team, do nothing
      setSaving(null)
      return
    }

    // Check if there's an existing pick to update
    const { data: existingPick } = await supabase
      .from('bb_bowl_picks')
      .select('id')
      .eq('entry_id', entryId)
      .eq('pool_game_id', poolGameId)
      .single()

    if (existingPick) {
      // Update existing pick
      const { error: updateError } = await supabase
        .from('bb_bowl_picks')
        .update({ picked_team_id: teamId, updated_at: new Date().toISOString() })
        .eq('id', existingPick.id)

      if (updateError) {
        setError(updateError.message)
        setSaving(null)
        return
      }
    } else {
      // Insert new pick
      const { error: insertError } = await supabase
        .from('bb_bowl_picks')
        .insert({
          entry_id: entryId,
          pool_game_id: poolGameId,
          picked_team_id: teamId
        })

      if (insertError) {
        setError(insertError.message)
        setSaving(null)
        return
      }
    }

    // Update local state
    setPicks(prev => ({ ...prev, [poolGameId]: teamId }))
    setSaving(null)
    router.refresh()
  }

  const formatSpread = (homeSpread: number | null, isHome: boolean): string => {
    if (homeSpread === null) return ''
    const spread = isHome ? homeSpread : -homeSpread
    if (spread === 0) return '(EVEN)'
    return spread > 0 ? `(+${spread})` : `(${spread})`
  }

  const getPickedCount = () => {
    return Object.values(picks).filter(p => p !== null).length
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Picks made: {getPickedCount()} / {poolGames.length}
          </span>
          <span className={`text-sm font-medium ${getPickedCount() === poolGames.length ? 'text-green-600' : 'text-yellow-600'}`}>
            {getPickedCount() === poolGames.length ? 'All picks complete!' : `${poolGames.length - getPickedCount()} remaining`}
          </span>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(getPickedCount() / poolGames.length) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Games List */}
      <div className="space-y-4">
        {poolGames.map(pg => {
          const game = pg.bb_games
          if (!game) return null

          const isLocked = !demoMode && (isGameLocked(game.kickoff_at) || game.status === 'final' || game.status === 'in_progress')
          const currentPick = picks[pg.id]
          const isSaving = saving === pg.id

          return (
            <div
              key={pg.id}
              className={`bg-white rounded-lg shadow p-4 ${isLocked ? 'opacity-75' : ''}`}
            >
              {/* Game Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {game.game_name || pg.label || 'Bowl Game'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {game.kickoff_at
                      ? new Date(game.kickoff_at).toLocaleString()
                      : 'TBD'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isLocked && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Locked
                    </span>
                  )}
                  {game.status === 'final' && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      Final: {game.away_score} - {game.home_score}
                    </span>
                  )}
                  {game.status === 'in_progress' && (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                      In Progress
                    </span>
                  )}
                </div>
              </div>

              {/* Team Selection */}
              <div className="grid grid-cols-2 gap-3">
                {/* Away Team */}
                <button
                  onClick={() => game.away_team && handlePick(pg.id, game.away_team.id)}
                  disabled={isLocked || isSaving || !game.away_team}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    currentPick === game.away_team?.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${
                    isSaving ? 'opacity-50' : ''
                  }`}
                >
                  {currentPick === game.away_team?.id && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="text-center">
                    {game.away_team?.logo_url && (
                      <img
                        src={game.away_team.logo_url}
                        alt={game.away_team.name}
                        className="w-12 h-12 mx-auto mb-2 object-contain"
                      />
                    )}
                    <p className="font-medium text-gray-900">
                      {game.away_team?.name || 'TBD'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatSpread(game.home_spread, false)}
                    </p>
                  </div>
                </button>

                {/* Home Team */}
                <button
                  onClick={() => game.home_team && handlePick(pg.id, game.home_team.id)}
                  disabled={isLocked || isSaving || !game.home_team}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    currentPick === game.home_team?.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${
                    isSaving ? 'opacity-50' : ''
                  }`}
                >
                  {currentPick === game.home_team?.id && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="text-center">
                    {game.home_team?.logo_url && (
                      <img
                        src={game.home_team.logo_url}
                        alt={game.home_team.name}
                        className="w-12 h-12 mx-auto mb-2 object-contain"
                      />
                    )}
                    <p className="font-medium text-gray-900">
                      {game.home_team?.name || 'TBD'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatSpread(game.home_spread, true)}
                    </p>
                  </div>
                </button>
              </div>

              {/* No pick warning for unlocked games */}
              {!isLocked && !currentPick && (
                <p className="mt-2 text-xs text-yellow-600 text-center">
                  No pick made yet
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
