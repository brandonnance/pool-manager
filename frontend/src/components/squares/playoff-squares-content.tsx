'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SquaresGrid, type Square } from './squares-grid'
import { SquaresPoolSettings } from './squares-pool-settings'
import { GameScoreCard } from './game-score-card'
import { PayoutLeaderboard } from './payout-leaderboard'
import type { WinningRound } from './square-cell'

interface SqPool {
  id: string
  pool_id: string
  reverse_scoring: boolean | null
  max_squares_per_player: number | null
  numbers_locked: boolean | null
  row_numbers: number[] | null
  col_numbers: number[] | null
}

interface SqGame {
  id: string
  game_name: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  halftime_home_score: number | null
  halftime_away_score: number | null
  round: string
  status: string | null
  pays_halftime: boolean | null
  display_order: number | null
}

interface SqWinner {
  id: string
  sq_game_id: string
  square_id: string | null
  win_type: string
  payout: number | null
  winner_name: string | null
}

interface PlayoffSquaresContentProps {
  pool: {
    id: string
    name: string
    status: string
    visibility: string
  }
  sqPool: SqPool
  squares: Square[]
  games: SqGame[]
  winners: SqWinner[]
  currentUserId: string | null
  isCommissioner: boolean
  isMember: boolean
}

function getRoundLabel(round: string): string {
  switch (round) {
    case 'wild_card':
      return 'Wild Card'
    case 'divisional':
      return 'Divisional'
    case 'conference':
      return 'Conference'
    case 'super_bowl':
      return 'Super Bowl'
    default:
      return round
  }
}

export function PlayoffSquaresContent({
  pool,
  sqPool,
  squares,
  games,
  winners,
  currentUserId,
  isCommissioner,
  isMember,
}: PlayoffSquaresContentProps) {
  // Count squares owned by current user
  const userSquareCount = currentUserId
    ? squares.filter((sq) => sq.user_id === currentUserId).length
    : 0

  // Round hierarchy for playoff mode (higher number = higher tier)
  const roundHierarchy: Record<string, number> = {
    wild_card: 1,
    divisional: 2,
    conference: 3,
    super_bowl_halftime: 4,
    super_bowl: 5,
  }

  // Build winning square rounds map (squareId -> round)
  const gameById = new Map(games.map((g) => [g.id, g]))
  const winningSquareRounds = new Map<string, WinningRound>()
  winners.forEach((w) => {
    if (w.square_id) {
      const game = gameById.get(w.sq_game_id)
      if (game) {
        // Super Bowl halftime gets its own color
        const isHalftime = w.win_type === 'halftime' || w.win_type === 'halftime_reverse'
        const round =
          game.round === 'super_bowl' && isHalftime
            ? 'super_bowl_halftime'
            : (game.round as WinningRound)

        // Only set if new round is higher in hierarchy than existing
        if (round) {
          const existing = winningSquareRounds.get(w.square_id)
          const existingRank = existing ? roundHierarchy[existing] ?? 0 : 0
          const newRank = roundHierarchy[round] ?? 0

          if (newRank > existingRank) {
            winningSquareRounds.set(w.square_id, round)
          }
        }
      }
    }
  })

  // Calculate total claimed squares
  const claimedCount = squares.filter((sq) => sq.user_id).length

  // Group games by round
  const gamesByRound = games.reduce(
    (acc, game) => {
      const round = game.round
      if (!acc[round]) acc[round] = []
      acc[round].push(game)
      return acc
    },
    {} as Record<string, SqGame[]>
  )

  const roundOrder = ['wild_card', 'divisional', 'conference', 'super_bowl']

  // Can claim if: member, pool is open, and numbers not locked
  const canClaim = isMember && pool.status === 'open' && !sqPool.numbers_locked

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Main Content - Grid */}
      <div className="md:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Squares Grid</CardTitle>
                <CardDescription>
                  {sqPool.numbers_locked
                    ? 'Numbers have been revealed!'
                    : 'Claim your squares before numbers are revealed'}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{claimedCount}/100</div>
                <div className="text-xs text-muted-foreground">Squares Claimed</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SquaresGrid
              sqPoolId={sqPool.id}
              poolId={pool.id}
              squares={squares}
              rowNumbers={sqPool.row_numbers}
              colNumbers={sqPool.col_numbers}
              numbersLocked={sqPool.numbers_locked ?? false}
              currentUserId={currentUserId}
              userSquareCount={userSquareCount}
              maxSquaresPerPlayer={sqPool.max_squares_per_player}
              canClaim={canClaim}
              isCommissioner={isCommissioner}
              winningSquareRounds={winningSquareRounds}
              legendMode="full_playoff"
            />
          </CardContent>
        </Card>

        {/* User Stats */}
        {currentUserId && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Your Squares</div>
                  <div className="text-2xl font-bold">
                    {userSquareCount}
                    {sqPool.max_squares_per_player && (
                      <span className="text-muted-foreground text-base font-normal">
                        {' '}
                        / {sqPool.max_squares_per_player}
                      </span>
                    )}
                  </div>
                </div>
                {!sqPool.numbers_locked && canClaim && (
                  <div className="text-sm text-muted-foreground">
                    Click empty squares to claim
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Commissioner Settings or Pool Info */}
        {isCommissioner ? (
          <SquaresPoolSettings
            pool={pool}
            sqPool={sqPool}
            claimedSquaresCount={claimedCount}
            allGamesFinal={games.length > 0 && games.every((g) => g.status === 'final')}
            finalGamesCount={games.filter((g) => g.status === 'final').length}
            totalGamesCount={games.length}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pool Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reverse Scoring</span>
                <span>{sqPool.reverse_scoring ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max per Player</span>
                <span>{sqPool.max_squares_per_player ?? 'Unlimited'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Numbers</span>
                <span>{sqPool.numbers_locked ? 'Locked' : 'Pending'}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard - show if there are any winners */}
        {winners.length > 0 && (
          <PayoutLeaderboard
            squares={squares}
            winners={winners}
            currentUserId={currentUserId}
          />
        )}

        {/* Games List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Games</CardTitle>
            <CardDescription>{games.length} playoff games</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {roundOrder.map((round) => {
              const roundGames = gamesByRound[round]
              if (!roundGames || roundGames.length === 0) return null

              return (
                <div key={round}>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    {getRoundLabel(round)}
                  </div>
                  <div className="space-y-3">
                    {roundGames.map((game) => (
                      <GameScoreCard
                        key={game.id}
                        game={game}
                        sqPoolId={sqPool.id}
                        winners={winners}
                        squares={squares}
                        rowNumbers={sqPool.row_numbers}
                        colNumbers={sqPool.col_numbers}
                        numbersLocked={sqPool.numbers_locked ?? false}
                        reverseScoring={sqPool.reverse_scoring ?? true}
                        currentUserId={currentUserId}
                        isCommissioner={isCommissioner}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {games.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                No games added yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
