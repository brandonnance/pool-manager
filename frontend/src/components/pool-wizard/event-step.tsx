'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sport, PoolType, UpcomingEvent } from './types'

interface EventStepProps {
  sport: Sport
  poolType: PoolType
  selectedEventId: string | null
  onSelect: (event: UpcomingEvent) => void
  onBack: () => void
  onNext: () => void
}

/**
 * Step 4: Event Selection
 *
 * Fetches and displays upcoming events from the global events table.
 * Allows users to search/filter and select an event to link their pool to.
 */
export function EventStep({
  sport,
  poolType,
  selectedEventId,
  onSelect,
  onBack,
  onNext,
}: EventStepProps) {
  const [events, setEvents] = useState<UpcomingEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Determine event type based on pool type
  const eventType = poolType === 'golf' ? 'golf_tournament' : 'team_game'

  useEffect(() => {
    fetchEvents()
  }, [sport, eventType])

  const fetchEvents = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        sport,
        event_type: eventType,
        limit: '30',
      })

      const response = await fetch(`/api/events/upcoming?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch events')
      }

      setEvents(data.events || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events')
    } finally {
      setIsLoading(false)
    }
  }

  // Filter events by search term
  const filteredEvents = events.filter((event) =>
    event.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
            Live
          </span>
        )
      case 'scheduled':
        return (
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
            Upcoming
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Select Event</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose the {poolType === 'golf' ? 'tournament' : 'game'} for your pool.
        </p>
      </div>

      {/* Search */}
      <div>
        <Input
          type="text"
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-8 text-center text-muted-foreground">
          Loading events...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredEvents.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          {searchTerm
            ? 'No events match your search.'
            : 'No upcoming events found.'}
        </div>
      )}

      {/* Event list */}
      {!isLoading && filteredEvents.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelect(event)}
              className={`w-full p-4 rounded-lg border text-left transition-all ${
                selectedEventId === event.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">{event.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDate(event.start_time)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(event.status)}
                  {event.provider !== 'manual' && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      Auto-tracked
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!selectedEventId}>
          Continue
        </Button>
      </div>
    </div>
  )
}
