'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/types/database'

interface Pool {
  id: string
  name: string
  status: string
  settings: Json | null
  visibility: string
}

interface PoolSettingsProps {
  pool: Pool
  allGamesFinal?: boolean
  finalGamesCount?: number
  totalGamesCount?: number
}

export function PoolSettings({ pool, allGamesFinal, finalGamesCount, totalGamesCount }: PoolSettingsProps) {
  const [isActivating, setIsActivating] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false)
  const [visibility, setVisibility] = useState(pool.visibility)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleVisibilityChange = async (newVisibility: string) => {
    setIsUpdatingVisibility(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ visibility: newVisibility })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsUpdatingVisibility(false)
      return
    }

    setVisibility(newVisibility)
    setIsUpdatingVisibility(false)
    router.refresh()
  }

  const handleActivate = async () => {
    if (!confirm('Are you sure you want to activate this pool? Members will be able to make picks.')) {
      return
    }

    setIsActivating(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'open' })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsActivating(false)
      return
    }

    router.refresh()
  }

  const handleComplete = async () => {
    if (!confirm('Are you sure you want to complete this pool? This will finalize standings and no more picks can be made.')) {
      return
    }

    setIsCompleting(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'completed' })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsCompleting(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Pool Settings</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {pool.status === 'draft' && (
          <button
            onClick={handleActivate}
            disabled={isActivating}
            className="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isActivating ? 'Activating...' : 'Activate Pool'}
          </button>
        )}

        {pool.status === 'open' && (
          <>
            {allGamesFinal ? (
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {isCompleting ? 'Completing...' : 'Complete Pool'}
              </button>
            ) : (
              <div className="text-sm text-gray-600 bg-gray-50 rounded-md p-3">
                <p className="font-medium">Games in progress</p>
                <p className="text-xs mt-1">
                  {finalGamesCount ?? 0} of {totalGamesCount ?? 0} games final
                </p>
              </div>
            )}
          </>
        )}

        {/* Visibility Toggle */}
        <div className="pt-3 border-t border-gray-200">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Pool Visibility
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="invite_only"
                checked={visibility === 'invite_only'}
                onChange={() => handleVisibilityChange('invite_only')}
                disabled={isUpdatingVisibility}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">
                Invite Only
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="visibility"
                value="open_to_org"
                checked={visibility === 'open_to_org'}
                onChange={() => handleVisibilityChange('open_to_org')}
                disabled={isUpdatingVisibility}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">
                Open to Organization
              </span>
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {visibility === 'invite_only'
              ? 'Only users with an invite link can join'
              : 'Any organization member can see and request to join'}
          </p>
        </div>

        <p className="text-xs text-gray-500 pt-2">
          Status: <span className="font-medium">{pool.status}</span>
        </p>
      </div>
    </div>
  )
}
