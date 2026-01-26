/**
 * @fileoverview Admin live scoring page
 * @route /admin/events/[id]/scoring
 * @auth Super Admin only
 *
 * @description
 * Live scoring interface for admin-controlled game scoring.
 * Provides quick score buttons, period controls, and real-time
 * feedback on winners for all linked pools.
 */
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Radio, Users } from 'lucide-react'
import { LiveScoringControl } from '@/components/admin/live-scoring-control'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminScoringPage({ params }: PageProps) {
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
        row_numbers,
        col_numbers,
        pools!inner (
          id,
          name
        )
      )
    `)
    .eq('event_id', id)

  // Count linked pools
  const linkedPoolCount = linkedGames?.length ?? 0

  // Parse metadata for team names
  const metadata = event.metadata as {
    home_team?: string
    away_team?: string
  } | null

  const homeTeam = metadata?.home_team || 'Home'
  const awayTeam = metadata?.away_team || 'Away'

  // Parse current state
  const payload = eventState?.payload as {
    home_score?: number
    away_score?: number
    period?: number
    clock?: string
    q1_home_score?: number
    q1_away_score?: number
    q2_home_score?: number
    q2_away_score?: number
    q3_home_score?: number
    q3_away_score?: number
    home_team?: string
    away_team?: string
  } | null

  const effectiveStatus = eventState?.status || event.status
  const isLive = effectiveStatus === 'in_progress'
  const isFinal = effectiveStatus === 'final'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/events/${id}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Event
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Live Scoring</h1>
            {isLive && (
              <Badge className="bg-green-600 animate-pulse">
                <Radio className="mr-1 h-3 w-3" />
                Live
              </Badge>
            )}
            {isFinal && <Badge variant="secondary">Final</Badge>}
          </div>
          <p className="text-muted-foreground mt-1">{event.name}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {linkedPoolCount} linked pool{linkedPoolCount !== 1 ? 's' : ''}
        </div>
      </div>

      {isFinal ? (
        <Card>
          <CardHeader>
            <CardTitle>Game Complete</CardTitle>
            <CardDescription>
              This game has been marked as final. Scoring is locked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center p-6 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Final Score</div>
              <div className="flex justify-center items-center gap-8">
                <div className="text-center">
                  <div className="text-lg text-muted-foreground">{awayTeam}</div>
                  <div className="text-5xl font-bold font-mono">{payload?.away_score ?? 0}</div>
                </div>
                <div className="text-3xl text-muted-foreground">-</div>
                <div className="text-center">
                  <div className="text-lg text-muted-foreground">{homeTeam}</div>
                  <div className="text-5xl font-bold font-mono">{payload?.home_score ?? 0}</div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Button variant="outline" asChild>
                <Link href={`/admin/events/${id}`}>View Event Details</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <LiveScoringControl
          eventId={id}
          eventState={eventState}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          linkedGames={linkedGames ?? []}
        />
      )}

      {/* Linked Pools Reference */}
      {linkedGames && linkedGames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Linked Pools</CardTitle>
            <CardDescription>
              Score changes will automatically create winners for these pools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linkedGames.map((game) => {
                const sqPool = game.sq_pools as {
                  id: string
                  pool_id: string
                  scoring_mode: string | null
                  reverse_scoring: boolean | null
                  row_numbers: number[] | null
                  col_numbers: number[] | null
                  pools: { id: string; name: string }
                }
                const hasNumbers = sqPool.row_numbers && sqPool.col_numbers

                return (
                  <div
                    key={game.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{sqPool.pools.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {sqPool.scoring_mode === 'score_change' ? 'Every Score' : 'Quarter'}
                        </Badge>
                        {sqPool.reverse_scoring && (
                          <Badge variant="outline" className="text-xs">
                            Reverse
                          </Badge>
                        )}
                        {!hasNumbers && (
                          <Badge variant="destructive" className="text-xs">
                            Numbers not set
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/pools/${sqPool.pool_id}`} target="_blank">
                        View
                      </Link>
                    </Button>
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
