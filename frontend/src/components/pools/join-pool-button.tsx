'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface JoinPoolButtonProps {
  poolId: string
}

export function JoinPoolButton({ poolId }: JoinPoolButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleJoin = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    // Request to join the pool (status = pending)
    const { error: joinError } = await supabase
      .from('pool_memberships')
      .insert({
        pool_id: poolId,
        user_id: user.id,
        status: 'pending'
      })

    if (joinError) {
      if (joinError.code === '23505') {
        setError('You have already requested to join this pool')
      } else {
        setError(joinError.message)
      }
      setIsLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <div>
      <button
        onClick={handleJoin}
        disabled={isLoading}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Joining...' : 'Request to Join'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
