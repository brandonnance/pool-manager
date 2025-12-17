'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

  // Quick action to mark as final with current scores
  const handleMarkFinal = async () => {
    if (homeScore === '' || awayScore === '') {
      setError('Please enter both scores first')
      return
    }
    setStatus('final')
    // Submit will be triggered by form
  }

  const isFinal = currentStatus === 'final'

  return (
    <>
      <button
        onClick={handleOpen}
        className={`${
          isFinal
            ? 'text-gray-500 hover:text-gray-700'
            : 'text-green-600 hover:text-green-700'
        }`}
      >
        {isFinal ? 'Edit Score' : 'Score'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Enter Score
            </h2>
            <p className="text-gray-600 text-sm mb-4">{gameName}</p>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Score Entry */}
                <div className="grid grid-cols-3 gap-4 items-center">
                  {/* Away Team */}
                  <div className="text-center">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {awayTeamName}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={awayScore}
                      onChange={(e) => setAwayScore(e.target.value)}
                      className="w-full px-3 py-3 text-2xl font-bold text-center border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>

                  {/* VS */}
                  <div className="text-center text-gray-400 text-lg font-medium pt-6">
                    @
                  </div>

                  {/* Home Team */}
                  <div className="text-center">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {homeTeamName}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={homeScore}
                      onChange={(e) => setHomeScore(e.target.value)}
                      className="w-full px-3 py-3 text-2xl font-bold text-center border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Game Status
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus('scheduled')}
                      className={`px-3 py-2 text-sm font-medium rounded-md border ${
                        status === 'scheduled'
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Scheduled
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('in_progress')}
                      className={`px-3 py-2 text-sm font-medium rounded-md border ${
                        status === 'in_progress'
                          ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      In Progress
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('final')}
                      className={`px-3 py-2 text-sm font-medium rounded-md border ${
                        status === 'final'
                          ? 'bg-green-50 border-green-500 text-green-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Final
                    </button>
                  </div>
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
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Score'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
