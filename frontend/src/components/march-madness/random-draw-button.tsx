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

interface RandomDrawButtonProps {
  mmPoolId: string
  entryCount: number
  teamCount: number
  drawCompleted: boolean
}

export function RandomDrawButton({
  mmPoolId,
  entryCount,
  teamCount,
  drawCompleted,
}: RandomDrawButtonProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const canDraw = entryCount === 64 && teamCount === 64 && !drawCompleted

  const handleDraw = async () => {
    setError(null)
    setIsDrawing(true)

    try {
      const response = await fetch('/api/madness/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mmPoolId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to run draw')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsDrawing(false)
    }
  }

  if (drawCompleted) {
    return (
      <Button variant="outline" disabled>
        Draw Completed
      </Button>
    )
  }

  if (!canDraw) {
    return (
      <Button variant="outline" disabled>
        {teamCount !== 64
          ? `Need 64 teams (have ${teamCount})`
          : `Need 64 entries (have ${entryCount})`}
      </Button>
    )
  }

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button>Run Random Draw</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run Team Draw?</AlertDialogTitle>
            <AlertDialogDescription>
              This will randomly assign one of the 64 teams to each of the 64 entries.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDraw} disabled={isDrawing}>
              {isDrawing ? 'Drawing...' : 'Run Draw'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
