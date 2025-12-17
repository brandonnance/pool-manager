'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Game {
  id: string
  game_name: string | null
  kickoff_at: string | null
  status: string
}

interface SlotGame {
  id: string
  slot_key: string
  game_id: string | null
  game: Game | null
}

interface CfpLaterRoundFormProps {
  poolId: string
  slotGame: SlotGame | null
  slotKey: string
  slotLabel: string
  onSave: () => void
}

export function CfpLaterRoundForm({ poolId, slotGame, slotKey, slotLabel, onSave }: CfpLaterRoundFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Form state
  const [gameName, setGameName] = useState(slotGame?.game?.game_name ?? '')

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

  const parsed = parseKickoff(slotGame?.game?.kickoff_at)
  const [kickoffDate, setKickoffDate] = useState(parsed.date)
  const [kickoffHour, setKickoffHour] = useState(parsed.hour)
  const [kickoffMinute, setKickoffMinute] = useState(parsed.minute)
  const [kickoffAmPm, setKickoffAmPm] = useState<'AM' | 'PM'>(parsed.ampm)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

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

    // Create or update the game
    let gameId = slotGame?.game_id

    if (gameId) {
      // Update existing game
      const { error: gameError } = await supabase
        .from('bb_games')
        .update({
          game_name: gameName.trim() || null,
          kickoff_at: kickoffIso,
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
          game_name: gameName.trim() || `CFP ${slotKey}`,
          kickoff_at: kickoffIso,
          status: 'scheduled',
          external_game_id: `cfp_${slotKey}_${Date.now()}`,
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
          label: gameName.trim() || `CFP ${slotKey}`
        })

      if (poolGameError) {
        setError(poolGameError.message)
        setIsLoading(false)
        return
      }

      // Create or update slot game record
      if (slotGame) {
        const { error: slotError } = await supabase
          .from('bb_cfp_pool_slot_games')
          .update({ game_id: gameId })
          .eq('id', slotGame.id)

        if (slotError) {
          setError(slotError.message)
          setIsLoading(false)
          return
        }
      } else {
        const { error: slotError } = await supabase
          .from('bb_cfp_pool_slot_games')
          .insert({
            pool_id: poolId,
            slot_key: slotKey,
            game_id: gameId
          })

        if (slotError) {
          setError(slotError.message)
          setIsLoading(false)
          return
        }
      }
    }

    setIsLoading(false)
    router.refresh()
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Game Name */}
      <div>
        <label htmlFor={`${slotKey}-game-name`} className="block text-sm font-medium text-gray-700 mb-1">
          Game Name
        </label>
        <input
          type="text"
          id={`${slotKey}-game-name`}
          value={gameName}
          onChange={(e) => setGameName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder={slotLabel}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Kickoff Date */}
        <div>
          <label htmlFor={`${slotKey}-date`} className="block text-sm font-medium text-gray-700 mb-1">
            Kickoff Date
          </label>
          <input
            type="date"
            id={`${slotKey}-date`}
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
          {isLoading ? 'Saving...' : 'Save Game'}
        </button>
      </div>
    </form>
  )
}
