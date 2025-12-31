'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EnterSquaresScoreButton } from './enter-squares-score-button'
import { EditGameTeamsButton } from './edit-game-teams-button'
import type { Square } from './squares-grid'

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
}

interface GameScoreCardProps {
  game: SqGame
  sqPoolId: string
  winners: SqWinner[]
  squares: Square[]
  rowNumbers: number[] | null
  colNumbers: number[] | null
  numbersLocked: boolean
  reverseScoring: boolean
  currentUserId: string | null
  isCommissioner: boolean
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
    default:
      return winType
  }
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

export function GameScoreCard({
  game,
  sqPoolId,
  winners,
  squares,
  rowNumbers,
  colNumbers,
  numbersLocked,
  reverseScoring,
  currentUserId,
  isCommissioner,
}: GameScoreCardProps) {
  // Create square lookup by ID
  const squareById = new Map<string, Square>()
  squares.forEach((sq) => {
    if (sq.id) squareById.set(sq.id, sq)
  })

  // Get winners for this game
  const gameWinners = winners.filter((w) => w.sq_game_id === game.id)

  // Find winning square coordinates
  const getWinningCoords = (homeScore: number, awayScore: number) => {
    if (!rowNumbers || !colNumbers) return null
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10
    const rowIdx = rowNumbers.findIndex((n) => n === homeDigit)
    const colIdx = colNumbers.findIndex((n) => n === awayDigit)
    return { row: rowIdx, col: colIdx, homeDigit, awayDigit }
  }

  // Check if current user won this game
  const userWon = gameWinners.some((w) => {
    if (!w.square_id) return false
    const sq = squareById.get(w.square_id)
    return sq?.user_id === currentUserId
  })

  const isFinal = game.status === 'final'
  const hasScores = game.home_score !== null && game.away_score !== null

  return (
    <Card
      className={`overflow-hidden transition-all ${
        userWon
          ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-100'
          : 'hover:shadow-md'
      }`}
    >
      {/* Header - Game name centered with gradient background */}
      <div className={`px-4 py-2 text-center border-b ${
        isFinal
          ? 'bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100'
          : game.status === 'in_progress'
          ? 'bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100'
          : 'bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10'
      }`}>
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {game.game_name}
          </span>
          {isCommissioner && (
            <EditGameTeamsButton
              gameId={game.id}
              gameName={game.game_name}
              homeTeam={game.home_team}
              awayTeam={game.away_team}
            />
          )}
        </div>
        <div className="mt-1">
          {getStatusBadge(game.status)}
        </div>
      </div>

      <CardContent className="p-4">
        {/* Score display */}
        <div className="flex items-center justify-center gap-3">
          {/* Away team */}
          <div className="text-center flex-1">
            <div className="text-sm font-semibold truncate text-foreground">{game.away_team}</div>
            <div className={`text-4xl font-bold tabular-nums mt-1 ${
              hasScores && game.away_score! > game.home_score!
                ? 'text-primary'
                : 'text-foreground'
            }`}>
              {hasScores ? game.away_score : '-'}
            </div>
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center px-2">
            <div className="w-px h-6 bg-border" />
            <span className="text-xs font-medium text-muted-foreground py-1">VS</span>
            <div className="w-px h-6 bg-border" />
          </div>

          {/* Home team */}
          <div className="text-center flex-1">
            <div className="text-sm font-semibold truncate text-foreground">{game.home_team}</div>
            <div className={`text-4xl font-bold tabular-nums mt-1 ${
              hasScores && game.home_score! > game.away_score!
                ? 'text-primary'
                : 'text-foreground'
            }`}>
              {hasScores ? game.home_score : '-'}
            </div>
          </div>
        </div>

        {/* Halftime score (if applicable) */}
        {game.pays_halftime &&
          game.halftime_home_score !== null &&
          game.halftime_away_score !== null && (
            <div className="text-center text-xs text-muted-foreground mt-3 py-1.5 bg-muted/30 rounded-md">
              Halftime: {game.halftime_away_score} - {game.halftime_home_score}
            </div>
          )}

        {/* In-progress current winner preview */}
        {!isFinal && numbersLocked && rowNumbers && colNumbers && hasScores && game.status === 'in_progress' && (
          <div className="text-center text-xs mt-3 py-1.5 bg-amber-50 text-amber-700 rounded-md font-medium">
            Current winning square: [{game.away_score! % 10}-{game.home_score! % 10}]
          </div>
        )}

        {/* Winners section */}
        {isFinal && numbersLocked && gameWinners.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 text-center">
              Winners
            </div>
            <div className="space-y-1.5">
              {gameWinners.map((winner) => {
                const sq = winner.square_id ? squareById.get(winner.square_id) : null
                const isCurrentUser = sq?.user_id === currentUserId

                // Calculate winning coordinates based on win type
                let coords = null
                if (winner.win_type === 'normal' || winner.win_type === 'reverse') {
                  if (game.home_score !== null && game.away_score !== null) {
                    if (winner.win_type === 'normal') {
                      coords = getWinningCoords(game.home_score, game.away_score)
                    } else {
                      coords = getWinningCoords(game.away_score, game.home_score)
                    }
                  }
                } else if (winner.win_type === 'halftime' || winner.win_type === 'halftime_reverse') {
                  if (game.halftime_home_score !== null && game.halftime_away_score !== null) {
                    if (winner.win_type === 'halftime') {
                      coords = getWinningCoords(game.halftime_home_score, game.halftime_away_score)
                    } else {
                      coords = getWinningCoords(game.halftime_away_score, game.halftime_home_score)
                    }
                  }
                }

                return (
                  <div
                    key={winner.id}
                    className={`flex items-center justify-between text-sm p-2 rounded-md ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-amber-100 to-amber-50 font-medium ring-1 ring-amber-200'
                        : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getWinTypeLabel(winner.win_type)}
                      </Badge>
                      {coords && (
                        <span className="text-muted-foreground font-mono text-xs">
                          [{coords.awayDigit}-{coords.homeDigit}]
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={isCurrentUser ? 'text-amber-700' : ''}>
                        {sq?.owner_name || 'Unknown'}
                      </span>
                      {isCurrentUser && <span className="text-amber-600 text-xs">🏆</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Commissioner controls at bottom */}
      {isCommissioner && numbersLocked && (
        <div className="px-4 py-2 bg-muted/30 border-t flex justify-end">
          <EnterSquaresScoreButton
            gameId={game.id}
            sqPoolId={sqPoolId}
            gameName={game.game_name}
            homeTeam={game.home_team}
            awayTeam={game.away_team}
            currentHomeScore={game.home_score}
            currentAwayScore={game.away_score}
            currentHalftimeHomeScore={game.halftime_home_score}
            currentHalftimeAwayScore={game.halftime_away_score}
            currentStatus={game.status}
            paysHalftime={game.pays_halftime ?? false}
            reverseScoring={reverseScoring}
            rowNumbers={rowNumbers}
            colNumbers={colNumbers}
          />
        </div>
      )}
    </Card>
  )
}
