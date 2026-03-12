'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  poolId?: string
  entryCount: number
  teamCount: number
  drawCompleted: boolean
  className?: string
}

export function RandomDrawButton({
  mmPoolId,
  poolId,
  entryCount,
  teamCount,
  drawCompleted,
  className,
}: RandomDrawButtonProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isPreDraw = teamCount === 0 && entryCount === 64
  const isTraditional = teamCount === 64 && entryCount === 64
  const canDraw = (isPreDraw || isTraditional) && !drawCompleted

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

      if (poolId) {
        router.push(`/pools/${poolId}/march-madness`)
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsDrawing(false)
    }
  }

  if (drawCompleted) {
    return (
      <Button variant="outline" disabled className={className}>
        Draw Completed
      </Button>
    )
  }

  if (!canDraw) {
    return (
      <Button variant="outline" disabled className={className}>
        {entryCount !== 64
          ? `Need 64 entries (have ${entryCount})`
          : `Need 0 or 64 teams (have ${teamCount})`}
      </Button>
    )
  }

  return (
    <AlertDialog open={isDrawing ? true : undefined}>
      <AlertDialogTrigger asChild>
        <Button disabled={isDrawing} className={className}>
          {isDrawing ? 'Drawing...' : isPreDraw ? 'Run Position Draw' : 'Run Random Draw'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDrawing
              ? (isPreDraw ? 'Running Position Draw...' : 'Running Draw...')
              : (isPreDraw ? 'Run Position Draw?' : 'Run Team Draw?')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDrawing
              ? 'Please wait while positions are being assigned. This may take a moment.'
              : isPreDraw
                ? 'This will randomly assign bracket positions (region + seed) to each of the 64 entries. Actual teams can be linked later once the bracket is announced. This action cannot be undone.'
                : 'This will randomly assign one of the 64 teams to each of the 64 entries. This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDrawing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDraw} disabled={isDrawing}>
            {isDrawing ? 'Drawing...' : isPreDraw ? 'Run Position Draw' : 'Run Draw'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
