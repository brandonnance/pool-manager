import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GameCard } from '@/components/march-madness'

interface PageProps {
  params: Promise<{ id: string }>
}

const ROUND_ORDER = ['R64', 'R32', 'S16', 'E8', 'F4', 'FINAL'] as const
const ROUND_LABELS: Record<string, string> = {
  R64: 'Round of 64',
  R32: 'Round of 32',
  S16: 'Sweet 16',
  E8: 'Elite 8',
  F4: 'Final Four',
  FINAL: 'Championship',
}

export default async function MarchMadnessGamesPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get pool
  const { data: pool } = await supabase
    .from('pools')
    .select('id, name, type, status, org_id')
    .eq('id', id)
    .single()

  if (!pool || pool.type !== 'march_madness') {
    notFound()
  }

  // Check commissioner access
  const { data: poolMembership } = await supabase
    .from('pool_memberships')
    .select('role')
    .eq('pool_id', id)
    .eq('user_id', user.id)
    .single()

  const { data: orgMembership } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', pool.org_id)
    .eq('user_id', user.id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.is_super_admin ?? false
  const isOrgAdmin = orgMembership?.role === 'admin' || isSuperAdmin
  const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin

  if (!isPoolCommissioner) {
    redirect(`/pools/${id}/march-madness`)
  }

  // Get mm_pool config
  const { data: mmPool } = await supabase
    .from('mm_pools')
    .select('*')
    .eq('pool_id', id)
    .single()

  if (!mmPool) {
    notFound()
  }

  // Get entries
  const { data: entries } = await supabase
    .from('mm_entries')
    .select('*')
    .eq('mm_pool_id', mmPool.id)

  // Get pool teams
  const { data: poolTeams } = await supabase
    .from('mm_pool_teams')
    .select('*, bb_teams (id, name, abbrev)')
    .eq('mm_pool_id', mmPool.id)

  // Get games
  const { data: games } = await supabase
    .from('mm_games')
    .select('*')
    .eq('mm_pool_id', mmPool.id)
    .order('round')
    .order('game_number')

  // Group games by round
  const gamesByRound = new Map<string, typeof games>()
  ROUND_ORDER.forEach(round => {
    gamesByRound.set(
      round,
      games?.filter(g => g.round === round).sort((a, b) => (a.game_number || 0) - (b.game_number || 0)) ?? []
    )
  })

  // Find first round with games
  const firstRoundWithGames = ROUND_ORDER.find(r => (gamesByRound.get(r)?.length ?? 0) > 0) || 'R64'

  // Calculate stats
  const totalGames = games?.length ?? 0
  const completedGames = games?.filter(g => g.status === 'final').length ?? 0
  const gamesWithSpread = games?.filter(g => g.spread !== null).length ?? 0

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-4">
        <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
          <li>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/pools/${id}`} className="hover:text-foreground transition-colors">
              {pool.name}
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link href={`/pools/${id}/march-madness`} className="hover:text-foreground transition-colors">
              March Madness
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground font-medium">Games</li>
        </ol>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Manage Games</h1>
        <p className="text-muted-foreground">Enter spreads and scores for each game</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalGames}</p>
            <p className="text-sm text-muted-foreground">Total Games</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{gamesWithSpread}</p>
            <p className="text-sm text-muted-foreground">Spreads Set</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{completedGames}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {totalGames === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <h3 className="text-lg font-semibold mb-2">No Games Yet</h3>
            <p className="text-muted-foreground">
              Games will be created after the team draw is completed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={firstRoundWithGames}>
          <TabsList className="grid grid-cols-6 mb-4">
            {ROUND_ORDER.map(round => {
              const roundGames = gamesByRound.get(round) || []
              const completed = roundGames.filter(g => g.status === 'final').length
              return (
                <TabsTrigger
                  key={round}
                  value={round}
                  disabled={roundGames.length === 0}
                  className="text-xs sm:text-sm"
                >
                  {ROUND_LABELS[round].replace('Round of ', 'R')}
                  {roundGames.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs hidden sm:inline-flex">
                      {completed}/{roundGames.length}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {ROUND_ORDER.map(round => {
            const roundGames = gamesByRound.get(round) || []
            return (
              <TabsContent key={round} value={round}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {roundGames.map(game => (
                    <GameCard
                      key={game.id}
                      game={game}
                      poolTeams={poolTeams ?? []}
                      entries={entries ?? []}
                      currentUserId={user.id}
                      isCommissioner={true}
                    />
                  ))}
                </div>
                {roundGames.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground">
                        No games in this round yet
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}
