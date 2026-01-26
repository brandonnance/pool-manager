/**
 * @fileoverview Admin event detail page
 * @route /admin/events/[id]
 * @auth Super Admin only
 *
 * @description
 * Shows event details, linked pools, and event state payload.
 * Allows editing event metadata and starting live scoring.
 */
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Play, ExternalLink, Calendar, Clock } from 'lucide-react'
import { EditEventForm } from '@/components/admin/edit-event-form'

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

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminEventDetailPage({ params }: PageProps) {
  const { id } = await params
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

  // Get event details
  const { data: event, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !event) {
    notFound()
  }

  // Get event state
  const { data: eventState } = await supabase
    .from('event_state')
    .select('*')
    .eq('event_id', id)
    .maybeSingle()

  // Get linked pools via sq_games
  const { data: linkedGames } = await supabase
    .from('sq_games')
    .select(`
      id,
      game_name,
      home_team,
      away_team,
      status,
      sq_pool_id,
      sq_pools!inner (
        id,
        pool_id,
        scoring_mode,
        reverse_scoring,
        pools!inner (
          id,
          name
        )
      )
    `)
    .eq('event_id', id)

  const effectiveStatus = eventState?.status || event.status
  const isFootball = ['nfl', 'ncaaf'].includes(event.sport)

  // Parse event state payload for football games
  const payload = eventState?.payload as {
    home_score?: number
    away_score?: number
    period?: number
    clock?: string
    home_team?: string
    away_team?: string
  } | null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/events">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
            {getStatusBadge(effectiveStatus)}
          </div>
          <p className="text-muted-foreground mt-1">
            {getSportLabel(event.sport)} - {event.event_type}
          </p>
        </div>
        {isFootball && effectiveStatus !== 'final' && (
          <Button asChild size="lg">
            <Link href={`/admin/events/${id}/scoring`}>
              <Play className="mr-2 h-4 w-4" />
              {effectiveStatus === 'in_progress' ? 'Continue Scoring' : 'Start Scoring'}
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Event Details */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Basic event information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Event ID</div>
                <div className="font-mono text-xs">{event.id}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Provider</div>
                <div className="capitalize">{event.provider}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Provider Event ID</div>
                <div className="font-mono text-xs">{event.provider_event_id}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Sport</div>
                <div>{getSportLabel(event.sport)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Start Time</div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {event.start_time
                    ? new Date(event.start_time).toLocaleString()
                    : 'Not set'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div>{effectiveStatus}</div>
              </div>
            </div>

            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <div>
                <div className="text-muted-foreground text-sm mb-1">Metadata</div>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(event.metadata, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Event Form */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Event</CardTitle>
            <CardDescription>Update event details</CardDescription>
          </CardHeader>
          <CardContent>
            <EditEventForm event={event} />
          </CardContent>
        </Card>

        {/* Current State (for football) */}
        {isFootball && eventState && (
          <Card>
            <CardHeader>
              <CardTitle>Current Game State</CardTitle>
              <CardDescription>Live score and game clock</CardDescription>
            </CardHeader>
            <CardContent>
              {payload ? (
                <div className="space-y-4">
                  {/* Score Display */}
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="flex justify-center items-center gap-8">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">
                          {payload.away_team || (event.metadata as { away_team?: string } | null)?.away_team || 'Away'}
                        </div>
                        <div className="text-4xl font-bold font-mono">
                          {payload.away_score ?? '-'}
                        </div>
                      </div>
                      <div className="text-2xl text-muted-foreground">-</div>
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground">
                          {payload.home_team || (event.metadata as { home_team?: string } | null)?.home_team || 'Home'}
                        </div>
                        <div className="text-4xl font-bold font-mono">
                          {payload.home_score ?? '-'}
                        </div>
                      </div>
                    </div>
                    {payload.period && (
                      <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Q{payload.period} {payload.clock || ''}
                      </div>
                    )}
                  </div>

                  {/* Full payload */}
                  <div>
                    <div className="text-muted-foreground text-sm mb-1">Full Payload</div>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No game state yet. Start scoring to create game state.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Linked Pools */}
        <Card className={isFootball && eventState ? '' : 'md:col-span-2'}>
          <CardHeader>
            <CardTitle>Linked Pools</CardTitle>
            <CardDescription>
              {linkedGames?.length ?? 0} pool{(linkedGames?.length ?? 0) !== 1 ? 's' : ''} linked to this event
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkedGames && linkedGames.length > 0 ? (
              <div className="space-y-2">
                {linkedGames.map((game) => {
                  const sqPool = game.sq_pools as {
                    id: string
                    pool_id: string
                    scoring_mode: string | null
                    reverse_scoring: boolean | null
                    pools: { id: string; name: string }
                  }
                  return (
                    <div
                      key={game.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">{sqPool.pools.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {game.away_team} @ {game.home_team}
                          {sqPool.scoring_mode && (
                            <span className="ml-2">
                              ({sqPool.scoring_mode === 'score_change' ? 'Every Score' : 'Quarter'})
                            </span>
                          )}
                          {sqPool.reverse_scoring && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Reverse
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/pools/${sqPool.pool_id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No pools linked to this event yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
