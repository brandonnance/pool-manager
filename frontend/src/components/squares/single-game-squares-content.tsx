'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SquaresGrid, type Square } from './squares-grid'
import { SquaresPoolSettings } from './squares-pool-settings'
import { PayoutLeaderboard } from './payout-leaderboard'
import { SingleGameScoreEntry } from './single-game-score-entry'
import { ScoreChangeLog } from './score-change-log'
import { EditGameTeamsButton } from './edit-game-teams-button'
import type { WinningRound } from './square-cell'

interface SqPool {
  id: string
  pool_id: string
  reverse_scoring: boolean | null
  max_squares_per_player: number | null
  numbers_locked: boolean | null
  row_numbers: number[] | null
  col_numbers: number[] | null
  mode: string | null
  scoring_mode: string | null
  q1_payout: number | null
  halftime_payout: number | null
  q3_payout: number | null
  final_payout: number | null
  per_change_payout: number | null
  final_bonus_payout: number | null
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
  q1_home_score: number | null
  q1_away_score: number | null
  q3_home_score: number | null
  q3_away_score: number | null
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
}

interface ScoreChange {
  id: string
  sq_game_id: string | null
  home_score: number
  away_score: number
  change_order: number
  created_at: string | null
}

interface SingleGameSquaresContentProps {
  pool: {
    id: string
    name: string
    status: string
    visibility: string
  }
  sqPool: SqPool
  squares: Square[]
  game: SqGame
  winners: SqWinner[]
  scoreChanges: ScoreChange[]
  currentUserId: string | null
  isCommissioner: boolean
  isMember: boolean
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'final':
      return <Badge variant="secondary">Final</Badge>
    case 'in_progress':
      return <Badge className="bg-amber-500 hover:bg-amber-500">Live</Badge>
    default:
      return <Badge variant="outline">Scheduled</Badge>
  }
}

function getWinTypeLabel(winType: string): string {
  switch (winType) {
    case 'normal':
      return 'Final'
    case 'reverse':
      return 'Reverse'
    case 'halftime':
      return 'Halftime'
    case 'halftime_reverse':
      return 'HT Reverse'
    case 'q1':
      return 'Q1'
    case 'q1_reverse':
      return 'Q1 Reverse'
    case 'q3':
      return 'Q3'
    case 'q3_reverse':
      return 'Q3 Reverse'
    case 'score_change':
      return 'Score'
    case 'score_change_reverse':
      return 'Score Rev'
    case 'score_change_final':
      return 'Final'
    case 'score_change_final_reverse':
      return 'Final Rev'
    default:
      return winType
  }
}

export function SingleGameSquaresContent({
  pool,
  sqPool,
  squares,
  game,
  winners,
  scoreChanges,
  currentUserId,
  isCommissioner,
  isMember,
}: SingleGameSquaresContentProps) {
  // Count squares owned by current user
  const userSquareCount = currentUserId
    ? squares.filter((sq) => sq.user_id === currentUserId).length
    : 0

  const isQuarterMode = sqPool.scoring_mode === 'quarter'
  const isScoreChangeMode = sqPool.scoring_mode === 'score_change'

  // Build winning square rounds map
  // For single game score_change mode, track forward vs reverse wins
  const winningSquareRounds = new Map<string, WinningRound>()

  if (isScoreChangeMode) {
    // Track which squares have forward and/or reverse wins (regular score changes)
    const forwardWins = new Set<string>()
    const reverseWins = new Set<string>()
    // Track final score winners separately
    const finalForwardWins = new Set<string>()
    const finalReverseWins = new Set<string>()

    winners.forEach((w) => {
      if (w.square_id) {
        if (w.win_type === 'score_change') {
          forwardWins.add(w.square_id)
        } else if (w.win_type === 'score_change_reverse') {
          reverseWins.add(w.square_id)
        } else if (w.win_type === 'score_change_final') {
          finalForwardWins.add(w.square_id)
        } else if (w.win_type === 'score_change_final_reverse') {
          finalReverseWins.add(w.square_id)
        }
      }
    })

    // First, handle final score winners (purple) - these take precedence
    const allFinalSquares = new Set([...finalForwardWins, ...finalReverseWins])
    allFinalSquares.forEach((squareId) => {
      const hasFinalForward = finalForwardWins.has(squareId)
      const hasFinalReverse = finalReverseWins.has(squareId)

      if (hasFinalForward && hasFinalReverse) {
        winningSquareRounds.set(squareId, 'score_change_final_both')
      } else if (hasFinalForward) {
        winningSquareRounds.set(squareId, 'score_change_final')
      } else if (hasFinalReverse) {
        winningSquareRounds.set(squareId, 'score_change_final_reverse')
      }
    })

    // Then handle regular score change winners (only if not already a final winner)
    const allWinningSquares = new Set([...forwardWins, ...reverseWins])
    allWinningSquares.forEach((squareId) => {
      // Skip if already marked as final winner
      if (winningSquareRounds.has(squareId)) return

      const hasForward = forwardWins.has(squareId)
      const hasReverse = reverseWins.has(squareId)

      if (hasForward && hasReverse) {
        winningSquareRounds.set(squareId, 'score_change_both')
      } else if (hasForward) {
        winningSquareRounds.set(squareId, 'score_change_forward')
      } else if (hasReverse) {
        winningSquareRounds.set(squareId, 'score_change_reverse')
      }
    })
  } else {
    // Quarter mode - use single_game color for all winners
    winners.forEach((w) => {
      if (w.square_id) {
        winningSquareRounds.set(w.square_id, 'single_game' as WinningRound)
      }
    })
  }

  // Calculate total claimed squares
  const claimedCount = squares.filter((sq) => sq.user_id).length

  // Can claim if: member, pool is open, and numbers not locked
  const canClaim = isMember && pool.status === 'open' && !sqPool.numbers_locked

  // Create square lookup for winner display
  const squareById = new Map<string, Square>()
  squares.forEach((sq) => {
    if (sq.id) squareById.set(sq.id, sq)
  })

  const hasScores = game.home_score !== null && game.away_score !== null
  const isFinal = game.status === 'final'

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Main Content - Grid and Game */}
      <div className="md:col-span-2 space-y-4">
        {/* Game Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{game.game_name}</CardTitle>
                <div className="flex items-center gap-1">
                  <CardDescription>{game.away_team} @ {game.home_team}</CardDescription>
                  {isCommissioner && (
                    <EditGameTeamsButton
                      gameId={game.id}
                      gameName={game.game_name}
                      homeTeam={game.home_team}
                      awayTeam={game.away_team}
                    />
                  )}
                </div>
              </div>
              {getStatusBadge(game.status)}
            </div>
          </CardHeader>
          <CardContent>
            {/* Main Score Display */}
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="text-center flex-1">
                <div className="text-sm font-medium text-muted-foreground mb-1">{game.away_team}</div>
                <div className={`text-5xl font-bold tabular-nums ${
                  hasScores && game.away_score! > game.home_score!
                    ? 'text-primary'
                    : 'text-foreground'
                }`}>
                  {hasScores ? game.away_score : '-'}
                </div>
              </div>
              <div className="text-2xl font-light text-muted-foreground">@</div>
              <div className="text-center flex-1">
                <div className="text-sm font-medium text-muted-foreground mb-1">{game.home_team}</div>
                <div className={`text-5xl font-bold tabular-nums ${
                  hasScores && game.home_score! > game.away_score!
                    ? 'text-primary'
                    : 'text-foreground'
                }`}>
                  {hasScores ? game.home_score : '-'}
                </div>
              </div>
            </div>

            {/* Quarter Scores (Quarter Mode) */}
            {isQuarterMode && (
              <div className="grid grid-cols-4 gap-2 py-3 border-t">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Q1</div>
                  <div className="text-sm font-medium">
                    {game.q1_away_score !== null && game.q1_home_score !== null
                      ? `${game.q1_away_score}-${game.q1_home_score}`
                      : '-'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Half</div>
                  <div className="text-sm font-medium">
                    {game.halftime_away_score !== null && game.halftime_home_score !== null
                      ? `${game.halftime_away_score}-${game.halftime_home_score}`
                      : '-'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Q3</div>
                  <div className="text-sm font-medium">
                    {game.q3_away_score !== null && game.q3_home_score !== null
                      ? `${game.q3_away_score}-${game.q3_home_score}`
                      : '-'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Final</div>
                  <div className="text-sm font-medium">
                    {game.away_score !== null && game.home_score !== null
                      ? `${game.away_score}-${game.home_score}`
                      : '-'}
                  </div>
                </div>
              </div>
            )}

            {/* In-progress winning square preview */}
            {!isFinal && sqPool.numbers_locked && sqPool.row_numbers && sqPool.col_numbers && hasScores && game.status === 'in_progress' && (
              <div className="text-center text-sm mt-3 py-2 bg-amber-50 text-amber-700 rounded-md font-medium">
                Current winning square: [{game.away_score! % 10}-{game.home_score! % 10}]
              </div>
            )}

            {/* Commissioner Score Entry */}
            {isCommissioner && sqPool.numbers_locked && (
              <div className="mt-4 pt-4 border-t">
                <SingleGameScoreEntry
                  game={game}
                  sqPool={sqPool}
                  scoreChanges={scoreChanges}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Squares Grid */}
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
              homeTeamLabel={game.home_team}
              awayTeamLabel={game.away_team}
              legendMode={isScoreChangeMode ? 'score_change' : 'single_game'}
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
            allGamesFinal={game.status === 'final'}
            finalGamesCount={game.status === 'final' ? 1 : 0}
            totalGamesCount={1}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pool Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scoring Mode</span>
                <span>{isQuarterMode ? 'Quarter Scoring' : 'Every Score'}</span>
              </div>
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

        {/* Final Score Winners - Prominent display when game is final */}
        {isFinal && isScoreChangeMode && (
          <Card className="border-purple-300 bg-gradient-to-br from-purple-50 to-fuchsia-50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <CardTitle className="text-base text-purple-800">Final Score Winners</CardTitle>
              </div>
              <CardDescription className="text-purple-600">
                {game.away_team} {game.away_score} - {game.home_score} {game.home_team}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Forward Winner */}
              {winners.filter(w => w.win_type === 'score_change_final').map((winner) => {
                const sq = winner.square_id ? squareById.get(winner.square_id) : null
                const isCurrentUser = sq?.user_id === currentUserId
                const winningDigits = hasScores ? `[${game.away_score! % 10}-${game.home_score! % 10}]` : ''

                return (
                  <div
                    key={winner.id}
                    className={`p-3 rounded-lg ${
                      isCurrentUser
                        ? 'bg-purple-200 border-2 border-purple-400 ring-2 ring-purple-300'
                        : 'bg-purple-100 border border-purple-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-600 hover:bg-purple-600">Final</Badge>
                        <span className="text-xs text-purple-600 font-mono">{winningDigits}</span>
                      </div>
                      {isCurrentUser && <span className="text-lg">🎉</span>}
                    </div>
                    <div className={`text-lg font-bold mt-1 ${isCurrentUser ? 'text-purple-800' : 'text-purple-700'}`}>
                      {sq?.owner_name || 'Unknown'}
                    </div>
                  </div>
                )
              })}

              {/* Reverse Winner */}
              {sqPool.reverse_scoring && winners.filter(w => w.win_type === 'score_change_final_reverse').map((winner) => {
                const sq = winner.square_id ? squareById.get(winner.square_id) : null
                const isCurrentUser = sq?.user_id === currentUserId
                const winningDigits = hasScores ? `[${game.home_score! % 10}-${game.away_score! % 10}]` : ''

                return (
                  <div
                    key={winner.id}
                    className={`p-3 rounded-lg ${
                      isCurrentUser
                        ? 'bg-fuchsia-200 border-2 border-fuchsia-400 ring-2 ring-fuchsia-300'
                        : 'bg-fuchsia-100 border border-fuchsia-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-fuchsia-600 hover:bg-fuchsia-600">Final Reverse</Badge>
                        <span className="text-xs text-fuchsia-600 font-mono">{winningDigits}</span>
                      </div>
                      {isCurrentUser && <span className="text-lg">🎉</span>}
                    </div>
                    <div className={`text-lg font-bold mt-1 ${isCurrentUser ? 'text-fuchsia-800' : 'text-fuchsia-700'}`}>
                      {sq?.owner_name || 'Unknown'}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Score Change Log (Score Change Mode) - in sidebar */}
        {isScoreChangeMode && scoreChanges.length > 0 && (
          <ScoreChangeLog
            scoreChanges={scoreChanges}
            winners={winners}
            squares={squares}
            rowNumbers={sqPool.row_numbers}
            colNumbers={sqPool.col_numbers}
            reverseScoring={sqPool.reverse_scoring ?? true}
            currentUserId={currentUserId}
          />
        )}

        {/* Leaderboard */}
        {winners.length > 0 && (
          <PayoutLeaderboard
            squares={squares}
            winners={winners}
            currentUserId={currentUserId}
          />
        )}

        {/* Winners List */}
        {winners.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Winners</CardTitle>
              <CardDescription>{winners.length} winning squares</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {winners.map((winner) => {
                const sq = winner.square_id ? squareById.get(winner.square_id) : null
                const isCurrentUser = sq?.user_id === currentUserId

                return (
                  <div
                    key={winner.id}
                    className={`flex items-center justify-between text-sm p-2 rounded-md ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-amber-100 to-amber-50 font-medium ring-1 ring-amber-200'
                        : 'bg-muted/50'
                    }`}
                  >
                    <Badge variant="outline" className="text-xs">
                      {getWinTypeLabel(winner.win_type)}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className={isCurrentUser ? 'text-amber-700' : ''}>
                        {sq?.owner_name || 'Unknown'}
                      </span>
                      {isCurrentUser && <span className="text-amber-600 text-xs">🏆</span>}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
