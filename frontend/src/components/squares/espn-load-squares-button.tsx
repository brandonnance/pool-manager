'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'

interface EspnLoadSquaresButtonProps {
  sqPoolId: string
  poolId: string
  className?: string
}

export function EspnLoadSquaresButton({ sqPoolId, poolId, className }: EspnLoadSquaresButtonProps) {
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
        body: JSON.stringify({ action: 'load_squares', poolId, sqPoolId }),
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

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={isLoading}
        className={`gap-2 ${className ?? ''}`}
      >
        <Globe className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        {isLoading ? 'Loading R64 from ESPN...' : 'Load R64 from ESPN'}
      </Button>
      {message && (
        <p className={`text-xs ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
