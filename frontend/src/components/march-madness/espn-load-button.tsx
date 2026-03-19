'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Globe, RefreshCw } from 'lucide-react'

interface EspnLoadButtonProps {
  mmPoolId: string
  poolId: string
  variant: 'load_teams' | 'sync_games'
  className?: string
}

export function EspnLoadButton({ mmPoolId, poolId, variant, className }: EspnLoadButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const handleClick = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/madness/espn-bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: variant, poolId, mmPoolId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Action failed' })
      } else {
        setMessage({ type: 'success', text: data.message })
        router.refresh()
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setIsLoading(false)
    }
  }

  const label = variant === 'load_teams'
    ? (isLoading ? 'Loading ESPN Teams...' : 'Load Teams from ESPN')
    : (isLoading ? 'Syncing ESPN Data...' : 'Sync ESPN Spreads & Times')

  const Icon = variant === 'load_teams' ? Globe : RefreshCw

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={isLoading}
        className={`gap-2 ${className ?? ''}`}
      >
        <Icon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        {label}
      </Button>
      {message && (
        <p className={`text-xs ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
