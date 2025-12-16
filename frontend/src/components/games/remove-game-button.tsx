'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface RemoveGameButtonProps {
  poolGameId: string
  gameName: string
}

export function RemoveGameButton({ poolGameId, gameName }: RemoveGameButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleRemove = async () => {
    if (!confirm(`Remove "${gameName}" from this pool?`)) {
      return
    }

    setIsLoading(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('bb_pool_games')
      .delete()
      .eq('id', poolGameId)

    if (error) {
      alert(`Error: ${error.message}`)
      setIsLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <button
      onClick={handleRemove}
      disabled={isLoading}
      className="text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      {isLoading ? 'Removing...' : 'Remove'}
    </button>
  )
}
