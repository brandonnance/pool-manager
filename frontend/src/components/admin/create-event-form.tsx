'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

const SPORTS = [
  { value: 'nfl', label: 'NFL' },
  { value: 'ncaaf', label: 'College Football' },
  { value: 'nba', label: 'NBA' },
  { value: 'ncaab', label: 'College Basketball' },
  { value: 'mlb', label: 'MLB' },
  { value: 'nhl', label: 'NHL' },
]

const EVENT_TYPES = [
  { value: 'team_game', label: 'Team Game (Head-to-Head)' },
  { value: 'golf_tournament', label: 'Golf Tournament' },
]

export function CreateEventForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [sport, setSport] = useState('nfl')
  const [eventType, setEventType] = useState('team_game')
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [startTime, setStartTime] = useState('')
  const [providerEventId, setProviderEventId] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      // Generate a unique provider_event_id if not provided
      const finalProviderEventId = providerEventId || `manual-${Date.now()}`

      // Build metadata
      const metadata: Record<string, string> = {}
      if (homeTeam) metadata.home_team = homeTeam
      if (awayTeam) metadata.away_team = awayTeam

      const { data: newEvent, error: insertError } = await supabase
        .from('events')
        .insert({
          name,
          sport,
          event_type: eventType,
          provider: 'manual',
          provider_event_id: finalProviderEventId,
          start_time: startTime ? new Date(startTime).toISOString() : null,
          status: 'scheduled',
          metadata,
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      // Redirect to the new event's detail page
      router.push(`/admin/events/${newEvent.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
      setIsLoading(false)
    }
  }

  // Auto-generate name from teams
  const generateName = () => {
    if (awayTeam && homeTeam) {
      setName(`${awayTeam} @ ${homeTeam}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sport">Sport</Label>
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger id="sport">
              <SelectValue placeholder="Select sport" />
            </SelectTrigger>
            <SelectContent>
              {SPORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventType">Event Type</Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger id="eventType">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {eventType === 'team_game' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="awayTeam">Away Team</Label>
            <Input
              id="awayTeam"
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              onBlur={generateName}
              placeholder="e.g., Chiefs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="homeTeam">Home Team</Label>
            <Input
              id="homeTeam"
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              onBlur={generateName}
              placeholder="e.g., Eagles"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Event Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Super Bowl LIX - Chiefs @ Eagles"
          required
        />
        <p className="text-xs text-muted-foreground">
          Auto-generated from teams, or enter custom name
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="startTime">Start Time</Label>
        <Input
          id="startTime"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="providerEventId">
          ESPN Event ID <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="providerEventId"
          value={providerEventId}
          onChange={(e) => setProviderEventId(e.target.value)}
          placeholder="e.g., 401547417"
        />
        <p className="text-xs text-muted-foreground">
          For reference only. Not used for live polling.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          'Create Event'
        )}
      </Button>
    </form>
  )
}
