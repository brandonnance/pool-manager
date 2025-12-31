'use client'

import { Fragment, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SquareCell, type WinningRound } from './square-cell'
import { cn } from '@/lib/utils'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface Square {
  id: string | null
  row_index: number
  col_index: number
  user_id: string | null
  owner_name: string | null
  owner_initials: string | null
}

interface Member {
  user_id: string
  display_name: string
}

export type LegendMode = 'full_playoff' | 'single_game' | 'score_change'

export interface SquaresGridProps {
  sqPoolId: string
  poolId: string
  squares: Square[]
  rowNumbers: number[] | null
  colNumbers: number[] | null
  numbersLocked: boolean
  currentUserId: string | null
  userSquareCount: number
  maxSquaresPerPlayer: number | null
  canClaim: boolean
  isCommissioner?: boolean
  winningSquareRounds?: Map<string, WinningRound>
  homeTeamLabel?: string
  awayTeamLabel?: string
  legendMode?: LegendMode
  className?: string
}

export function SquaresGrid({
  sqPoolId,
  poolId,
  squares,
  rowNumbers,
  colNumbers,
  numbersLocked,
  currentUserId,
  userSquareCount,
  maxSquaresPerPlayer,
  canClaim,
  isCommissioner = false,
  winningSquareRounds = new Map(),
  homeTeamLabel = 'Home',
  awayTeamLabel = 'Away',
  legendMode = 'full_playoff',
  className,
}: SquaresGridProps) {
  const router = useRouter()
  const [loadingCell, setLoadingCell] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Admin assignment dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState<{
    rowIndex: number
    colIndex: number
    square: Square | null
  } | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [isFetchingMembers, setIsFetchingMembers] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)

  // Create a map for quick lookup
  const squareMap = new Map<string, Square>()
  squares.forEach((sq) => {
    squareMap.set(`${sq.row_index}-${sq.col_index}`, sq)
  })

  // Check if user can claim more squares
  const canClaimMore = !maxSquaresPerPlayer || userSquareCount < maxSquaresPerPlayer

  // Fetch members when dialog opens
  useEffect(() => {
    if (assignDialogOpen && members.length === 0 && !isFetchingMembers) {
      fetchMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignDialogOpen])

  const fetchMembers = async () => {
    setIsFetchingMembers(true)
    const supabase = createClient()

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

  const handleAdminClick = (rowIndex: number, colIndex: number) => {
    const cellKey = `${rowIndex}-${colIndex}`
    const square = squareMap.get(cellKey) || null
    setSelectedSquare({ rowIndex, colIndex, square })
    setSelectedUserId(square?.user_id || '')
    setAssignDialogOpen(true)
  }

  const handleAssign = async () => {
    if (!selectedSquare || !selectedUserId) return

    setIsAssigning(true)
    setError(null)

    const supabase = createClient()
    const { rowIndex, colIndex, square } = selectedSquare

    if (square?.id) {
      // Update existing square
      const { error: updateError } = await supabase
        .from('sq_squares')
        .update({ user_id: selectedUserId })
        .eq('id', square.id)

      if (updateError) {
        setError(updateError.message)
        setIsAssigning(false)
        return
      }
    } else {
      // Insert new square
      const { error: insertError } = await supabase.from('sq_squares').insert({
        sq_pool_id: sqPoolId,
        row_index: rowIndex,
        col_index: colIndex,
        user_id: selectedUserId,
      })

      if (insertError) {
        setError(insertError.message)
        setIsAssigning(false)
        return
      }
    }

    setIsAssigning(false)
    setAssignDialogOpen(false)
    setSelectedSquare(null)
    router.refresh()
  }

  const handleUnassign = async () => {
    if (!selectedSquare?.square?.id) return

    setIsAssigning(true)
    setError(null)

    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('sq_squares')
      .delete()
      .eq('id', selectedSquare.square.id)

    if (deleteError) {
      setError(deleteError.message)
      setIsAssigning(false)
      return
    }

    setIsAssigning(false)
    setAssignDialogOpen(false)
    setSelectedSquare(null)
    router.refresh()
  }

  // Admin can assign when pool is open and numbers not locked (before game starts)
  const canAdminAssign = isCommissioner && !numbersLocked

  const handleSquareClaim = async (rowIndex: number, colIndex: number) => {
    if (!currentUserId || !canClaim || !canClaimMore) return

    const cellKey = `${rowIndex}-${colIndex}`
    setLoadingCell(cellKey)
    setError(null)

    const supabase = createClient()

    const { error: insertError } = await supabase.from('sq_squares').insert({
      sq_pool_id: sqPoolId,
      row_index: rowIndex,
      col_index: colIndex,
      user_id: currentUserId,
    })

    if (insertError) {
      console.error('Error claiming square:', insertError)
      // Handle unique constraint violation (race condition - someone else claimed it)
      if (insertError.code === '23505') {
        setError('This square was just claimed by someone else. Please choose another.')
      } else {
        setError(insertError.message)
      }
    }

    setLoadingCell(null)
    router.refresh()
  }

  const handleSquareUnclaim = async (rowIndex: number, colIndex: number) => {
    if (!currentUserId || numbersLocked) return

    const cellKey = `${rowIndex}-${colIndex}`
    const square = squareMap.get(cellKey)
    if (!square?.id || square.user_id !== currentUserId) return

    setLoadingCell(cellKey)
    setError(null)

    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('sq_squares')
      .delete()
      .eq('id', square.id)

    if (deleteError) {
      console.error('Error unclaiming square:', deleteError)
      setError(deleteError.message)
    }

    setLoadingCell(null)
    router.refresh()
  }

  // Can unclaim if: pool is open and numbers not locked
  const canUnclaim = canClaim && !numbersLocked

  return (
    <div className={cn('space-y-2', className)}>
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        {/* Away team axis label */}
        <div className="flex items-center justify-center mb-2 ml-10">
          <div className="flex items-center gap-2 px-4 py-1 bg-primary/10 rounded-full">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {awayTeamLabel}
            </span>
            <span className="text-primary">→</span>
          </div>
        </div>

        <div className="flex">
          {/* Home team axis label */}
          <div className="flex items-center justify-center mr-2 w-8">
            <div className="flex flex-col items-center gap-1 px-1 py-3 bg-primary/10 rounded-full">
              <span
                className="text-xs font-semibold uppercase tracking-wide text-primary"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                {homeTeamLabel}
              </span>
              <span className="text-primary">↓</span>
            </div>
          </div>

          {/* Grid */}
          <div
            className="grid gap-px bg-border p-px rounded-lg min-w-fit flex-1"
            style={{
              gridTemplateColumns: `minmax(36px, 40px) repeat(10, minmax(36px, 1fr))`,
              gridTemplateRows: `minmax(36px, 40px) repeat(10, minmax(36px, 1fr))`,
            }}
          >
            {/* Top-left corner cell - empty */}
            <div className="bg-muted/50 rounded-tl-lg" />

            {/* Column headers (Away team score - 0-9) */}
            {Array.from({ length: 10 }, (_, colIdx) => (
              <div
                key={`col-header-${colIdx}`}
                className={cn(
                  'bg-muted flex items-center justify-center font-bold text-sm',
                  colIdx === 9 && 'rounded-tr-lg'
                )}
              >
                {colNumbers ? colNumbers[colIdx] : '?'}
              </div>
            ))}

            {/* Rows */}
            {Array.from({ length: 10 }, (_, rowIdx) => (
              <Fragment key={`row-${rowIdx}`}>
                {/* Row header (Home team score - 0-9) */}
                <div
                  key={`row-header-${rowIdx}`}
                  className={cn(
                    'bg-muted flex items-center justify-center font-bold text-sm',
                    rowIdx === 9 && 'rounded-bl-lg'
                  )}
                >
                  {rowNumbers ? rowNumbers[rowIdx] : '?'}
                </div>

                {/* Square cells for this row */}
                {Array.from({ length: 10 }, (_, colIdx) => {
                  const cellKey = `${rowIdx}-${colIdx}`
                  const square = squareMap.get(cellKey)
                  const isLoading = loadingCell === cellKey

                  return (
                    <SquareCell
                      key={cellKey}
                      rowIndex={rowIdx}
                      colIndex={colIdx}
                      ownerId={square?.user_id || null}
                      ownerInitials={square?.owner_initials || null}
                      ownerName={square?.owner_name || null}
                      isCurrentUser={square?.user_id === currentUserId}
                      winningRound={square?.id ? winningSquareRounds.get(square.id) ?? null : null}
                      canClaim={canClaim && canClaimMore && !numbersLocked}
                      canUnclaim={canUnclaim}
                      isAdmin={canAdminAssign}
                      isLoading={isLoading}
                      onClick={() => handleSquareClaim(rowIdx, colIdx)}
                      onUnclaim={() => handleSquareUnclaim(rowIdx, colIdx)}
                      onAdminClick={() => handleAdminClick(rowIdx, colIdx)}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-4 rounded border border-border bg-muted/50" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-4 rounded border border-sky-400 bg-sky-100" />
          <span>Your squares</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-4 rounded border border-border bg-card" />
          <span>Claimed</span>
        </div>
        {legendMode === 'full_playoff' ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-amber-400 bg-amber-100" />
              <span>Wild Card</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-emerald-400 bg-emerald-100" />
              <span>Divisional</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-red-400 bg-red-100" />
              <span>Conference</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-violet-300 bg-violet-50" />
              <span>SB Halftime</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-purple-400 bg-purple-100" />
              <span>Super Bowl</span>
            </div>
          </>
        ) : legendMode === 'score_change' ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-emerald-400 bg-emerald-100" />
              <span>Forward</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-rose-400 bg-rose-100" />
              <span>Reverse</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-purple-400 bg-gradient-to-br from-emerald-100 from-50% to-rose-100 to-50%" />
              <span>Both</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-purple-400 bg-purple-100" />
              <span>Final</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-fuchsia-400 bg-fuchsia-100" />
              <span>Final Rev</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-violet-400 bg-gradient-to-br from-purple-100 from-50% to-fuchsia-100 to-50%" />
              <span>Final Both</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="size-4 rounded border border-teal-400 bg-teal-100" />
            <span>Winner</span>
          </div>
        )}
      </div>

      {/* Admin Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedSquare?.square?.user_id ? 'Reassign Square' : 'Assign Square'}
            </DialogTitle>
            <DialogDescription>
              Square [{selectedSquare?.rowIndex ?? 0}, {selectedSquare?.colIndex ?? 0}]
              {selectedSquare?.square?.owner_name && (
                <span className="block mt-1">
                  Currently assigned to: <strong>{selectedSquare.square.owner_name}</strong>
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
                        {member.user_id === selectedSquare?.square?.user_id && ' (current)'}
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
            {selectedSquare?.square?.user_id && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleUnassign}
                disabled={isAssigning}
                className="sm:mr-auto"
              >
                {isAssigning ? 'Removing...' : 'Remove Assignment'}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAssignDialogOpen(false)}
              disabled={isAssigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isAssigning || !selectedUserId || isFetchingMembers}
            >
              {isAssigning ? 'Assigning...' : 'Assign Square'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
