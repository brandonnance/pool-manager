'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface JoinPoolActionProps {
  token: string
  poolId: string
}

interface JoinResult {
  success: boolean
  error?: string
  pool_id?: string
  pool_name?: string
  membership_id?: string
}

export function JoinPoolAction({ token, poolId }: JoinPoolActionProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleJoin = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // Call the RPC to join the pool
    const { data, error: rpcError } = await supabase.rpc('request_join_pool', { p_token: token })

    if (rpcError) {
      setError(rpcError.message)
      setIsLoading(false)
      return
    }

    const result = data as unknown as JoinResult

    if (!result.success) {
      setError(result.error || 'Failed to join pool')
      setIsLoading(false)
      return
    }

    setSuccess(true)

    // Redirect to the pool page after a short delay
    setTimeout(() => {
      router.push(`/pools/${poolId}`)
    }, 2000)
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 text-green-700 rounded-md">
          <p className="font-medium">Request submitted!</p>
          <p className="text-sm mt-1">Your request to join is pending approval by a commissioner.</p>
        </div>
        <p className="text-sm text-gray-500">Redirecting to the pool...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleJoin}
        disabled={isLoading}
        className="w-full px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
      >
        {isLoading ? 'Joining...' : 'Request to Join'}
      </button>

      <p className="text-xs text-gray-500">
        After joining, a commissioner will need to approve your request.
      </p>
    </div>
  )
}
