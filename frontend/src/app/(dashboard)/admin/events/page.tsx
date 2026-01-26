/**
 * @fileoverview Super Admin event management page
 * @route /admin/events
 * @auth Super Admin only (profiles.is_super_admin = true)
 * @layout Dashboard layout with admin navigation
 *
 * @description
 * Platform-wide event management interface for super administrators.
 * Displays all global events with their status, sport, and linked pool counts.
 * Allows creating new events and navigating to event detail/scoring pages.
 *
 * @features
 * - Event statistics cards (total, scheduled, live, final counts)
 * - Responsive table/card view of all events
 * - Event status badges (Scheduled/In Progress/Final)
 * - Sport type indicators (NFL, NBA, etc.)
 * - Linked pool counts per event
 * - Quick actions: View details, Start scoring
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Play, Settings, Calendar, Trophy, Loader2 } from 'lucide-react'

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'in_progress':
      return <Badge className="bg-green-600">Live</Badge>
    case 'final':
      return <Badge variant="secondary">Final</Badge>
    case 'scheduled':
    default:
      return <Badge variant="outline">Scheduled</Badge>
  }
}

function getSportLabel(sport: string) {
  const labels: Record<string, string> = {
    nfl: 'NFL',
    nba: 'NBA',
    ncaaf: 'NCAAF',
    ncaab: 'NCAAB',
    pga: 'PGA',
    mlb: 'MLB',
    nhl: 'NHL',
  }
  return labels[sport] || sport.toUpperCase()
}

export default async function AdminEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify super admin access
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) {
    redirect('/dashboard')
  }

  // Get all events with their state
  const { data: events } = await supabase
    .from('events')
    .select(`
      id,
      sport,
      event_type,
      name,
      status,
      start_time,
      metadata,
      provider,
      provider_event_id,
      created_at
    `)
    .order('start_time', { ascending: false, nullsFirst: false })

  // Get event_state for each event
  const eventIds = events?.map(e => e.id) ?? []
  const { data: eventStates } = await supabase
    .from('event_state')
    .select('event_id, status, payload')
    .in('event_id', eventIds)

  const stateByEventId = new Map(eventStates?.map(s => [s.event_id, s]) ?? [])

  // Get linked pool counts from sq_games
  const { data: linkedPools } = await supabase
    .from('sq_games')
    .select('event_id')
    .in('event_id', eventIds)

  const poolCountByEventId = (linkedPools ?? []).reduce((acc, g) => {
    if (g.event_id) {
      acc[g.event_id] = (acc[g.event_id] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  // Calculate stats
  const totalEvents = events?.length ?? 0
  const scheduledEvents = events?.filter(e => e.status === 'scheduled').length ?? 0
  const liveEvents = events?.filter(e => e.status === 'in_progress').length ?? 0
  const finalEvents = events?.filter(e => e.status === 'final').length ?? 0

  // Filter to show football events (for admin scoring) prominently
  const footballEvents = events?.filter(e => ['nfl', 'ncaaf'].includes(e.sport)) ?? []
  const otherEvents = events?.filter(e => !['nfl', 'ncaaf'].includes(e.sport)) ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Event Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage global events and live scoring. Super Admin only.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/events/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Events</CardDescription>
            <CardTitle className="text-3xl">{totalEvents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Scheduled</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{scheduledEvents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Live Now</CardDescription>
            <CardTitle className="text-3xl text-green-600">{liveEvents}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Final</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">{finalEvents}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Football Events (Admin Scoring) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle>Football Events</CardTitle>
          </div>
          <CardDescription>
            NFL and NCAAF events - use admin scoring interface for live games
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {footballEvents.map((event) => {
              const state = stateByEventId.get(event.id)
              const poolCount = poolCountByEventId[event.id] || 0
              const effectiveStatus = state?.status || event.status

              return (
                <div key={event.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{event.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {getSportLabel(event.sport)}
                      </div>
                    </div>
                    {getStatusBadge(effectiveStatus)}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {event.start_time && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(event.start_time).toLocaleDateString()}
                      </span>
                    )}
                    <span>{poolCount} linked pool{poolCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="pt-2 border-t flex gap-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link href={`/admin/events/${event.id}`}>
                        <Settings className="mr-1 h-3 w-3" />
                        Details
                      </Link>
                    </Button>
                    {effectiveStatus !== 'final' && (
                      <Button size="sm" asChild className="flex-1">
                        <Link href={`/admin/events/${event.id}/scoring`}>
                          <Play className="mr-1 h-3 w-3" />
                          Score
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Event</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sport</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Start Time</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Linked Pools</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {footballEvents.map((event) => {
                  const state = stateByEventId.get(event.id)
                  const poolCount = poolCountByEventId[event.id] || 0
                  const effectiveStatus = state?.status || event.status

                  return (
                    <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{event.name}</div>
                          <div className="text-sm text-muted-foreground font-mono">
                            {event.id.slice(0, 8)}...
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{getSportLabel(event.sport)}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(effectiveStatus)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm">
                          {event.start_time
                            ? new Date(event.start_time).toLocaleString()
                            : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-muted-foreground">{poolCount}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/events/${event.id}`}>
                              <Settings className="mr-1 h-3 w-3" />
                              Details
                            </Link>
                          </Button>
                          {effectiveStatus !== 'final' && (
                            <Button size="sm" asChild>
                              <Link href={`/admin/events/${event.id}/scoring`}>
                                <Play className="mr-1 h-3 w-3" />
                                Score
                              </Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {footballEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No football events yet.{' '}
              <Link href="/admin/events/create" className="text-primary hover:underline">
                Create one
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Events (Golf, etc.) */}
      {otherEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Other Events</CardTitle>
            <CardDescription>
              Golf and other sports - typically use automated scoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Event</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Sport</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Provider</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Linked Pools</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {otherEvents.map((event) => {
                    const state = stateByEventId.get(event.id)
                    const poolCount = poolCountByEventId[event.id] || 0
                    const effectiveStatus = state?.status || event.status

                    return (
                      <tr key={event.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium">{event.name}</div>
                            <div className="text-sm text-muted-foreground font-mono">
                              {event.id.slice(0, 8)}...
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{getSportLabel(event.sport)}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          {getStatusBadge(effectiveStatus)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm capitalize">{event.provider}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-muted-foreground">{poolCount}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/events/${event.id}`}>
                              <Settings className="mr-1 h-3 w-3" />
                              Details
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View for Other Events */}
            <div className="md:hidden space-y-3">
              {otherEvents.map((event) => {
                const state = stateByEventId.get(event.id)
                const poolCount = poolCountByEventId[event.id] || 0
                const effectiveStatus = state?.status || event.status

                return (
                  <div key={event.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{event.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {getSportLabel(event.sport)} - {event.provider}
                        </div>
                      </div>
                      {getStatusBadge(effectiveStatus)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {poolCount} linked pool{poolCount !== 1 ? 's' : ''}
                    </div>
                    <div className="pt-2 border-t">
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <Link href={`/admin/events/${event.id}`}>
                          <Settings className="mr-1 h-3 w-3" />
                          Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
