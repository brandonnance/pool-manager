'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Play, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Database } from '@/types/database'

type EventState = Database['public']['Tables']['event_state']['Row']

interface LinkedGame {
  id: string
  game_name: string | null
  home_team: string | null
  away_team: string | null
  status: string | null
  sq_pool_id: string
  sq_pools: {
    id: string
    pool_id: string
    scoring_mode: string | null
    reverse_scoring: boolean | null
    row_numbers: number[] | null
    col_numbers: number[] | null
    pools: { id: string; name: string }
  }
}

interface LiveScoringControlProps {
  eventId: string
  eventState: EventState | null
  homeTeam: string
  awayTeam: string
  linkedGames: LinkedGame[]
}

interface ActionLog {
  id: string
  timestamp: Date
  action: string
  result: string
  isError?: boolean
}

const SCORE_BUTTONS = [
  { label: '+1', value: 1, description: 'Extra point / Safety' },
  { label: '+2', value: 2, description: '2-pt conversion / Safety' },
  { label: '+3', value: 3, description: 'Field goal' },
  { label: '+6', value: 6, description: 'Touchdown (no XP yet)' },
  { label: '+7', value: 7, description: 'Touchdown + XP' },
  { label: '+8', value: 8, description: 'Touchdown + 2pt' },
]

export function LiveScoringControl({
  eventId,
  eventState,
  homeTeam,
  awayTeam,
  linkedGames,
}: LiveScoringControlProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([])

  // Direct score input state
  const [showDirectInput, setShowDirectInput] = useState(false)
  const [directHomeScore, setDirectHomeScore] = useState('')
  const [directAwayScore, setDirectAwayScore] = useState('')

  // Period end confirmation
  const [confirmPeriod, setConfirmPeriod] = useState<number | null>(null)

  // Parse current state
  const payload = eventState?.payload as {
    home_score?: number
    away_score?: number
    period?: number
    clock?: string
    q1_home_score?: number
    q1_away_score?: number
    q2_home_score?: number
    q2_away_score?: number
    q3_home_score?: number
    q3_away_score?: number
  } | null

  const currentHomeScore = payload?.home_score ?? 0
  const currentAwayScore = payload?.away_score ?? 0
  const currentPeriod = payload?.period ?? 0

  const isStarted = eventState?.status === 'in_progress'

  const addLog = useCallback((action: string, result: string, isError = false) => {
    const newLog: ActionLog = {
      id: Date.now().toString(),
      timestamp: new Date(),
      action,
      result,
      isError,
    }
    setActionLogs((prev) => [newLog, ...prev.slice(0, 9)])
  }, [])

  // API call helper
  const callScoringApi = async (action: string, data: Record<string, unknown>) => {
    const response = await fetch('/api/admin/scoring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, action, ...data }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to process scoring action')
    }

    return response.json()
  }

  // Start game
  const handleStartGame = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await callScoringApi('start_game', {
        homeTeam,
        awayTeam,
      })

      addLog('Game Started', `Score: ${awayTeam} 0 - ${homeTeam} 0`)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start game'
      setError(message)
      addLog('Start Game', message, true)
    } finally {
      setIsLoading(false)
    }
  }

  // Add score
  const handleAddScore = async (team: 'home' | 'away', points: number) => {
    setIsLoading(true)
    setError(null)

    const newHomeScore = team === 'home' ? currentHomeScore + points : currentHomeScore
    const newAwayScore = team === 'away' ? currentAwayScore + points : currentAwayScore
    const teamName = team === 'home' ? homeTeam : awayTeam

    try {
      const result = await callScoringApi('record_score', {
        homeScore: newHomeScore,
        awayScore: newAwayScore,
      })

      const winnersCreated = result.winnersCreated ?? 0
      addLog(
        `${teamName} +${points}`,
        `Score: ${awayTeam} ${newAwayScore} - ${homeTeam} ${newHomeScore}` +
          (winnersCreated > 0 ? ` (${winnersCreated} winners)` : '')
      )
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record score'
      setError(message)
      addLog(`${teamName} +${points}`, message, true)
    } finally {
      setIsLoading(false)
    }
  }

  // Direct score input
  const handleDirectScore = async () => {
    if (!directHomeScore && !directAwayScore) return

    setIsLoading(true)
    setError(null)

    const newHomeScore = directHomeScore ? parseInt(directHomeScore, 10) : currentHomeScore
    const newAwayScore = directAwayScore ? parseInt(directAwayScore, 10) : currentAwayScore

    // Don't record if scores haven't changed
    if (newHomeScore === currentHomeScore && newAwayScore === currentAwayScore) {
      setShowDirectInput(false)
      setDirectHomeScore('')
      setDirectAwayScore('')
      return
    }

    try {
      const result = await callScoringApi('record_score', {
        homeScore: newHomeScore,
        awayScore: newAwayScore,
      })

      const winnersCreated = result.winnersCreated ?? 0
      addLog(
        'Direct Score',
        `Score: ${awayTeam} ${newAwayScore} - ${homeTeam} ${newHomeScore}` +
          (winnersCreated > 0 ? ` (${winnersCreated} winners)` : '')
      )
      setShowDirectInput(false)
      setDirectHomeScore('')
      setDirectAwayScore('')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to record score'
      setError(message)
      addLog('Direct Score', message, true)
    } finally {
      setIsLoading(false)
    }
  }

  // End period
  const handleEndPeriod = async (period: number) => {
    setIsLoading(true)
    setError(null)
    setConfirmPeriod(null)

    const periodName =
      period === 1 ? 'Q1' : period === 2 ? 'Halftime' : period === 3 ? 'Q3' : 'Final'

    try {
      const result = await callScoringApi('end_period', {
        period,
        homeScore: currentHomeScore,
        awayScore: currentAwayScore,
      })

      const winnersCreated = result.winnersCreated ?? 0
      addLog(
        `End ${periodName}`,
        `Score: ${awayTeam} ${currentAwayScore} - ${homeTeam} ${currentHomeScore}` +
          (winnersCreated > 0 ? ` (${winnersCreated} winners)` : '')
      )
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end period'
      setError(message)
      addLog(`End ${periodName}`, message, true)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate winning square for display
  const getWinningSquare = (homeScore: number, awayScore: number) => {
    const homeDigit = homeScore % 10
    const awayDigit = awayScore % 10
    return `[${awayDigit}-${homeDigit}]`
  }

  if (!isStarted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start Game</CardTitle>
          <CardDescription>
            Initialize the game to begin scoring. This will record 0-0 as the first score.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-6 bg-muted rounded-lg">
            <div className="flex justify-center items-center gap-8">
              <div className="text-center">
                <div className="text-lg text-muted-foreground">{awayTeam}</div>
                <div className="text-5xl font-bold font-mono text-muted-foreground">0</div>
              </div>
              <div className="text-3xl text-muted-foreground">-</div>
              <div className="text-center">
                <div className="text-lg text-muted-foreground">{homeTeam}</div>
                <div className="text-5xl font-bold font-mono text-muted-foreground">0</div>
              </div>
            </div>
          </div>

          {linkedGames.length === 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No pools are linked to this event yet. Winners cannot be recorded until pools are
                linked.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleStartGame} disabled={isLoading} className="w-full" size="lg">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Game (Kickoff)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Score Display */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center p-6 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-2 flex items-center justify-center gap-2">
              <Clock className="h-3 w-3" />
              {currentPeriod > 0 ? `Q${currentPeriod}` : 'Pre-game'}
            </div>
            <div className="flex justify-center items-center gap-8">
              <div className="text-center">
                <div className="text-lg text-muted-foreground">{awayTeam}</div>
                <div className="text-5xl font-bold font-mono">{currentAwayScore}</div>
              </div>
              <div className="text-3xl text-muted-foreground">-</div>
              <div className="text-center">
                <div className="text-lg text-muted-foreground">{homeTeam}</div>
                <div className="text-5xl font-bold font-mono">{currentHomeScore}</div>
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground font-mono">
              Winning square: {getWinningSquare(currentHomeScore, currentAwayScore)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Buttons */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Away Team */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{awayTeam}</CardTitle>
            <CardDescription>Click to add points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {SCORE_BUTTONS.map((btn) => (
                <Button
                  key={`away-${btn.value}`}
                  variant="outline"
                  className="h-14 text-lg font-bold"
                  onClick={() => handleAddScore('away', btn.value)}
                  disabled={isLoading}
                  title={btn.description}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Home Team */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{homeTeam}</CardTitle>
            <CardDescription>Click to add points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {SCORE_BUTTONS.map((btn) => (
                <Button
                  key={`home-${btn.value}`}
                  variant="outline"
                  className="h-14 text-lg font-bold"
                  onClick={() => handleAddScore('home', btn.value)}
                  disabled={isLoading}
                  title={btn.description}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Period Controls</CardTitle>
          <CardDescription>Mark quarter/half endings to record quarter winners</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={currentPeriod >= 1 ? 'secondary' : 'outline'}
              onClick={() => setConfirmPeriod(1)}
              disabled={isLoading || currentPeriod >= 1}
            >
              End Q1
            </Button>
            <Button
              variant={currentPeriod >= 2 ? 'secondary' : 'outline'}
              onClick={() => setConfirmPeriod(2)}
              disabled={isLoading || currentPeriod >= 2}
            >
              End Half
            </Button>
            <Button
              variant={currentPeriod >= 3 ? 'secondary' : 'outline'}
              onClick={() => setConfirmPeriod(3)}
              disabled={isLoading || currentPeriod >= 3}
            >
              End Q3
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmPeriod(4)}
              disabled={isLoading || currentPeriod >= 4}
            >
              Game Final
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Direct Score Input */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Score Correction</CardTitle>
          <CardDescription>Directly set scores (for corrections)</CardDescription>
        </CardHeader>
        <CardContent>
          {showDirectInput ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="awayScore">{awayTeam}</Label>
                  <Input
                    id="awayScore"
                    type="number"
                    min="0"
                    value={directAwayScore}
                    onChange={(e) => setDirectAwayScore(e.target.value)}
                    placeholder={currentAwayScore.toString()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="homeScore">{homeTeam}</Label>
                  <Input
                    id="homeScore"
                    type="number"
                    min="0"
                    value={directHomeScore}
                    onChange={(e) => setDirectHomeScore(e.target.value)}
                    placeholder={currentHomeScore.toString()}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDirectScore} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    'Record Score'
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setShowDirectInput(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowDirectInput(true)}>
              Enter Score Manually
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action Log */}
      {actionLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Action Log</CardTitle>
            <CardDescription>Recent scoring actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {actionLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 text-sm p-2 rounded ${
                    log.isError ? 'bg-red-50 text-red-800' : 'bg-muted'
                  }`}
                >
                  {log.isError ? (
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{log.action}</div>
                    <div className="text-muted-foreground truncate">{log.result}</div>
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0">
                    {log.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period End Confirmation Dialog */}
      <Dialog open={confirmPeriod !== null} onOpenChange={() => setConfirmPeriod(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirm{' '}
              {confirmPeriod === 1
                ? 'End of Q1'
                : confirmPeriod === 2
                  ? 'Halftime'
                  : confirmPeriod === 3
                    ? 'End of Q3'
                    : 'Game Final'}
            </DialogTitle>
            <DialogDescription>
              This will record the current score ({awayTeam} {currentAwayScore} - {homeTeam}{' '}
              {currentHomeScore}) as the{' '}
              {confirmPeriod === 1
                ? 'Q1'
                : confirmPeriod === 2
                  ? 'halftime'
                  : confirmPeriod === 3
                    ? 'Q3'
                    : 'final'}{' '}
              score and create winners for quarter-mode pools.
              {confirmPeriod === 4 && (
                <span className="block mt-2 text-red-600 font-medium">
                  This action cannot be undone. The game will be marked as final.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmPeriod(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmPeriod === 4 ? 'destructive' : 'default'}
              onClick={() => confirmPeriod && handleEndPeriod(confirmPeriod)}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
