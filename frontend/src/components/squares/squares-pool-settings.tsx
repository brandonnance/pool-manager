'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { shuffleArray } from '@/lib/squares'

interface SqPool {
  id: string
  pool_id: string
  reverse_scoring: boolean | null
  max_squares_per_player: number | null
  numbers_locked: boolean | null
  row_numbers: number[] | null
  col_numbers: number[] | null
}

interface Pool {
  id: string
  name: string
  status: string
  visibility: string
}

interface SquaresPoolSettingsProps {
  pool: Pool
  sqPool: SqPool
  claimedSquaresCount: number
  allGamesFinal?: boolean
  finalGamesCount?: number
  totalGamesCount?: number
}

export function SquaresPoolSettings({
  pool,
  sqPool,
  claimedSquaresCount,
  allGamesFinal,
  finalGamesCount,
  totalGamesCount,
}: SquaresPoolSettingsProps) {
  const [isLocking, setIsLocking] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false)
  const [isAutoFilling, setIsAutoFilling] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [reverseScoring, setReverseScoring] = useState(sqPool.reverse_scoring ?? true)
  const [maxSquares, setMaxSquares] = useState(sqPool.max_squares_per_player?.toString() ?? '')
  const [visibility, setVisibility] = useState(pool.visibility)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLockNumbers = async () => {
    if (claimedSquaresCount === 0) {
      setError('No squares have been claimed yet')
      return
    }

    if (!confirm(`Are you sure you want to lock the grid and reveal numbers? This cannot be undone. ${100 - claimedSquaresCount} squares are still unclaimed.`)) {
      return
    }

    setIsLocking(true)
    setError(null)

    const supabase = createClient()

    // Generate random number assignments
    const rowNumbers = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    const colNumbers = shuffleArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

    const { error: updateError } = await supabase
      .from('sq_pools')
      .update({
        row_numbers: rowNumbers,
        col_numbers: colNumbers,
        numbers_locked: true,
      })
      .eq('id', sqPool.id)

    if (updateError) {
      setError(updateError.message)
      setIsLocking(false)
      return
    }

    setIsLocking(false)
    router.refresh()
  }

  const handleUpdateSettings = async () => {
    setIsUpdating(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('sq_pools')
      .update({
        reverse_scoring: reverseScoring,
        max_squares_per_player: maxSquares ? parseInt(maxSquares) : null,
      })
      .eq('id', sqPool.id)

    if (updateError) {
      setError(updateError.message)
      setIsUpdating(false)
      return
    }

    setIsUpdating(false)
    router.refresh()
  }

  const handleActivate = async () => {
    if (!confirm('Are you sure you want to activate this pool? Members will be able to claim squares.')) {
      return
    }

    setIsActivating(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'open' })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsActivating(false)
      return
    }

    router.refresh()
  }

  const handleComplete = async () => {
    if (!confirm('Are you sure you want to complete this pool? This will finalize standings.')) {
      return
    }

    setIsCompleting(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'completed' })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsCompleting(false)
      return
    }

    router.refresh()
  }

  const handleVisibilityChange = async (newVisibility: string) => {
    setIsUpdatingVisibility(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ visibility: newVisibility })
      .eq('id', pool.id)

    if (updateError) {
      setError(updateError.message)
      setIsUpdatingVisibility(false)
      return
    }

    setVisibility(newVisibility)
    setIsUpdatingVisibility(false)
    router.refresh()
  }

  // DEV TOOL: Auto-fill remaining squares with pool members
  const handleAutoFill = async () => {
    if (!confirm('This will randomly assign all empty squares to pool members. Continue?')) {
      return
    }

    setIsAutoFilling(true)
    setError(null)

    const supabase = createClient()

    // Get pool members
    const { data: members } = await supabase
      .from('pool_memberships')
      .select('user_id')
      .eq('pool_id', pool.id)
      .eq('status', 'approved')

    if (!members || members.length === 0) {
      setError('No approved members to assign squares to')
      setIsAutoFilling(false)
      return
    }

    // Get existing squares to find which are taken
    const { data: existingSquares } = await supabase
      .from('sq_squares')
      .select('row_index, col_index')
      .eq('sq_pool_id', sqPool.id)

    const takenSet = new Set(
      existingSquares?.map((s) => `${s.row_index}-${s.col_index}`) ?? []
    )

    // Build list of empty squares
    const emptySquares: { row: number; col: number }[] = []
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        if (!takenSet.has(`${row}-${col}`)) {
          emptySquares.push({ row, col })
        }
      }
    }

    // Shuffle empty squares
    for (let i = emptySquares.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[emptySquares[i], emptySquares[j]] = [emptySquares[j], emptySquares[i]]
    }

    // Assign squares round-robin to members
    const inserts = emptySquares.map((sq, idx) => ({
      sq_pool_id: sqPool.id,
      row_index: sq.row,
      col_index: sq.col,
      user_id: members[idx % members.length].user_id,
    }))

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from('sq_squares').insert(inserts)

      if (insertError) {
        setError(insertError.message)
        setIsAutoFilling(false)
        return
      }
    }

    setIsAutoFilling(false)
    router.refresh()
  }

  // DEV TOOL: Clear all squares
  const handleClearAllSquares = async () => {
    if (!confirm('This will DELETE ALL squares from the grid. This cannot be undone. Continue?')) {
      return
    }

    setIsClearing(true)
    setError(null)

    const supabase = createClient()

    const { error: deleteError } = await supabase
      .from('sq_squares')
      .delete()
      .eq('sq_pool_id', sqPool.id)

    if (deleteError) {
      setError(deleteError.message)
      setIsClearing(false)
      return
    }

    setIsClearing(false)
    router.refresh()
  }

  const numbersLocked = sqPool.numbers_locked ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commissioner Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Pool Status Actions */}
        {pool.status === 'draft' && (
          <Button
            onClick={handleActivate}
            disabled={isActivating}
            className="w-full"
          >
            {isActivating ? 'Activating...' : 'Activate Pool'}
          </Button>
        )}

        {pool.status === 'open' && !numbersLocked && (
          <>
            <Button
              onClick={handleLockNumbers}
              disabled={isLocking || claimedSquaresCount === 0}
              className="w-full"
              variant="default"
            >
              {isLocking ? 'Locking...' : 'Lock Numbers & Reveal Grid'}
            </Button>

            {/* DEV TOOLS */}
            <div className="space-y-2 pt-2 border-t border-dashed">
              <div className="text-xs text-muted-foreground font-medium">Dev Tools</div>
              {claimedSquaresCount < 100 && (
                <Button
                  onClick={handleAutoFill}
                  disabled={isAutoFilling || isClearing}
                  className="w-full"
                  variant="outline"
                  size="sm"
                >
                  {isAutoFilling ? 'Filling...' : `Auto-fill ${100 - claimedSquaresCount} Squares`}
                </Button>
              )}
              {claimedSquaresCount > 0 && (
                <Button
                  onClick={handleClearAllSquares}
                  disabled={isClearing || isAutoFilling}
                  className="w-full"
                  variant="destructive"
                  size="sm"
                >
                  {isClearing ? 'Clearing...' : `Clear All ${claimedSquaresCount} Squares`}
                </Button>
              )}
            </div>
          </>
        )}

        {pool.status === 'open' && numbersLocked && (
          <>
            {allGamesFinal ? (
              <Button
                onClick={handleComplete}
                disabled={isCompleting}
                className="w-full"
              >
                {isCompleting ? 'Completing...' : 'Complete Pool'}
              </Button>
            ) : (
              <div className="text-sm text-muted-foreground bg-muted rounded-md p-3">
                <p className="font-medium">Games in progress</p>
                <p className="text-xs mt-1">
                  {finalGamesCount ?? 0} of {totalGamesCount ?? 0} games final
                </p>
              </div>
            )}
          </>
        )}

        {/* Grid Status */}
        <div className="bg-muted rounded-md p-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Squares Claimed</span>
            <span className="font-medium">{claimedSquaresCount} / 100</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted-foreground">Numbers</span>
            <span className="font-medium">{numbersLocked ? 'Locked' : 'Pending'}</span>
          </div>
        </div>

        {/* Settings (only editable before numbers locked) */}
        {!numbersLocked && (
          <div className="space-y-4 pt-3 border-t border-border">
            <div className="text-sm font-medium">Grid Settings</div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="reverseScoring" className="text-sm font-normal">
                  Reverse Scoring
                </Label>
                <div className="text-xs text-muted-foreground">
                  Pay both normal and reverse winners
                </div>
              </div>
              <Switch
                id="reverseScoring"
                checked={reverseScoring}
                onCheckedChange={setReverseScoring}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxSquares" className="text-sm font-normal">
                Max Squares per Player
              </Label>
              <Input
                id="maxSquares"
                type="number"
                min="1"
                max="100"
                value={maxSquares}
                onChange={(e) => setMaxSquares(e.target.value)}
                placeholder="Unlimited"
              />
            </div>

            {(reverseScoring !== (sqPool.reverse_scoring ?? true) ||
              maxSquares !== (sqPool.max_squares_per_player?.toString() ?? '')) && (
              <Button
                onClick={handleUpdateSettings}
                disabled={isUpdating}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {isUpdating ? 'Saving...' : 'Save Settings'}
              </Button>
            )}
          </div>
        )}

        {/* Visibility Toggle (only editable before numbers locked) */}
        {!numbersLocked && (
          <div className="pt-3 border-t border-border">
            <Label className="text-sm font-medium block mb-3">Pool Visibility</Label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="invite_only"
                  checked={visibility === 'invite_only'}
                  onChange={() => handleVisibilityChange('invite_only')}
                  disabled={isUpdatingVisibility}
                  className="h-4 w-4 text-primary focus:ring-primary border-input"
                />
                <span className="ml-2 text-sm">Invite Only</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="open_to_org"
                  checked={visibility === 'open_to_org'}
                  onChange={() => handleVisibilityChange('open_to_org')}
                  disabled={isUpdatingVisibility}
                  className="h-4 w-4 text-primary focus:ring-primary border-input"
                />
                <span className="ml-2 text-sm">Open to Organization</span>
              </label>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground pt-2">
          Status: <span className="font-medium">{pool.status}</span>
        </p>
      </CardContent>
    </Card>
  )
}
