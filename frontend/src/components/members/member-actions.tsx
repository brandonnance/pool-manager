'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface MemberActionsProps {
  membershipId: string
  poolId: string
  status: string
  userName: string
  currentUserId: string
}

export function MemberActions({ membershipId, poolId, status, userName, currentUserId }: MemberActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleApprove = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('pool_memberships')
      .update({
        status: 'approved',
        approved_by: currentUserId,
        approved_at: new Date().toISOString()
      })
      .eq('id', membershipId)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    router.refresh()
  }

  const handleReject = async () => {
    if (!confirm(`Are you sure you want to reject ${userName}'s request?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('pool_memberships')
      .delete()
      .eq('id', membershipId)

    if (deleteError) {
      setError(deleteError.message)
      setIsLoading(false)
      return
    }

    router.refresh()
  }

  const handleRemove = async () => {
    if (!confirm(`Are you sure you want to remove ${userName} from this pool?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('pool_memberships')
      .delete()
      .eq('id', membershipId)

    if (deleteError) {
      setError(deleteError.message)
      setIsLoading(false)
      return
    }

    router.refresh()
  }

  if (error) {
    return <span className="text-red-600 text-xs">{error}</span>
  }

  if (status === 'pending') {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isLoading}
          className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
        >
          {isLoading ? '...' : 'Approve'}
        </button>
        <button
          onClick={handleReject}
          disabled={isLoading}
          className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
        >
          {isLoading ? '...' : 'Reject'}
        </button>
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <button
        onClick={handleRemove}
        disabled={isLoading}
        className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
      >
        {isLoading ? '...' : 'Remove'}
      </button>
    )
  }

  return null
}
