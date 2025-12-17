'use client'

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
}

export function PoolStandings({ standings, currentUserId }: PoolStandingsProps) {
  if (standings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No entries yet. Be the first to join!
      </div>
    )
  }

  // Sort by total score descending
  const sortedStandings = [...standings].sort((a, b) => b.total_score - a.total_score)

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rank
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Score
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              W-L
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pending
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedStandings.map((entry, index) => {
            // Handle ties - same rank for same score
            let rank = index + 1
            if (index > 0 && sortedStandings[index - 1].total_score === entry.total_score) {
              // Find the first entry with this score
              const firstWithScore = sortedStandings.findIndex(e => e.total_score === entry.total_score)
              rank = firstWithScore + 1
            }

            const isCurrentUser = entry.display_name === currentUserId

            return (
              <tr
                key={entry.entry_id}
                className={isCurrentUser ? 'bg-blue-50' : undefined}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {rank}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {entry.display_name}
                  {isCurrentUser && (
                    <span className="ml-2 text-xs text-blue-600">(You)</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold">
                  <span className={entry.total_score >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {entry.total_score > 0 ? '+' : ''}{entry.total_score}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {entry.correct_picks}-{entry.wrong_picks}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                  {entry.pending_picks}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
