'use client'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MmEntry, MmPoolTeam } from './game-card'

interface StandingsTableProps {
  entries: MmEntry[]
  poolTeams: MmPoolTeam[]
  currentUserId: string | null
}

function getRoundLabel(round: string | null): string {
  if (!round) return '-'
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

function getStatusBadge(entry: MmEntry) {
  if (entry.eliminated) {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-700">
        Eliminated
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
      Alive
    </Badge>
  )
}

export function StandingsTable({
  entries,
  poolTeams,
  currentUserId,
}: StandingsTableProps) {
  // Sort entries: alive first (sorted by payout desc), then eliminated (sorted by elimination round)
  const sortedEntries = [...entries].sort((a, b) => {
    // Alive entries first
    if (!a.eliminated && b.eliminated) return -1
    if (a.eliminated && !b.eliminated) return 1

    // Among alive entries, sort by payout (desc)
    if (!a.eliminated && !b.eliminated) {
      return b.total_payout - a.total_payout
    }

    // Among eliminated entries, sort by elimination round (later = better)
    const roundOrder = ['R64', 'R32', 'S16', 'E8', 'F4', 'FINAL']
    const aRoundIdx = roundOrder.indexOf(a.eliminated_round || 'R64')
    const bRoundIdx = roundOrder.indexOf(b.eliminated_round || 'R64')
    return bRoundIdx - aRoundIdx
  })

  // Create a team lookup
  const teamById = new Map(poolTeams.map(t => [t.id, t]))

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Current Team</TableHead>
            <TableHead>Original Team</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Payout</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEntries.map((entry, idx) => {
            const currentTeam = entry.current_team_id
              ? teamById.get(entry.current_team_id)
              : null
            const originalTeam = entry.original_team_id
              ? teamById.get(entry.original_team_id)
              : null
            // Only highlight if currentUserId is not null (to avoid null === null being true)
            const isCurrentUser = currentUserId !== null && entry.user_id === currentUserId

            return (
              <TableRow
                key={entry.id}
                className={
                  isCurrentUser
                    ? 'bg-sky-50 hover:bg-sky-100'
                    : entry.eliminated
                    ? 'opacity-60'
                    : ''
                }
              >
                <TableCell className="font-medium">{idx + 1}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={isCurrentUser ? 'font-semibold' : ''}>
                      {entry.display_name || 'Unknown'}
                    </span>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {currentTeam ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-1 py-0.5 rounded">
                        #{currentTeam.seed}
                      </span>
                      <span>{currentTeam.bb_teams?.name || 'Unknown'}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {originalTeam ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-1 py-0.5 rounded">
                        #{originalTeam.seed}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {originalTeam.bb_teams?.name || 'Unknown'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    {getStatusBadge(entry)}
                    {entry.eliminated && entry.eliminated_round && (
                      <span className="text-xs text-muted-foreground">
                        {getRoundLabel(entry.eliminated_round)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {entry.total_payout > 0 ? (
                    <span className="font-semibold text-emerald-600">
                      ${entry.total_payout.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
          {sortedEntries.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No entries yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
