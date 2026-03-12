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

interface LinkTeamsButtonProps {
  mmPoolId: string
  poolId?: string
  teamCount: number
  teamsLinked: boolean
  className?: string
}

export function LinkTeamsButton({
  mmPoolId,
  poolId,
  teamCount,
  teamsLinked,
  className,
}: LinkTeamsButtonProps) {
  const [isLinking, setIsLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const canLink = teamCount === 64 && !teamsLinked

  const handleLink = async () => {
    setError(null)
    setIsLinking(true)

    try {
      const response = await fetch('/api/madness/link-teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mmPoolId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to link teams')
      }

      if (poolId) {
        router.push(`/pools/${poolId}/march-madness`)
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLinking(false)
    }
  }

  if (teamsLinked) {
    return (
      <Button variant="outline" disabled className={className}>
        Teams Linked
      </Button>
    )
  }

  if (!canLink) {
    return (
      <Button variant="outline" disabled className={className}>
        Need 64 teams (have {teamCount})
      </Button>
    )
  }

  return (
    <AlertDialog open={isLinking ? true : undefined}>
      <AlertDialogTrigger asChild>
        <Button disabled={isLinking} className={className}>
          {isLinking ? 'Linking...' : 'Link Teams to Entries'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isLinking ? 'Linking Teams...' : 'Link Teams to Entries?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isLinking
              ? 'Please wait while teams are being linked and games are generated. This may take a moment.'
              : 'This will link the 64 loaded teams to the existing position assignments and generate all 63 tournament games. The pool will be locked for play. This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLinking}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleLink} disabled={isLinking}>
            {isLinking ? 'Linking...' : 'Link Teams'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
