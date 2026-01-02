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
  adminCount: number
  isMemberSuperAdmin?: boolean
  isCurrentUserSuperAdmin?: boolean
}

export function OrgMemberActions({
  membershipId,
  orgId,
  role,
  userName,
  isCurrentUser,
  adminCount,
  isMemberSuperAdmin,
  isCurrentUserSuperAdmin,
}: OrgMemberActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handlePromote = async () => {
    if (!confirm(`Are you sure you want to promote ${userName} to admin?`)) {
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('org_memberships')
      .update({ role: 'admin' })
      .eq('id', membershipId)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    router.refresh()
  }

  const handleDemote = async () => {
    if (adminCount <= 1) {
      setError('Cannot demote the last admin')
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
    if (role === 'admin' && adminCount <= 1) {
      setError('Cannot remove the last admin')
      return
    }

    if (!confirm(
      `Are you sure you want to remove ${userName} from this organization?\n\n` +
      `This will remove them from all pools in this organization:\n` +
      `• Bowl Buster pools: Their entries and picks will be deleted\n` +
      `• Squares pools: Their squares will be abandoned or deleted`
    )) {
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      // Get the user_id from the membership
      const { data: membership, error: membershipError } = await supabase
        .from('org_memberships')
        .select('user_id')
        .eq('id', membershipId)
        .single()

      if (membershipError) throw membershipError
      if (!membership) throw new Error('Membership not found')

      const userId = membership.user_id

      // Get all pools in this org with their types
      const { data: pools } = await supabase
        .from('pools')
        .select('id, type')
        .eq('org_id', orgId)

      if (pools && pools.length > 0) {
        // Process each pool based on its type
        for (const pool of pools) {
          if (pool.type === 'bowl_buster') {
            // Bowl Buster: Cascade delete entries -> picks -> membership
            const { data: entries } = await supabase
              .from('bb_entries')
              .select('id')
              .eq('pool_id', pool.id)
              .eq('user_id', userId)

            if (entries && entries.length > 0) {
              const entryIds = entries.map(e => e.id)

              // Delete CFP picks
              await supabase
                .from('bb_cfp_entry_picks')
                .delete()
                .in('entry_id', entryIds)

              // Delete bowl picks
              await supabase
                .from('bb_bowl_picks')
                .delete()
                .in('entry_id', entryIds)

              // Delete entries
              await supabase
                .from('bb_entries')
                .delete()
                .in('id', entryIds)
            }
          } else if (pool.type === 'squares' || pool.type === 'playoff_squares' || pool.type === 'single_game_squares') {
            // Get the sq_pool and check lock status
            const { data: sqPool } = await supabase
              .from('sq_pools')
              .select('id, numbers_locked')
              .eq('pool_id', pool.id)
              .single()

            if (sqPool) {
              if (sqPool.numbers_locked) {
                // Squares (locked): Abandon squares (set user_id = NULL)
                await supabase
                  .from('sq_squares')
                  .update({ user_id: null })
                  .eq('sq_pool_id', sqPool.id)
                  .eq('user_id', userId)
              } else {
                // Squares (unlocked): Delete squares
                await supabase
                  .from('sq_squares')
                  .delete()
                  .eq('sq_pool_id', sqPool.id)
                  .eq('user_id', userId)
              }
            }
          }

          // Delete pool membership
          await supabase
            .from('pool_memberships')
            .delete()
            .eq('pool_id', pool.id)
            .eq('user_id', userId)
        }
      }

      // Finally, remove from org
      const { error: deleteError } = await supabase
        .from('org_memberships')
        .delete()
        .eq('id', membershipId)

      if (deleteError) throw deleteError

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
      setIsLoading(false)
    }
  }

  if (error) {
    return <span className="text-red-600 text-xs">{error}</span>
  }

  // Don't show any actions for current user (can't remove yourself)
  if (isCurrentUser) {
    return <span className="text-xs text-gray-400">-</span>
  }

  // Super admins can only be managed by other super admins
  if (isMemberSuperAdmin && !isCurrentUserSuperAdmin) {
    return <span className="text-xs text-muted-foreground">Protected</span>
  }

  if (role === 'admin') {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleDemote}
          disabled={isLoading || adminCount <= 1}
          className="px-3 py-1 text-xs font-medium text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={adminCount <= 1 ? 'Cannot demote the last admin' : ''}
        >
          {isLoading ? '...' : 'Demote'}
        </button>
        <button
          onClick={handleRemove}
          disabled={isLoading || adminCount <= 1}
          className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={adminCount <= 1 ? 'Cannot remove the last admin' : ''}
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
