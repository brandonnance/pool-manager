'use client'

import { useState } from 'react'
import { useGolfSetup } from './golf-setup-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2, Flag, Search, Download, RefreshCw, Play, Calendar, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SlashGolfTournament {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'upcoming' | 'in_progress' | 'completed'
  venue?: string
  courseName?: string
  par?: number
}

export function TournamentStep() {
  const { poolId, gpPool, tournament, reload } = useGolfSetup()
  const demoMode = gpPool.demo_mode ?? false

  const [error, setError] = useState<string | null>(null)
  const [searchYear, setSearchYear] = useState(new Date().getFullYear())
  const [searchQuery, setSearchQuery] = useState('')
  const [tournaments, setTournaments] = useState<SlashGolfTournament[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function fetchTournaments() {
    setLoadingTournaments(true)
    setError(null)

    try {
      const response = await fetch(`/api/golf/tournaments?year=${searchYear}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to fetch tournaments')
      setTournaments(data.tournaments || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournaments')
    }

    setLoadingTournaments(false)
  }

  async function handleImportTournament(t: SlashGolfTournament) {
    setImporting(t.id)
    setError(null)
    setImportSuccess(null)

    try {
      const response = await fetch('/api/golf/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId,
          tournamentData: {
            tournId: t.id,
            name: t.name,
            startDate: t.startDate,
            endDate: t.endDate,
            venue: t.venue,
            courseName: t.courseName,
            par: t.par,
            status: t.status,
          },
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to import tournament')

      setImportSuccess(
        data.fieldError
          ? `Imported ${t.name}. ${data.fieldError}`
          : `Imported ${data.totalPlayers} players from ${t.name}`
      )
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import tournament')
    }

    setImporting(null)
  }

  async function handleSeedDemo() {
    setSeeding(true)
    setError(null)

    try {
      const response = await fetch('/api/golf/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed', poolId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to seed demo data')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed demo data')
    }

    setSeeding(false)
  }

  async function handleSimulateRound() {
    setSimulating(true)
    setError(null)

    try {
      const response = await fetch('/api/golf/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate-round', poolId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to simulate round')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to simulate round')
    }

    setSimulating(false)
  }

  async function handleResetScores() {
    setResetting(true)
    setError(null)

    try {
      const response = await fetch('/api/golf/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', poolId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to reset scores')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset scores')
    }

    setResetting(false)
  }

  const filteredTournaments = tournaments.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">{error}</div>
      )}

      {/* Tournament Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Tournament
          </CardTitle>
          <CardDescription>
            {tournament ? 'Tournament linked' : demoMode ? 'Use demo mode to seed test data' : 'Import a tournament from PGA Tour data'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tournament ? (
            <div className="space-y-2">
              <div className="font-medium text-lg">{tournament.name}</div>
              {tournament.venue && <div className="text-muted-foreground">{tournament.venue}</div>}
              <div className="text-sm text-muted-foreground">
                {new Date(tournament.start_date).toLocaleDateString()} - {new Date(tournament.end_date).toLocaleDateString()}
              </div>
              <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium bg-muted">
                Status: {tournament.status}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              {demoMode
                ? 'Click "Seed Demo Data" below to create a test tournament with golfers.'
                : 'Search for a PGA Tour tournament below to import it with the full player field.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tournament Browser */}
      {!tournament && !demoMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Import PGA Tour Tournament
            </CardTitle>
            <CardDescription>Browse and import PGA Tour tournaments with their full player fields</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importSuccess && (
              <div className="bg-green-50 text-green-700 px-4 py-3 rounded-md text-sm">{importSuccess}</div>
            )}

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="searchYear" className="whitespace-nowrap">Year:</Label>
                <Input
                  id="searchYear"
                  type="number"
                  min={2020}
                  max={2030}
                  value={searchYear}
                  onChange={(e) => setSearchYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-24"
                />
              </div>
              <Button onClick={fetchTournaments} disabled={loadingTournaments}>
                {loadingTournaments && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="mr-2 h-4 w-4" />
                Load Tournaments
              </Button>
            </div>

            {tournaments.length > 0 && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tournaments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {filteredTournaments.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No tournaments match your search</div>
                  ) : (
                    filteredTournaments.map((t) => {
                      const startDate = new Date(t.startDate)
                      const endDate = new Date(t.endDate)
                      const isPast = endDate < new Date()

                      return (
                        <div
                          key={t.id}
                          className={cn('p-3 flex items-center justify-between gap-4', isPast && 'bg-muted/30')}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{t.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                              {t.venue && ` \u2022 ${t.venue}`}
                            </div>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full mt-1 inline-block',
                              t.status === 'completed' && 'bg-gray-100 text-gray-600',
                              t.status === 'in_progress' && 'bg-green-100 text-green-700',
                              t.status === 'upcoming' && 'bg-blue-100 text-blue-700'
                            )}>
                              {t.status === 'completed' ? 'Completed' : t.status === 'in_progress' ? 'In Progress' : 'Upcoming'}
                            </span>
                          </div>
                          <Button size="sm" onClick={() => handleImportTournament(t)} disabled={importing !== null}>
                            {importing === t.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <><Download className="h-4 w-4 mr-1" />Import</>
                            )}
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Showing {filteredTournaments.length} of {tournaments.length} tournaments
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Demo Controls */}
      {demoMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Demo Controls
            </CardTitle>
            <CardDescription>Seed test data and simulate tournament rounds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {!tournament && (
                <Button onClick={handleSeedDemo} disabled={seeding}>
                  {seeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Seed Demo Data
                </Button>
              )}
              {tournament && (
                <>
                  <Button onClick={handleSimulateRound} disabled={simulating}>
                    {simulating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Calendar className="mr-2 h-4 w-4" />
                    Simulate Next Round
                  </Button>
                  <Button variant="outline" onClick={handleResetScores} disabled={resetting}>
                    {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset Scores
                  </Button>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {!tournament
                ? 'Seeding will create a Demo Masters tournament with 50 golfers and default tier assignments.'
                : 'Simulating will advance the tournament by one round. Reset will clear all scores.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
