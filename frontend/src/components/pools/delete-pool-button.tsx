'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface DeletePoolButtonProps {
  poolId: string
  poolName: string
  poolType: string
  orgId: string
}

export function DeletePoolButton({ poolId, poolName, poolType, orgId }: DeletePoolButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm')
      return
    }

    setIsDeleting(true)
    setError(null)

    const supabase = createClient()

    try {
      // Verify user is org admin or super admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

      const isSuperAdmin = profile?.is_super_admin ?? false

      // Check if user is org admin
      const { data: orgMembership } = await supabase
        .from('org_memberships')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', user.id)
        .single()

      const isOrgAdmin = orgMembership?.role === 'admin' || isSuperAdmin

      if (!isOrgAdmin) {
        throw new Error('Only org admins can delete pools')
      }

      // Delete based on pool type
      if (poolType === 'playoff_squares') {
        // Get sq_pool id first
        const { data: sqPool } = await supabase
          .from('sq_pools')
          .select('id')
          .eq('pool_id', poolId)
          .single()

        if (sqPool) {
          // Get all game ids for this sq_pool
          const { data: sqGames } = await supabase
            .from('sq_games')
            .select('id')
            .eq('sq_pool_id', sqPool.id)

          const gameIds = sqGames?.map(g => g.id) ?? []

          if (gameIds.length > 0) {
            // Delete score changes
            await supabase
              .from('sq_score_changes')
              .delete()
              .in('sq_game_id', gameIds)

            // Delete winners
            await supabase
              .from('sq_winners')
              .delete()
              .in('sq_game_id', gameIds)
          }

          // Delete games
          await supabase
            .from('sq_games')
            .delete()
            .eq('sq_pool_id', sqPool.id)

          // Delete squares
          await supabase
            .from('sq_squares')
            .delete()
            .eq('sq_pool_id', sqPool.id)

          // Delete sq_pool
          await supabase
            .from('sq_pools')
            .delete()
            .eq('id', sqPool.id)
        }
      } else if (poolType === 'bowl_buster') {
        // Get all entry ids for this pool
        const { data: entries } = await supabase
          .from('bb_entries')
          .select('id')
          .eq('pool_id', poolId)

        const entryIds = entries?.map(e => e.id) ?? []

        if (entryIds.length > 0) {
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
        }

        // Delete entries
        await supabase
          .from('bb_entries')
          .delete()
          .eq('pool_id', poolId)

        // Delete CFP byes
        await supabase
          .from('bb_cfp_pool_byes')
          .delete()
          .eq('pool_id', poolId)

        // Delete CFP round 1
        await supabase
          .from('bb_cfp_pool_round1')
          .delete()
          .eq('pool_id', poolId)

        // Delete pool games
        await supabase
          .from('bb_pool_games')
          .delete()
          .eq('pool_id', poolId)
      } else if (poolType === 'golf') {
        // Get gp_pool id first
        const { data: gpPool } = await supabase
          .from('gp_pools')
          .select('id')
          .eq('pool_id', poolId)
          .single()

        if (gpPool) {
          // Get all entry ids for this pool
          const { data: entries } = await supabase
            .from('gp_entries')
            .select('id')
            .eq('pool_id', poolId)

          const entryIds = entries?.map(e => e.id) ?? []

          if (entryIds.length > 0) {
            // Delete entry picks
            await supabase
              .from('gp_entry_picks')
              .delete()
              .in('entry_id', entryIds)
          }

          // Delete entries
          await supabase
            .from('gp_entries')
            .delete()
            .eq('pool_id', poolId)

          // Delete tier assignments
          await supabase
            .from('gp_tier_assignments')
            .delete()
            .eq('pool_id', gpPool.id)

          // Delete gp_pool
          await supabase
            .from('gp_pools')
            .delete()
            .eq('id', gpPool.id)
        }
      }

      // Common deletions for all pool types
      // Delete join links
      await supabase
        .from('join_links')
        .delete()
        .eq('pool_id', poolId)

      // Delete pool memberships
      await supabase
        .from('pool_memberships')
        .delete()
        .eq('pool_id', poolId)

      // Delete audit log entries (if any)
      await supabase
        .from('audit_log')
        .delete()
        .eq('pool_id', poolId)

      // Finally delete the pool itself
      const { error: poolError } = await supabase
        .from('pools')
        .delete()
        .eq('id', poolId)

      if (poolError) {
        throw poolError
      }

      setIsOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pool')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setConfirmText('')
      setError(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsOpen(true)
          }}
          className="p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
          title="Delete pool (Org Admin only)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-red-600">Delete Pool</DialogTitle>
          <DialogDescription className="text-base">
            You are about to permanently delete <strong>{poolName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              <strong>WARNING: This action cannot be undone!</strong>
              <br /><br />
              Deleting this pool will permanently remove:
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>All pool memberships</li>
                <li>All entries and picks</li>
                {poolType === 'playoff_squares' && (
                  <>
                    <li>All squares and ownership data</li>
                    <li>All games and scores</li>
                    <li>All winners</li>
                  </>
                )}
                {poolType === 'bowl_buster' && (
                  <>
                    <li>All bowl picks</li>
                    <li>All CFP bracket picks</li>
                    <li>All game configurations</li>
                  </>
                )}
                {poolType === 'golf' && (
                  <>
                    <li>All golf entries and picks</li>
                    <li>All tier assignments</li>
                  </>
                )}
                <li>All join links</li>
                <li>All audit history</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label htmlFor="confirm" className="text-sm font-medium">
              Type <strong>DELETE</strong> to confirm:
            </label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || confirmText !== 'DELETE'}
          >
            {isDeleting ? 'Deleting...' : 'Delete Pool Permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
