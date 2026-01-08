'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { MmGame, MmEntry, MmPoolTeam } from './game-card'

interface BracketViewProps {
  games: MmGame[]
  entries: MmEntry[]
  poolTeams: MmPoolTeam[]
  currentUserId: string | null
}

// Round order for display
const ROUND_ORDER = ['R64', 'R32', 'S16', 'E8', 'F4', 'FINAL'] as const
const ROUND_LABELS: Record<string, string> = {
  R64: 'Round of 64',
  R32: 'Round of 32',
  S16: 'Sweet 16',
  E8: 'Elite 8',
  F4: 'Final Four',
  FINAL: 'Championship',
}

interface GameSlotProps {
  game: MmGame | null
  poolTeams: MmPoolTeam[]
  entries: MmEntry[]
  currentUserId: string | null
  compact?: boolean
}

function GameSlot({ game, poolTeams, entries, currentUserId, compact }: GameSlotProps) {
  if (!game) {
    return (
      <div className={`border border-dashed rounded-md bg-muted/20 ${
        compact ? 'p-1.5' : 'p-2'
      }`}>
        <div className="text-xs text-muted-foreground text-center">TBD</div>
      </div>
    )
  }

  const higherTeam = poolTeams.find(t => t.id === game.higher_seed_team_id)
  const lowerTeam = poolTeams.find(t => t.id === game.lower_seed_team_id)
  const higherEntry = entries.find(e => e.id === game.higher_seed_entry_id)
  const lowerEntry = entries.find(e => e.id === game.lower_seed_entry_id)
  const advancingEntry = entries.find(e => e.id === game.advancing_entry_id)

  const isFinal = game.status === 'final'
  const userIsInvolved =
    higherEntry?.user_id === currentUserId || lowerEntry?.user_id === currentUserId
  const userAdvanced = advancingEntry?.user_id === currentUserId

  // Determine winner
  let winner: 'higher' | 'lower' | null = null
  if (isFinal && game.higher_seed_score !== null && game.lower_seed_score !== null) {
    winner = game.higher_seed_score > game.lower_seed_score ? 'higher' : 'lower'
  }

  return (
    <div
      className={`border rounded-md ${
        userAdvanced
          ? 'border-emerald-400 bg-emerald-50'
          : userIsInvolved && isFinal && !userAdvanced
          ? 'border-red-300 bg-red-50'
          : userIsInvolved
          ? 'border-sky-300 bg-sky-50'
          : 'bg-background'
      } ${compact ? 'p-1.5' : 'p-2'}`}
    >
      {/* Higher seed */}
      <div
        className={`flex items-center justify-between gap-1 ${
          compact ? 'text-xs' : 'text-sm'
        } ${winner === 'higher' ? 'font-semibold' : ''}`}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-muted-foreground font-mono text-xs">
            {higherTeam?.seed || '?'}
          </span>
          <span className="truncate">
            {higherTeam?.bb_teams?.abbrev || higherTeam?.bb_teams?.name?.slice(0, 10) || 'TBD'}
          </span>
        </div>
        {game.higher_seed_score !== null && (
          <span className="font-mono">{game.higher_seed_score}</span>
        )}
      </div>

      {/* Divider */}
      <div className="border-t my-1" />

      {/* Lower seed */}
      <div
        className={`flex items-center justify-between gap-1 ${
          compact ? 'text-xs' : 'text-sm'
        } ${winner === 'lower' ? 'font-semibold' : ''}`}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-muted-foreground font-mono text-xs">
            {lowerTeam?.seed || '?'}
          </span>
          <span className="truncate">
            {lowerTeam?.bb_teams?.abbrev || lowerTeam?.bb_teams?.name?.slice(0, 10) || 'TBD'}
          </span>
        </div>
        {game.lower_seed_score !== null && (
          <span className="font-mono">{game.lower_seed_score}</span>
        )}
      </div>

      {/* Status indicator */}
      {game.status === 'in_progress' && (
        <div className="mt-1">
          <Badge className="text-xs bg-amber-500 h-4 px-1">Live</Badge>
        </div>
      )}
    </div>
  )
}

export function BracketView({
  games,
  entries,
  poolTeams,
  currentUserId,
}: BracketViewProps) {
  // Group games by round
  const gamesByRound = new Map<string, MmGame[]>()
  ROUND_ORDER.forEach(round => {
    gamesByRound.set(
      round,
      games.filter(g => g.round === round).sort((a, b) => (a.game_number || 0) - (b.game_number || 0))
    )
  })

  // Check if bracket is empty
  const totalGames = games.length
  if (totalGames === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No games scheduled yet. Set up teams and run the draw to generate the bracket.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Round-by-round view (mobile-friendly) */}
      <div className="space-y-6">
        {ROUND_ORDER.map(round => {
          const roundGames = gamesByRound.get(round) || []
          if (roundGames.length === 0) return null

          return (
            <div key={round}>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                {ROUND_LABELS[round]}
                <Badge variant="secondary" className="text-xs">
                  {roundGames.filter(g => g.status === 'final').length}/{roundGames.length} complete
                </Badge>
              </h3>

              <div className={`grid gap-3 ${
                round === 'FINAL'
                  ? 'grid-cols-1 max-w-md mx-auto'
                  : round === 'F4'
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
                  : round === 'E8'
                  ? 'grid-cols-2 sm:grid-cols-4'
                  : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8'
              }`}>
                {roundGames.map(game => (
                  <GameSlot
                    key={game.id}
                    game={game}
                    poolTeams={poolTeams}
                    entries={entries}
                    currentUserId={currentUserId}
                    compact={round === 'R64' || round === 'R32'}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-sky-100 border border-sky-300" />
          <span>Your game</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400" />
          <span>You advanced</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-50 border border-red-300" />
          <span>You eliminated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className="bg-amber-500 h-4 px-1 text-xs">Live</Badge>
          <span>In progress</span>
        </div>
      </div>
    </div>
  )
}
