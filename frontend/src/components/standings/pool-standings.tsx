'use client'

import { Badge } from '@/components/ui/badge'

interface EntryStanding {
  entry_id: string
  display_name: string
  total_score: number
  correct_picks: number
  wrong_picks: number
  pending_picks: number
}

interface PoolStandingsProps {
  standings: EntryStanding[]
  currentUserId?: string
  isCompleted?: boolean
}

export function PoolStandings({ standings, currentUserId, isCompleted = false }: PoolStandingsProps) {
  if (standings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries yet. Be the first to join!
      </div>
    )
  }

  // Sort by total score descending
  const sortedStandings = [...standings].sort((a, b) => b.total_score - a.total_score)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Rank
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Score
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
              W-L
            </th>
            {!isCompleted && (
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pending
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {sortedStandings.map((entry, index) => {
            // Handle ties - same rank for same score
            let rank = index + 1
            if (index > 0 && sortedStandings[index - 1].total_score === entry.total_score) {
              // Find the first entry with this score
              const firstWithScore = sortedStandings.findIndex(e => e.total_score === entry.total_score)
              rank = firstWithScore + 1
            }

            const isCurrentUser = entry.display_name === currentUserId
            const isWinner = isCompleted && rank === 1

            return (
              <tr
                key={entry.entry_id}
                className={
                  isWinner
                    ? 'bg-amber-50'
                    : isCurrentUser
                    ? 'bg-primary/5'
                    : undefined
                }
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                  {isWinner ? (
                    <span className="flex items-center gap-1">
                      <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.617 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.018 1 1 0 01-.285-1.05l1.715-5.349L10 6.417l-3.763 1.166 1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.018 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274zM10 18a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span className="font-bold text-amber-700">1</span>
                    </span>
                  ) : (
                    rank
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                  <span className={isWinner ? 'font-bold text-amber-700' : ''}>
                    {entry.display_name}
                  </span>
                  {isCurrentUser && (
                    <Badge variant="outline" className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">
                      You
                    </Badge>
                  )}
                  {isWinner && (
                    <Badge className="ml-2 text-xs bg-amber-100 text-amber-700 border-amber-200">
                      Champion!
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold">
                  <span className={isWinner ? 'text-amber-700' : entry.total_score >= 0 ? 'text-primary' : 'text-destructive'}>
                    {entry.total_score > 0 ? '+' : ''}{entry.total_score}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-muted-foreground">
                  {entry.correct_picks}-{entry.wrong_picks}
                </td>
                {!isCompleted && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-muted-foreground">
                    {entry.pending_picks}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
