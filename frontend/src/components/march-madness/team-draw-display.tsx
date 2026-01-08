'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MmEntry, MmPoolTeam } from './game-card'

interface TeamDrawDisplayProps {
  entries: MmEntry[]
  poolTeams: MmPoolTeam[]
  currentUserId: string | null
  drawCompleted: boolean
}

const REGIONS = ['East', 'West', 'South', 'Midwest'] as const

export function TeamDrawDisplay({
  entries,
  poolTeams,
  currentUserId,
  drawCompleted,
}: TeamDrawDisplayProps) {
  if (!drawCompleted) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Team Draw Not Completed
          </h3>
          <p className="text-muted-foreground">
            Teams will be randomly assigned once the pool is full (64 entries).
          </p>
          <div className="mt-4">
            <Badge variant="outline" className="text-lg px-4 py-1">
              {entries.length} / 64 Entries
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Create lookups
  const teamById = new Map(poolTeams.map(t => [t.id, t]))
  const entryByTeamId = new Map(
    entries
      .filter(e => e.current_team_id)
      .map(e => [e.current_team_id!, e])
  )

  // Group teams by region
  const teamsByRegion = new Map<string, MmPoolTeam[]>()
  REGIONS.forEach(region => {
    const regionTeams = poolTeams
      .filter(t => t.region === region)
      .sort((a, b) => a.seed - b.seed)
    teamsByRegion.set(region, regionTeams)
  })

  // Find current user's entry
  const userEntry = entries.find(e => e.user_id === currentUserId)
  const userCurrentTeam = userEntry?.current_team_id
    ? teamById.get(userEntry.current_team_id)
    : null
  const userOriginalTeam = userEntry?.original_team_id
    ? teamById.get(userEntry.original_team_id)
    : null

  return (
    <div className="space-y-6">
      {/* User's team highlight */}
      {userEntry && userCurrentTeam && (
        <Card className="border-sky-300 bg-sky-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Your Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded">
                    #{userCurrentTeam.seed} {userCurrentTeam.region}
                  </span>
                  <span className="text-xl font-bold">
                    {userCurrentTeam.bb_teams?.name || 'Unknown'}
                  </span>
                </div>
                {userOriginalTeam && userOriginalTeam.id !== userCurrentTeam.id && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Originally: #{userOriginalTeam.seed} {userOriginalTeam.bb_teams?.name}
                  </p>
                )}
              </div>
              <Badge
                variant={userEntry.eliminated ? 'secondary' : 'default'}
                className={userEntry.eliminated ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}
              >
                {userEntry.eliminated ? 'Eliminated' : 'Alive'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All teams by region */}
      <div className="grid gap-4 md:grid-cols-2">
        {REGIONS.map(region => {
          const regionTeams = teamsByRegion.get(region) || []

          return (
            <Card key={region}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{region} Region</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {regionTeams.map(team => {
                    const entry = entryByTeamId.get(team.id)
                    const isUserTeam = team.id === userCurrentTeam?.id

                    return (
                      <div
                        key={team.id}
                        className={`flex items-center justify-between p-2 rounded-md text-sm ${
                          isUserTeam
                            ? 'bg-sky-100 border border-sky-300'
                            : team.eliminated
                            ? 'bg-muted/30 opacity-50'
                            : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-bold text-muted-foreground w-6 text-center">
                            {team.seed}
                          </span>
                          <span className={`truncate ${team.eliminated ? 'line-through' : ''}`}>
                            {team.bb_teams?.name || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {entry && (
                            <span className={`text-xs truncate max-w-24 ${
                              isUserTeam ? 'font-semibold text-sky-700' : 'text-muted-foreground'
                            }`}>
                              {entry.display_name || 'Unknown'}
                            </span>
                          )}
                          {team.eliminated && (
                            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                              Out
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
