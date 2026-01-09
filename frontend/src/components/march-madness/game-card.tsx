'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export interface MmGame {
  id: string
  mm_pool_id: string
  round: string
  region: string | null
  game_number: number | null
  higher_seed_team_id: string | null
  lower_seed_team_id: string | null
  spread: number | null
  higher_seed_score: number | null
  lower_seed_score: number | null
  status: string
  winning_team_id: string | null
  spread_covering_team_id: string | null
  higher_seed_entry_id: string | null
  lower_seed_entry_id: string | null
  advancing_entry_id: string | null
  scheduled_time: string | null
}

export interface MmPoolTeam {
  id: string
  mm_pool_id: string
  team_id: string
  seed: number
  region: string
  eliminated: boolean
  eliminated_round: string | null
  bb_teams: { id: string; name: string; abbrev: string | null } | null
}

export interface MmEntry {
  id: string
  mm_pool_id: string
  user_id: string | null
  current_team_id: string | null
  original_team_id: string | null
  eliminated: boolean
  eliminated_round: string | null
  display_name: string | null
  total_payout: number
}

interface GameCardProps {
  game: MmGame
  poolTeams: MmPoolTeam[]
  entries: MmEntry[]
  currentUserId: string | null
  isCommissioner: boolean
  onEnterScore?: () => void
  onEnterSpread?: () => void
}

function getRoundLabel(round: string): string {
  switch (round) {
    case 'R64':
      return 'Round of 64'
    case 'R32':
      return 'Round of 32'
    case 'S16':
      return 'Sweet 16'
    case 'E8':
      return 'Elite 8'
    case 'F4':
      return 'Final Four'
    case 'FINAL':
      return 'Championship'
    default:
      return round
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'final':
      return <Badge variant="secondary">Final</Badge>
    case 'in_progress':
      return <Badge className="bg-amber-500 hover:bg-amber-500">Live</Badge>
    default:
      return <Badge variant="outline">Scheduled</Badge>
  }
}

export function GameCard({
  game,
  poolTeams,
  entries,
  currentUserId,
  isCommissioner,
  onEnterScore,
  onEnterSpread,
}: GameCardProps) {
  // Get team info
  const higherSeedTeam = poolTeams.find(t => t.id === game.higher_seed_team_id)
  const lowerSeedTeam = poolTeams.find(t => t.id === game.lower_seed_team_id)

  // Get entry info (who owns each team)
  const higherSeedEntry = entries.find(e => e.id === game.higher_seed_entry_id)
  const lowerSeedEntry = entries.find(e => e.id === game.lower_seed_entry_id)

  // Check if current user is involved
  const userIsHigherSeed = higherSeedEntry?.user_id === currentUserId
  const userIsLowerSeed = lowerSeedEntry?.user_id === currentUserId
  const userIsInvolved = userIsHigherSeed || userIsLowerSeed

  // Check if user advanced
  const advancingEntry = entries.find(e => e.id === game.advancing_entry_id)
  const userAdvanced = advancingEntry?.user_id === currentUserId

  const isFinal = game.status === 'final'
  const hasScores = game.higher_seed_score !== null && game.lower_seed_score !== null
  const hasSpread = game.spread !== null

  // Determine winner and spread cover
  let winner: 'higher' | 'lower' | null = null
  let spreadCover: 'higher' | 'lower' | null = null

  if (hasScores && isFinal) {
    winner = game.higher_seed_score! > game.lower_seed_score! ? 'higher' : 'lower'

    if (hasSpread) {
      // Spread is negative when higher seed is favored
      // higher_seed_score + spread vs lower_seed_score
      const adjustedHigherScore = game.higher_seed_score! + game.spread!
      spreadCover = adjustedHigherScore > game.lower_seed_score! ? 'higher' : 'lower'
    }
  }

  // Spread upset: winner !== spread coverer (team won but their owner doesn't advance)
  const isSpreadUpset = isFinal && winner !== null && spreadCover !== null && winner !== spreadCover

  // For higher seed: spread upset if they won but lower covered, OR they lost but they covered
  const higherSpreadUpset = isSpreadUpset && (winner === 'higher' || spreadCover === 'higher')
  // For lower seed: spread upset if they won but higher covered, OR they lost but they covered
  const lowerSpreadUpset = isSpreadUpset && (winner === 'lower' || spreadCover === 'lower')

  return (
    <Card
      className={`overflow-hidden transition-all ${
        userAdvanced
          ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-100'
          : userIsInvolved && isFinal && !userAdvanced
          ? 'ring-2 ring-red-300 shadow-lg shadow-red-100'
          : userIsInvolved
          ? 'ring-2 ring-sky-300 shadow-md'
          : 'hover:shadow-md'
      }`}
    >
      {/* Header */}
      <div className={`px-4 py-2 text-center border-b ${
        isFinal
          ? 'bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100'
          : game.status === 'in_progress'
          ? 'bg-gradient-to-r from-amber-100 via-amber-50 to-amber-100'
          : 'bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10'
      }`}>
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {getRoundLabel(game.round)} {game.region && `- ${game.region}`}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-center gap-2">
          {getStatusBadge(game.status)}
          {hasSpread && (
            <Badge variant="outline" className="text-xs">
              Spread: {game.spread! > 0 ? '+' : ''}{game.spread}
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        {/* Teams and scores */}
        <div className="space-y-3">
          {/* Higher seed team */}
          <div className={`flex items-center justify-between p-2 rounded-lg ${
            higherSpreadUpset && winner === 'higher'
              ? 'bg-amber-50 border border-amber-300' // Team won but owner eliminated (spread upset)
              : winner === 'higher' && !isSpreadUpset
              ? 'bg-emerald-50 border border-emerald-200' // Normal win + cover
              : isFinal && winner === 'lower'
              ? 'bg-muted/40 border border-muted' // Team lost (even if owner advances via spread)
              : userIsHigherSeed
              ? 'bg-sky-50 border border-sky-200'
              : 'bg-muted/30'
          }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold bg-muted px-1.5 py-0.5 rounded ${
                  higherSpreadUpset && winner === 'higher' ? 'text-amber-700' : winner === 'higher' ? 'text-emerald-700' : 'text-muted-foreground'
                } ${isFinal && winner === 'lower' ? 'opacity-50' : ''}`}>
                  #{higherSeedTeam?.seed || '?'}
                </span>
                <span className={`font-semibold truncate ${
                  higherSpreadUpset && winner === 'higher' ? 'text-amber-700' : winner === 'higher' ? 'text-emerald-700' : ''
                } ${isFinal && winner === 'lower' ? 'line-through decoration-red-400/70 text-muted-foreground' : ''}`}>
                  {higherSeedTeam?.bb_teams?.name || 'TBD'}
                </span>
              </div>
              <div className={`text-xs mt-0.5 truncate text-muted-foreground ${isFinal && advancingEntry?.id !== higherSeedEntry?.id ? 'line-through decoration-red-400/70' : ''}`}>
                {higherSeedEntry?.display_name || 'Unassigned'}
                {userIsHigherSeed && <span className="ml-1 text-sky-600">(You)</span>}
              </div>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${
              higherSpreadUpset && winner === 'higher' ? 'text-amber-700' : winner === 'higher' ? 'text-emerald-700' : ''
            } ${isFinal && winner === 'lower' ? 'opacity-50' : ''}`}>
              {game.higher_seed_score ?? '-'}
            </div>
          </div>

          {/* VS divider */}
          <div className="flex items-center justify-center">
            <div className="flex-1 h-px bg-border" />
            <span className="px-3 text-xs font-medium text-muted-foreground">VS</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Lower seed team */}
          <div className={`flex items-center justify-between p-2 rounded-lg ${
            lowerSpreadUpset && winner === 'lower'
              ? 'bg-amber-50 border border-amber-300' // Team won but owner eliminated (spread upset)
              : winner === 'lower' && !isSpreadUpset
              ? 'bg-emerald-50 border border-emerald-200' // Normal win + cover
              : isFinal && winner === 'higher'
              ? 'bg-muted/40 border border-muted' // Team lost (even if owner advances via spread)
              : userIsLowerSeed
              ? 'bg-sky-50 border border-sky-200'
              : 'bg-muted/30'
          }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold bg-muted px-1.5 py-0.5 rounded ${
                  lowerSpreadUpset && winner === 'lower' ? 'text-amber-700' : winner === 'lower' ? 'text-emerald-700' : 'text-muted-foreground'
                } ${isFinal && winner === 'higher' ? 'opacity-50' : ''}`}>
                  #{lowerSeedTeam?.seed || '?'}
                </span>
                <span className={`font-semibold truncate ${
                  lowerSpreadUpset && winner === 'lower' ? 'text-amber-700' : winner === 'lower' ? 'text-emerald-700' : ''
                } ${isFinal && winner === 'higher' ? 'line-through decoration-red-400/70 text-muted-foreground' : ''}`}>
                  {lowerSeedTeam?.bb_teams?.name || 'TBD'}
                </span>
              </div>
              <div className={`text-xs mt-0.5 truncate text-muted-foreground ${isFinal && advancingEntry?.id !== lowerSeedEntry?.id ? 'line-through decoration-red-400/70' : ''}`}>
                {lowerSeedEntry?.display_name || 'Unassigned'}
                {userIsLowerSeed && <span className="ml-1 text-sky-600">(You)</span>}
              </div>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${
              lowerSpreadUpset && winner === 'lower' ? 'text-amber-700' : winner === 'lower' ? 'text-emerald-700' : ''
            } ${isFinal && winner === 'higher' ? 'opacity-50' : ''}`}>
              {game.lower_seed_score ?? '-'}
            </div>
          </div>
        </div>

        {/* Spread Cover Result */}
        {isFinal && spreadCover && (
          <div className={`mt-4 p-2 rounded-lg text-center text-sm ${
            isSpreadUpset
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            <span className="font-semibold">
              {spreadCover === 'higher' ? higherSeedTeam?.bb_teams?.name : lowerSeedTeam?.bb_teams?.name}
            </span>
            {' '}covered the spread
            {isSpreadUpset && (
              <span className="block text-xs mt-0.5 font-medium">
                Spread upset! {spreadCover === 'higher' ? higherSeedEntry?.display_name : lowerSeedEntry?.display_name} advances with {winner === 'higher' ? higherSeedTeam?.bb_teams?.name : lowerSeedTeam?.bb_teams?.name}
              </span>
            )}
          </div>
        )}

        {/* Advancing entry */}
        {isFinal && advancingEntry && (
          <div className={`mt-3 p-2 rounded-lg text-center text-sm font-medium ${
            userAdvanced && isSpreadUpset
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : userAdvanced
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : isSpreadUpset
              ? 'bg-amber-50 text-amber-800 border border-amber-200'
              : 'bg-muted text-foreground'
          }`}>
            {userAdvanced ? '🎉 You advance!' : `${advancingEntry.display_name} advances`}
          </div>
        )}

        {/* Commissioner controls */}
        {isCommissioner && (
          <div className="mt-4 pt-3 border-t flex gap-2">
            {!hasSpread && game.status === 'scheduled' && onEnterSpread && (
              <button
                onClick={onEnterSpread}
                className="flex-1 text-xs px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-md transition-colors"
              >
                Enter Spread
              </button>
            )}
            {onEnterScore && (
              <button
                onClick={onEnterScore}
                className="flex-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
              >
                {hasScores ? 'Edit Score' : 'Enter Score'}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
