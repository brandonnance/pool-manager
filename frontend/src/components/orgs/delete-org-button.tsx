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

interface DeleteOrgButtonProps {
  orgId: string
  orgName: string
}

export function DeleteOrgButton({ orgId, orgName }: DeleteOrgButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async () => {
    if (confirmText !== orgName) {
      setError(`Please type "${orgName}" to confirm`)
      return
    }

    setIsDeleting(true)
    setError(null)

    const supabase = createClient()

    try {
      // Verify user is super admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_super_admin) {
        throw new Error('Only super admins can delete organizations')
      }

      // Get all pools in this org
      const { data: pools } = await supabase
        .from('pools')
        .select('id, type')
        .eq('org_id', orgId)

      // Delete each pool's data
      for (const pool of pools ?? []) {
        if (pool.type === 'squares') {
          // Get sq_pool id first
          const { data: sqPool } = await supabase
            .from('sq_pools')
            .select('id')
            .eq('pool_id', pool.id)
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
        } else if (pool.type === 'bowl_buster') {
          // Get all entry ids for this pool
          const { data: entries } = await supabase
            .from('bb_entries')
            .select('id')
            .eq('pool_id', pool.id)

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
            .eq('pool_id', pool.id)

          // Delete CFP byes
          await supabase
            .from('bb_cfp_pool_byes')
            .delete()
            .eq('pool_id', pool.id)

          // Delete CFP slot games
          await supabase
            .from('bb_cfp_pool_slot_games')
            .delete()
            .eq('pool_id', pool.id)

          // Delete CFP round 1
          await supabase
            .from('bb_cfp_pool_round1')
            .delete()
            .eq('pool_id', pool.id)

          // Delete CFP config
          await supabase
            .from('bb_cfp_pool_config')
            .delete()
            .eq('pool_id', pool.id)

          // Delete pool games
          await supabase
            .from('bb_pool_games')
            .delete()
            .eq('pool_id', pool.id)
        }

        // Common deletions for all pool types
        // Delete pool memberships
        await supabase
          .from('pool_memberships')
          .delete()
          .eq('pool_id', pool.id)

        // Delete join links
        await supabase
          .from('join_links')
          .delete()
          .eq('pool_id', pool.id)

        // Delete audit log entries for this pool
        await supabase
          .from('audit_log')
          .delete()
          .eq('pool_id', pool.id)
      }

      // Delete all pools in the org
      await supabase
        .from('pools')
        .delete()
        .eq('org_id', orgId)

      // Delete org memberships
      await supabase
        .from('org_memberships')
        .delete()
        .eq('org_id', orgId)

      // Delete audit log entries for this org
      await supabase
        .from('audit_log')
        .delete()
        .eq('org_id', orgId)

      // Finally delete the org itself
      const { error: orgError } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId)

      if (orgError) {
        throw orgError
      }

      setIsOpen(false)
      router.push('/orgs')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization')
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
        <Button variant="destructive" size="sm" className="w-full sm:w-auto">
          Delete Organization
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">Delete Organization</DialogTitle>
          <DialogDescription className="text-base">
            You are about to permanently delete <strong>{orgName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              <strong>WARNING: This action cannot be undone!</strong>
              <br /><br />
              Deleting this organization will permanently remove:
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>All pools in this organization</li>
                <li>All pool memberships and entries</li>
                <li>All picks, scores, and game data</li>
                <li>All squares and payouts</li>
                <li>All join links and audit history</li>
                <li>All org memberships</li>
              </ul>
              <br />
              <strong>Users will NOT be deleted</strong>, but they will lose access
              to this organization and all its pools.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label htmlFor="confirm" className="text-sm font-medium">
              Type <strong>{orgName}</strong> to confirm:
            </label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={orgName}
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
            disabled={isDeleting || confirmText !== orgName}
          >
            {isDeleting ? 'Deleting...' : 'Delete Organization Permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
