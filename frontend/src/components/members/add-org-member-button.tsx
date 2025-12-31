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

interface OrgMember {
  userId: string
  displayName: string | null
  role: string
}

interface AddOrgMemberButtonProps {
  poolId: string
  orgMembers: OrgMember[]
}

export function AddOrgMemberButton({ poolId, orgMembers }: AddOrgMemberButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()

  const filteredMembers = orgMembers.filter((member) =>
    member.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleSelection = (userId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    const allFilteredIds = new Set(filteredMembers.map(m => m.userId))
    setSelectedIds(allFilteredIds)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleAddMembers = async () => {
    if (selectedIds.size === 0) return

    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      const membersToAdd = orgMembers.filter(m => selectedIds.has(m.userId))
      const now = new Date().toISOString()

      // Insert all selected members
      const { error: insertError } = await supabase
        .from('pool_memberships')
        .insert(
          membersToAdd.map(member => ({
            pool_id: poolId,
            user_id: member.userId,
            status: 'approved',
            approved_by: user.id,
            approved_at: now,
          }))
        )

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('One or more users are already members of the pool')
        }
        throw insertError
      }

      const count = membersToAdd.length
      setSuccessMessage(`Added ${count} member${count !== 1 ? 's' : ''} to the pool`)

      // Refresh after a short delay to show the success message
      setTimeout(() => {
        router.refresh()
        setIsOpen(false)
        setSuccessMessage(null)
        setSearchTerm('')
        setSelectedIds(new Set())
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add members')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setSearchTerm('')
      setSelectedIds(new Set())
      setError(null)
      setSuccessMessage(null)
    }
  }

  if (orgMembers.length === 0) {
    return null
  }

  const selectedCount = selectedIds.size

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
          Add Org Member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Organization Members</DialogTitle>
          <DialogDescription>
            Select members to add to this pool. They will be immediately approved.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Select all / Clear selection */}
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted-foreground">
              {selectedCount > 0 ? `${selectedCount} selected` : 'Select members to add'}
            </span>
            <div className="flex gap-2">
              {filteredMembers.length > 0 && selectedCount < filteredMembers.length && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-primary hover:underline text-xs"
                >
                  Select all
                </button>
              )}
              {selectedCount > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-muted-foreground hover:underline text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm
                  ? 'No matching org members found'
                  : 'All org members are already in this pool'}
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = selectedIds.has(member.userId)
                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={() => toggleSelection(member.userId)}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors disabled:opacity-50 ${
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox indicator */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 text-primary-foreground"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {member.displayName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="text-left">
                        <div className="font-medium">
                          {member.displayName || 'Unknown User'}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {member.role}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAddMembers}
            disabled={isLoading || selectedCount === 0}
          >
            {isLoading
              ? 'Adding...'
              : `Add ${selectedCount} Member${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
