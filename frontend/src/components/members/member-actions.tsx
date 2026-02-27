'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface MemberActionsProps {
  membershipId: string
  poolId: string
  status: string
  userName: string
  currentUserId: string
  memberRole?: string
  isOrgAdmin?: boolean
  memberId: string
  poolType?: string
  isSquaresLocked?: boolean
  isMemberSuperAdmin?: boolean
  isCurrentUserSuperAdmin?: boolean
}

export function MemberActions({
  membershipId,
  poolId,
  status,
  userName,
  currentUserId,
  memberRole,
  isOrgAdmin,
  memberId,
  poolType,
  isSquaresLocked,
  isMemberSuperAdmin,
  isCurrentUserSuperAdmin
}: MemberActionsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isPromoting, setIsPromoting] = useState(false)
  const router = useRouter()

  const handleApprove = async () => {
    setIsLoading(true)

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
      toast.error(updateError.message)
      setIsLoading(false)
      return
    }

    toast.success(`${userName} has been approved`)
    router.refresh()
  }

  const handleReject = async () => {
    if (!confirm(`Are you sure you want to reject ${userName}'s request?`)) {
      return
    }

    setIsLoading(true)

    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('pool_memberships')
      .delete()
      .eq('id', membershipId)

    if (deleteError) {
      toast.error(deleteError.message)
      setIsLoading(false)
      return
    }

    toast.success(`${userName}'s request has been rejected`)
    router.refresh()
  }

  const handleRemove = async () => {
    // Build appropriate confirmation message based on pool type
    let confirmMessage = `Are you sure you want to remove ${userName} from this pool?`

    const isSquaresPool = poolType === 'squares'

    if (poolType === 'bowl_buster') {
      confirmMessage = `Are you sure you want to remove ${userName} from this pool?\n\nThis will permanently delete all their entries and picks.`
    } else if (isSquaresPool) {
      if (isSquaresLocked) {
        confirmMessage = `Are you sure you want to remove ${userName} from this pool?\n\nTheir squares will be marked as "Abandoned" and can be reassigned by a commissioner. Past winners will retain the original owner's name.`
      } else {
        confirmMessage = `Are you sure you want to remove ${userName} from this pool?\n\nThis will delete all their claimed squares, making them available again.`
      }
    }

    if (!confirm(confirmMessage)) {
      return
    }

    setIsLoading(true)

    const supabase = createClient()

    try {
      // Pool-type-specific removal logic
      if (poolType === 'bowl_buster') {
        // Bowl Buster: Cascade delete entries -> picks -> membership
        // 1. Get all entries for this user in this pool
        const { data: entries } = await supabase
          .from('bb_entries')
          .select('id')
          .eq('pool_id', poolId)
          .eq('user_id', memberId)

        if (entries && entries.length > 0) {
          const entryIds = entries.map(e => e.id)

          // 2. Delete CFP picks
          await supabase
            .from('bb_cfp_entry_picks')
            .delete()
            .in('entry_id', entryIds)

          // 3. Delete bowl picks
          await supabase
            .from('bb_bowl_picks')
            .delete()
            .in('entry_id', entryIds)

          // 4. Delete entries
          await supabase
            .from('bb_entries')
            .delete()
            .in('id', entryIds)
        }
      } else if (isSquaresPool) {
        // Get the sq_pool_id
        const { data: sqPool } = await supabase
          .from('sq_pools')
          .select('id')
          .eq('pool_id', poolId)
          .single()

        if (sqPool) {
          if (isSquaresLocked) {
            // Squares (locked): Abandon squares (set user_id = NULL)
            await supabase
              .from('sq_squares')
              .update({ user_id: null })
              .eq('sq_pool_id', sqPool.id)
              .eq('user_id', memberId)
          } else {
            // Squares (unlocked): Delete squares
            await supabase
              .from('sq_squares')
              .delete()
              .eq('sq_pool_id', sqPool.id)
              .eq('user_id', memberId)
          }
        }
      }

      // Finally, delete the pool membership
      const { error: deleteError } = await supabase
        .from('pool_memberships')
        .delete()
        .eq('id', membershipId)

      if (deleteError) {
        toast.error(deleteError.message)
        setIsLoading(false)
        return
      }

      toast.success(`${userName} has been removed`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred')
      setIsLoading(false)
    }
  }

  const handlePromote = async () => {
    if (!confirm(`Promote ${userName} to commissioner? They will be able to manage this pool.`)) {
      return
    }

    setIsPromoting(true)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('pool_memberships')
      .update({ role: 'commissioner' })
      .eq('id', membershipId)

    if (updateError) {
      toast.error(updateError.message)
      setIsPromoting(false)
      return
    }

    toast.success(`${userName} is now a commissioner`)
    router.refresh()
  }

  const handleDemote = async () => {
    if (memberId === currentUserId) {
      if (!confirm(`Are you sure you want to demote yourself? You will lose commissioner access.`)) {
        return
      }
    } else if (!confirm(`Demote ${userName} to member? They will lose commissioner access.`)) {
      return
    }

    setIsPromoting(true)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('pool_memberships')
      .update({ role: 'member' })
      .eq('id', membershipId)

    if (updateError) {
      toast.error(updateError.message)
      setIsPromoting(false)
      return
    }

    toast.success(`${userName} is now a member`)
    router.refresh()
  }

  if (status === 'pending') {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleApprove}
          disabled={isLoading}
          size="sm"
          className="h-8 bg-green-600 hover:bg-green-700"
        >
          {isLoading ? '...' : 'Approve'}
        </Button>
        <Button
          onClick={handleReject}
          disabled={isLoading}
          size="sm"
          variant="destructive"
          className="h-8"
        >
          {isLoading ? '...' : 'Reject'}
        </Button>
      </div>
    )
  }

  if (status === 'approved') {
    const isCommissioner = memberRole === 'commissioner'

    // Super admins can only be managed by other super admins
    const canManageMember = !isMemberSuperAdmin || isCurrentUserSuperAdmin

    if (!canManageMember) {
      return <span className="text-xs text-muted-foreground">Protected</span>
    }

    return (
      <div className="flex flex-wrap gap-2">
        {/* Only org admins can promote/demote commissioners */}
        {isOrgAdmin && (
          isCommissioner ? (
            <Button
              onClick={handleDemote}
              disabled={isPromoting}
              size="sm"
              variant="outline"
              className="h-8 text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              {isPromoting ? '...' : 'Demote'}
            </Button>
          ) : (
            <Button
              onClick={handlePromote}
              disabled={isPromoting}
              size="sm"
              variant="outline"
              className="h-8"
            >
              {isPromoting ? '...' : 'Promote'}
            </Button>
          )
        )}
        <Button
          onClick={handleRemove}
          disabled={isLoading}
          size="sm"
          variant="ghost"
          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {isLoading ? '...' : 'Remove'}
        </Button>
      </div>
    )
  }

  return null
}
