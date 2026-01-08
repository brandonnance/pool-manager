'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface JoinPoolButtonProps {
  mmPoolId: string
  userId: string
  currentEntryCount: number
  drawCompleted: boolean
  hasExistingEntry: boolean
}

export function MmJoinPoolButton({
  mmPoolId,
  userId,
  currentEntryCount,
  drawCompleted,
  hasExistingEntry,
}: JoinPoolButtonProps) {
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const canJoin = !hasExistingEntry && currentEntryCount < 64 && !drawCompleted

  const handleJoin = async () => {
    setError(null)
    setIsJoining(true)

    const supabase = createClient()

    // Get user's display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()

    const { error: insertError } = await supabase.from('mm_entries').insert({
      mm_pool_id: mmPoolId,
      user_id: userId,
      display_name: profile?.display_name || 'Unknown',
    })

    if (insertError) {
      // Check for duplicate entry
      if (insertError.code === '23505') {
        setError('You have already joined this pool')
      } else {
        setError(insertError.message)
      }
      setIsJoining(false)
      return
    }

    router.refresh()
  }

  if (hasExistingEntry) {
    return (
      <Button variant="outline" disabled>
        Already Joined
      </Button>
    )
  }

  if (drawCompleted) {
    return (
      <Button variant="outline" disabled>
        Draw Completed
      </Button>
    )
  }

  if (currentEntryCount >= 64) {
    return (
      <Button variant="outline" disabled>
        Pool Full
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>Join Pool</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Join March Madness Pool?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be entered into the random team draw. Once all 64 entries are
            collected, teams will be randomly assigned. There is no entry fee for
            this demo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleJoin} disabled={isJoining || !canJoin}>
            {isJoining ? 'Joining...' : 'Join Pool'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
