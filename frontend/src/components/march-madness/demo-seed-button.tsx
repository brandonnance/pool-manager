'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Beaker, Users, Trophy, RotateCcw } from 'lucide-react'

interface DemoSeedButtonProps {
  mmPoolId: string
  variant?: 'teams' | 'entries' | 'full'
}

export function DemoSeedButton({ mmPoolId, variant = 'full' }: DemoSeedButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  const runAction = async (action: string) => {
    setIsLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/madness/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mmPoolId, action }),
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

  // Simple button for single action variant
  if (variant === 'teams') {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => runAction('seed_teams')}
          disabled={isLoading}
          className="gap-2"
        >
          <Beaker className="h-4 w-4" />
          {isLoading ? 'Seeding...' : 'Seed Demo Bracket'}
        </Button>
        {message && (
          <p className={`text-xs ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
            {message.text}
          </p>
        )}
      </div>
    )
  }

  if (variant === 'entries') {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => runAction('seed_entries')}
          disabled={isLoading}
          className="gap-2"
        >
          <Beaker className="h-4 w-4" />
          {isLoading ? 'Seeding...' : 'Fill with Demo Names'}
        </Button>
        {message && (
          <p className={`text-xs ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
            {message.text}
          </p>
        )}
      </div>
    )
  }

  // Full dropdown with all options
  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading} className="gap-2">
            <Beaker className="h-4 w-4" />
            {isLoading ? 'Working...' : 'Demo Tools'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => runAction('seed_teams')}>
            <Trophy className="mr-2 h-4 w-4" />
            Seed 64 Teams
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => runAction('seed_entries')}>
            <Users className="mr-2 h-4 w-4" />
            Fill Demo Entries
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => runAction('seed')}>
            <Beaker className="mr-2 h-4 w-4" />
            Seed Both (Teams + Entries)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => runAction('reset')} className="text-destructive">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Pool
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {message && (
        <p className={`text-xs ${message.type === 'error' ? 'text-destructive' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
