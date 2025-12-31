'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface OrgMemberActionsProps {
  membershipId: string
  orgId: string
  role: string
  userName: string
  isCurrentUser: boolean
  commissionerCount: number
}

export function OrgMemberActions({
  membershipId,
  orgId,
  role,
  userName,
  isCurrentUser,
  commissionerCount,
}: OrgMemberActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handlePromote = async () => {
    if (!confirm(`Are you sure you want to promote ${userName} to commissioner?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('org_memberships')
      .update({ role: 'commissioner' })
      .eq('id', membershipId)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    router.refresh()
  }

  const handleDemote = async () => {
    if (commissionerCount <= 1) {
      setError('Cannot demote the last commissioner')
      return
    }

    if (!confirm(`Are you sure you want to demote ${userName} to member?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('org_memberships')
      .update({ role: 'member' })
      .eq('id', membershipId)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    router.refresh()
  }

  const handleRemove = async () => {
    if (role === 'commissioner' && commissionerCount <= 1) {
      setError('Cannot remove the last commissioner')
      return
    }

    if (!confirm(`Are you sure you want to remove ${userName} from this organization? This will also remove them from all pools in this organization.`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // First, get all pools in this org
    const { data: pools } = await supabase
      .from('pools')
      .select('id')
      .eq('org_id', orgId)

    if (pools && pools.length > 0) {
      // Get the user_id from the membership
      const { data: membership, error: membershipError } = await supabase
        .from('org_memberships')
        .select('user_id')
        .eq('id', membershipId)
        .single()

      if (membershipError) {
        setError(membershipError.message)
        setIsLoading(false)
        return
      }

      if (membership) {
        // Remove from all pool memberships in this org
        const poolIds = pools.map(p => p.id)
        const { error: poolMembershipError } = await supabase
          .from('pool_memberships')
          .delete()
          .eq('user_id', membership.user_id)
          .in('pool_id', poolIds)

        if (poolMembershipError) {
          setError(poolMembershipError.message)
          setIsLoading(false)
          return
        }
      }
    }

    // Then remove from org
    const { error: deleteError } = await supabase
      .from('org_memberships')
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

  // Don't show any actions for current user (can't remove yourself)
  if (isCurrentUser) {
    return <span className="text-xs text-gray-400">-</span>
  }

  if (role === 'commissioner') {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleDemote}
          disabled={isLoading || commissionerCount <= 1}
          className="px-3 py-1 text-xs font-medium text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={commissionerCount <= 1 ? 'Cannot demote the last commissioner' : ''}
        >
          {isLoading ? '...' : 'Demote'}
        </button>
        <button
          onClick={handleRemove}
          disabled={isLoading || commissionerCount <= 1}
          className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={commissionerCount <= 1 ? 'Cannot remove the last commissioner' : ''}
        >
          {isLoading ? '...' : 'Remove'}
        </button>
      </div>
    )
  }

  if (role === 'member') {
    return (
      <div className="flex gap-2">
        <button
          onClick={handlePromote}
          disabled={isLoading}
          className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded disabled:opacity-50"
        >
          {isLoading ? '...' : 'Promote'}
        </button>
        <button
          onClick={handleRemove}
          disabled={isLoading}
          className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
        >
          {isLoading ? '...' : 'Remove'}
        </button>
      </div>
    )
  }

  return null
}
