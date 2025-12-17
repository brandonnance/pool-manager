'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CreateEntryButtonProps {
  poolId: string
}

export function CreateEntryButton({ poolId }: CreateEntryButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCreate = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('bb_entries')
      .insert({
        pool_id: poolId,
        user_id: user.id
      })

    if (insertError) {
      if (insertError.code === '23505') {
        setError('You already have an entry in this pool')
      } else {
        setError(insertError.message)
      }
      setIsLoading(false)
      return
    }

    // Also ensure user has an approved membership in this pool
    await supabase
      .from('pool_memberships')
      .upsert({
        pool_id: poolId,
        user_id: user.id,
        status: 'approved'
      }, {
        onConflict: 'pool_id,user_id'
      })

    router.refresh()
  }

  return (
    <div>
      <button
        onClick={handleCreate}
        disabled={isLoading}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Creating...' : 'Create Entry'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
