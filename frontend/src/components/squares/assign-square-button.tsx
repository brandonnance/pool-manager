'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Member {
  user_id: string
  display_name: string
}

interface AssignSquareButtonProps {
  poolId: string
  sqPoolId: string
  rowIndex: number
  colIndex: number
  currentOwnerId: string | null
  currentOwnerName: string | null
  squareId: string | null
  disabled?: boolean
  onClose?: () => void
}

export function AssignSquareButton({
  poolId,
  sqPoolId,
  rowIndex,
  colIndex,
  currentOwnerId,
  currentOwnerName,
  squareId,
  disabled,
  onClose,
}: AssignSquareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMembers, setIsFetchingMembers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const router = useRouter()

  // Fetch approved members when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchMembers()
    }
  }, [isOpen])

  const fetchMembers = async () => {
    setIsFetchingMembers(true)
    const supabase = createClient()

    // Get approved pool members
    const { data: memberships } = await supabase
      .from('pool_memberships')
      .select('user_id')
      .eq('pool_id', poolId)
      .eq('status', 'approved')

    if (memberships && memberships.length > 0) {
      const userIds = memberships.map((m) => m.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds)

      setMembers(
        profiles?.map((p) => ({
          user_id: p.id,
          display_name: p.display_name || 'Unknown',
        })) ?? []
      )
    }

    setIsFetchingMembers(false)
  }

  const handleAssign = async () => {
    if (!selectedUserId) {
      setError('Please select a member')
      return
    }

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // If there's an existing square, update it; otherwise insert
    if (squareId) {
      const { error: updateError } = await supabase
        .from('sq_squares')
        .update({ user_id: selectedUserId })
        .eq('id', squareId)

      if (updateError) {
        setError(updateError.message)
        setIsLoading(false)
        return
      }
    } else {
      const { error: insertError } = await supabase.from('sq_squares').insert({
        sq_pool_id: sqPoolId,
        row_index: rowIndex,
        col_index: colIndex,
        user_id: selectedUserId,
      })

      if (insertError) {
        setError(insertError.message)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(false)
    setIsOpen(false)
    onClose?.()
    router.refresh()
  }

  const handleUnassign = async () => {
    if (!squareId) return

    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('sq_squares')
      .delete()
      .eq('id', squareId)

    if (deleteError) {
      setError(deleteError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    setIsOpen(false)
    onClose?.()
    router.refresh()
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {currentOwnerId ? 'Reassign' : 'Assign'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {currentOwnerId ? 'Reassign Square' : 'Assign Square'}
          </DialogTitle>
          <DialogDescription>
            Square [{rowIndex}, {colIndex}]
            {currentOwnerName && (
              <span className="block mt-1">
                Currently assigned to: <strong>{currentOwnerName}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Assign to Member</Label>
            {isFetchingMembers ? (
              <div className="text-sm text-muted-foreground">Loading members...</div>
            ) : members.length === 0 ? (
              <div className="text-sm text-muted-foreground">No approved members found</div>
            ) : (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.display_name}
                      {member.user_id === currentOwnerId && ' (current)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentOwnerId && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleUnassign}
              disabled={isLoading}
              className="sm:mr-auto"
            >
              {isLoading ? 'Removing...' : 'Remove Assignment'}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={isLoading || !selectedUserId || isFetchingMembers}
          >
            {isLoading ? 'Assigning...' : 'Assign Square'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
