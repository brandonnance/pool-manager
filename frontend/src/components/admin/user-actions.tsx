'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface UserActionsProps {
  userId: string
  userName: string
  isDeactivated: boolean
  isSuperAdmin: boolean
  isCurrentUser: boolean
}

export function UserActions({
  userId,
  userName,
  isDeactivated,
  isSuperAdmin,
  isCurrentUser,
}: UserActionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Don't show actions for current user or other super admins
  if (isCurrentUser || isSuperAdmin) {
    return (
      <span className="text-sm text-muted-foreground">
        {isCurrentUser ? 'You' : 'Protected'}
      </span>
    )
  }

  const handleAction = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      // Verify current user is super admin
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
        throw new Error('Only super admins can manage users')
      }

      // Update the user's deactivated_at status
      const { data: updatedData, error: updateError } = await supabase
        .from('profiles')
        .update({
          deactivated_at: isDeactivated ? null : new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id')
        .single()

      if (updateError) {
        throw updateError
      }

      if (!updatedData) {
        throw new Error('Update blocked by RLS policy. Super admin cannot update profiles - migration needed.')
      }

      setIsDialogOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Button
        variant={isDeactivated ? 'default' : 'destructive'}
        size="sm"
        onClick={() => setIsDialogOpen(true)}
      >
        {isDeactivated ? 'Reactivate' : 'Deactivate'}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={isDeactivated ? 'text-green-600' : 'text-red-600'}>
              {isDeactivated ? 'Reactivate User' : 'Deactivate User'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {isDeactivated ? (
                <>
                  Are you sure you want to reactivate <strong>{userName}</strong>?
                  They will immediately regain access to the platform.
                </>
              ) : (
                <>
                  Are you sure you want to deactivate <strong>{userName}</strong>?
                  They will be blocked from accessing the platform.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {isDeactivated ? (
              <Alert>
                <AlertDescription>
                  <strong>What happens when you reactivate:</strong>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>User can log in immediately</li>
                    <li>All their data and memberships are restored</li>
                    <li>They regain access to their organizations and pools</li>
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  <strong>What happens when you deactivate:</strong>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>User will be blocked from accessing the app</li>
                    <li>Their data and history are preserved</li>
                    <li>They can be reactivated at any time</li>
                    <li>Standings will still show their name</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

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
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={isDeactivated ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={isLoading}
            >
              {isLoading
                ? (isDeactivated ? 'Reactivating...' : 'Deactivating...')
                : (isDeactivated ? 'Reactivate User' : 'Deactivate User')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
