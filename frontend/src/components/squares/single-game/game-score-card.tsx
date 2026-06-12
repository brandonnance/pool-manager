'use client'

import { Badge } from '@/components/ui/badge'
import type { SqGame } from './types'

// Simple Game Score Display Component
export function SimpleGameScoreCard({
  game,
  scoringMode
}: {
  game: SqGame
  scoringMode: string
}) {
  const isFinal = game.status === 'final'
  const isLive = game.status === 'in_progress'

  // For quarter mode, show the most recent available score
  // Priority: final > q3 > halftime > q1
  let displayHomeScore: number | null = null
  let displayAwayScore: number | null = null
  let currentPeriod = ''

  if (scoringMode === 'quarter') {
    if (game.home_score !== null && game.away_score !== null) {
      displayHomeScore = game.home_score
      displayAwayScore = game.away_score
      currentPeriod = 'Final'
    } else if (game.q3_home_score !== null && game.q3_away_score !== null) {
      displayHomeScore = game.q3_home_score
      displayAwayScore = game.q3_away_score
      currentPeriod = 'End Q3'
    } else if (game.halftime_home_score !== null && game.halftime_away_score !== null) {
      displayHomeScore = game.halftime_home_score
      displayAwayScore = game.halftime_away_score
      currentPeriod = 'Halftime'
    } else if (game.q1_home_score !== null && game.q1_away_score !== null) {
      displayHomeScore = game.q1_home_score
      displayAwayScore = game.q1_away_score
      currentPeriod = 'End Q1'
    }
  } else {
    // Score change and hybrid modes use game.home_score/away_score directly
    displayHomeScore = game.home_score
    displayAwayScore = game.away_score
  }

  const hasScores = displayHomeScore !== null && displayAwayScore !== null

  return (
    <div className="bg-muted/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">{game.game_name}</span>
        <div className="flex items-center gap-2">
          {scoringMode === 'quarter' && isLive && currentPeriod && (
            <span className="text-xs text-muted-foreground">{currentPeriod}</span>
          )}
          <Badge variant={isFinal ? 'secondary' : isLive ? 'default' : 'outline'}>
            {isFinal ? 'Final' : isLive ? 'Live' : 'Scheduled'}
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4">
        <div className="text-center flex-1">
          <div className="text-sm font-medium truncate">{game.away_team}</div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {hasScores ? displayAwayScore : '-'}
          </div>
        </div>
        <div className="text-muted-foreground">@</div>
        <div className="text-center flex-1">
          <div className="text-sm font-medium truncate">{game.home_team}</div>
          <div className="text-3xl font-bold tabular-nums mt-1">
            {hasScores ? displayHomeScore : '-'}
          </div>
        </div>
      </div>
      {/* Quarter scores for quarter mode */}
      {scoringMode === 'quarter' && (
        <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-2 text-xs text-center">
          <div>
            <div className="text-muted-foreground">Q1</div>
            <div className="font-mono">
              {game.q1_away_score ?? '-'} - {game.q1_home_score ?? '-'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Half</div>
            <div className="font-mono">
              {game.halftime_away_score ?? '-'} - {game.halftime_home_score ?? '-'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Q3</div>
            <div className="font-mono">
              {game.q3_away_score ?? '-'} - {game.q3_home_score ?? '-'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Final</div>
            <div className="font-mono font-bold">
              {game.away_score ?? '-'} - {game.home_score ?? '-'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
