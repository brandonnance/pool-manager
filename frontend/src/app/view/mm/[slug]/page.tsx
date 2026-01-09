import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { BracketView } from '@/components/march-madness/bracket-view'
import { StandingsTable } from '@/components/march-madness/standings-table'
import { TeamDrawDisplay } from '@/components/march-madness/team-draw-display'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MmGame, MmEntry, MmPoolTeam } from '@/components/march-madness/game-card'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Create an anonymous Supabase client for public access
function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function PublicMarchMadnessPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = createAnonClient()

  // Look up mm_pool by public_slug
  const { data: mmPool } = await supabase
    .from('mm_pools')
    .select(`
      id,
      pool_id,
      tournament_year,
      draw_completed,
      public_slug
    `)
    .eq('public_slug', slug)
    .single()

  if (!mmPool) {
    notFound()
  }

  // Get pool name
  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, status')
    .eq('id', mmPool.pool_id)
    .single()

  if (!pool) {
    notFound()
  }

  // Get entries (public data only)
  const { data: entriesData } = await supabase
    .from('mm_entries')
    .select('id, mm_pool_id, user_id, current_team_id, original_team_id, eliminated, eliminated_round, display_name, total_payout')
    .eq('mm_pool_id', mmPool.id)

  // Get pool teams
  const { data: poolTeamsData } = await supabase
    .from('mm_pool_teams')
    .select('id, mm_pool_id, team_id, seed, region, eliminated, eliminated_round, bb_teams (id, name, abbrev)')
    .eq('mm_pool_id', mmPool.id)
    .order('region')
    .order('seed')

  // Get games
  const { data: gamesData } = await supabase
    .from('mm_games')
    .select('*')
    .eq('mm_pool_id', mmPool.id)
    .order('round')
    .order('game_number')

  const entries: MmEntry[] = (entriesData ?? []).map(e => ({
    ...e,
    total_payout: Number(e.total_payout) || 0,
  }))

  const poolTeams: MmPoolTeam[] = (poolTeamsData ?? []).map(t => ({
    ...t,
    bb_teams: t.bb_teams as MmPoolTeam['bb_teams'],
  }))

  const games: MmGame[] = (gamesData ?? []).map(g => ({
    id: g.id,
    mm_pool_id: g.mm_pool_id,
    round: g.round,
    region: g.region,
    game_number: g.game_number,
    higher_seed_team_id: g.higher_seed_team_id,
    lower_seed_team_id: g.lower_seed_team_id,
    spread: g.spread ? Number(g.spread) : null,
    higher_seed_score: g.higher_seed_score,
    lower_seed_score: g.lower_seed_score,
    status: g.status,
    winning_team_id: g.winning_team_id,
    spread_covering_team_id: g.spread_covering_team_id,
    higher_seed_entry_id: g.higher_seed_entry_id,
    lower_seed_entry_id: g.lower_seed_entry_id,
    advancing_entry_id: g.advancing_entry_id,
    scheduled_time: g.scheduled_time,
  }))

  // Calculate stats
  const aliveCount = entries.filter(e => !e.eliminated).length
  const completedGames = games.filter(g => g.status === 'final').length
  const totalGames = games.length

  // Check setup status
  const teamsReady = poolTeams.length === 64
  const drawReady = mmPool.draw_completed
  const needsSetup = !teamsReady || !drawReady

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pool.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                March Madness {mmPool.tournament_year} - 64-Player Blind Draw
              </p>
            </div>
            <div className="flex items-center gap-2">
              {drawReady ? (
                <Badge variant="default">Draw Complete</Badge>
              ) : (
                <Badge variant="secondary">Setup in Progress</Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Setup in progress message */}
        {needsSetup ? (
          <Card>
            <CardContent className="py-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Pool Setup in Progress</h3>
              <p className="text-muted-foreground mb-4">
                The commissioner is still setting up this pool.
              </p>
              <div className="flex justify-center gap-4">
                <Badge variant="outline">
                  {poolTeams.length}/64 Teams
                </Badge>
                <Badge variant="outline">
                  {entries.length}/64 Entries
                </Badge>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{aliveCount}</p>
                  <p className="text-sm text-muted-foreground">Players Alive</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{64 - aliveCount}</p>
                  <p className="text-sm text-muted-foreground">Eliminated</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{completedGames}</p>
                  <p className="text-sm text-muted-foreground">Games Played</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{totalGames - completedGames}</p>
                  <p className="text-sm text-muted-foreground">Games Remaining</p>
                </CardContent>
              </Card>
            </div>

            {/* Main content tabs */}
            <Tabs defaultValue="bracket">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="bracket">Bracket</TabsTrigger>
                <TabsTrigger value="standings">Standings</TabsTrigger>
                <TabsTrigger value="teams">Teams</TabsTrigger>
              </TabsList>

              <TabsContent value="bracket" className="mt-4">
                <BracketView
                  games={games}
                  entries={entries}
                  poolTeams={poolTeams}
                  currentUserId={null}
                />
              </TabsContent>

              <TabsContent value="standings" className="mt-4">
                <StandingsTable
                  entries={entries}
                  poolTeams={poolTeams}
                  currentUserId={null}
                />
              </TabsContent>

              <TabsContent value="teams" className="mt-4">
                <TeamDrawDisplay
                  entries={entries}
                  poolTeams={poolTeams}
                  currentUserId={null}
                  drawCompleted={mmPool.draw_completed}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 py-6 text-center text-sm text-muted-foreground border-t bg-white">
        <p>Powered by BN Pools</p>
      </footer>
    </div>
  )
}
