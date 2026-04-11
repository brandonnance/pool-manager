'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2 } from 'lucide-react'

interface MmCompletePoolButtonProps {
  poolId: string
  allGamesFinal: boolean
  finalGamesCount: number
  totalGamesCount: number
}

export function MmCompletePoolButton({
  poolId,
  allGamesFinal,
  finalGamesCount,
  totalGamesCount,
}: MmCompletePoolButtonProps) {
  const router = useRouter()
  const [isCompleting, setIsCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleComplete = async () => {
    if (!confirm('Are you sure you want to complete this pool? This will finalize standings and no more scores can be entered.')) {
      return
    }

    setIsCompleting(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('pools')
      .update({ status: 'completed' })
      .eq('id', poolId)

    if (updateError) {
      setError(updateError.message)
      setIsCompleting(false)
      return
    }

    router.refresh()
  }

  if (!allGamesFinal) {
    return (
      <div className="text-sm text-muted-foreground bg-muted rounded-md p-3">
        <p className="font-medium">Tournament in progress</p>
        <p className="text-xs mt-1">
          {finalGamesCount} of {totalGamesCount} games final. Complete Pool will be available when all games are final.
        </p>
      </div>
    )
  }

  return (
    <>
      <Button
        onClick={handleComplete}
        disabled={isCompleting}
        className="w-full"
      >
        <CheckCircle2 className="size-4 mr-1.5" />
        {isCompleting ? 'Completing...' : 'Complete Pool'}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  )
}
