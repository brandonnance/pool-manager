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
}

interface PoolSettingsProps {
  pool: Pool
}

export function PoolSettings({ pool }: PoolSettingsProps) {
  const [isActivating, setIsActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleActivate = async () => {
    if (!confirm('Are you sure you want to activate this pool? Members will be able to make picks.')) {
      return
    }

    setIsActivating(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'active' })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsActivating(false)
      return
    }

    router.refresh()
  }

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this pool? It will be hidden from the main view.')) {
      return
    }

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'archived' })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
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

        {pool.status === 'active' && (
          <button
            onClick={handleArchive}
            className="w-full px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50"
          >
            Archive Pool
          </button>
        )}

        <p className="text-xs text-gray-500">
          Status: <span className="font-medium">{pool.status}</span>
        </p>
      </div>
    </div>
  )
}
