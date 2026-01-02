'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface CreatePoolButtonProps {
  orgId: string
}

type PoolType = 'bowl_buster' | 'playoff_squares'
type SquaresMode = 'full_playoff' | 'single_game'
type ScoringMode = 'quarter' | 'score_change'

// NFL Playoff games template
const NFL_PLAYOFF_GAMES = [
  // Wild Card Round (6 games)
  { game_name: 'AFC Wild Card 1', home_team: 'TBD', away_team: 'TBD', round: 'wild_card', display_order: 1 },
  { game_name: 'AFC Wild Card 2', home_team: 'TBD', away_team: 'TBD', round: 'wild_card', display_order: 2 },
  { game_name: 'AFC Wild Card 3', home_team: 'TBD', away_team: 'TBD', round: 'wild_card', display_order: 3 },
  { game_name: 'NFC Wild Card 1', home_team: 'TBD', away_team: 'TBD', round: 'wild_card', display_order: 4 },
  { game_name: 'NFC Wild Card 2', home_team: 'TBD', away_team: 'TBD', round: 'wild_card', display_order: 5 },
  { game_name: 'NFC Wild Card 3', home_team: 'TBD', away_team: 'TBD', round: 'wild_card', display_order: 6 },
  // Divisional Round (4 games)
  { game_name: 'AFC Divisional 1', home_team: 'TBD', away_team: 'TBD', round: 'divisional', display_order: 7 },
  { game_name: 'AFC Divisional 2', home_team: 'TBD', away_team: 'TBD', round: 'divisional', display_order: 8 },
  { game_name: 'NFC Divisional 1', home_team: 'TBD', away_team: 'TBD', round: 'divisional', display_order: 9 },
  { game_name: 'NFC Divisional 2', home_team: 'TBD', away_team: 'TBD', round: 'divisional', display_order: 10 },
  // Conference Championships (2 games)
  { game_name: 'AFC Championship', home_team: 'TBD', away_team: 'TBD', round: 'conference', display_order: 11 },
  { game_name: 'NFC Championship', home_team: 'TBD', away_team: 'TBD', round: 'conference', display_order: 12 },
  // Super Bowl (1 game)
  { game_name: 'Super Bowl', home_team: 'TBD', away_team: 'TBD', round: 'super_bowl', display_order: 13, pays_halftime: true },
]

export function CreatePoolButton({ orgId }: CreatePoolButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [seasonLabel, setSeasonLabel] = useState('')
  const [poolType, setPoolType] = useState<PoolType>('bowl_buster')

  // Playoff Squares specific options
  const [reverseScoring, setReverseScoring] = useState(true)
  const [maxSquaresPerPlayer, setMaxSquaresPerPlayer] = useState('')

  // Single Game Squares mode options
  const [squaresMode, setSquaresMode] = useState<SquaresMode>('full_playoff')
  const [scoringMode, setScoringMode] = useState<ScoringMode>('quarter')
  const [gameName, setGameName] = useState('')
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    // Create the pool
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({
        name,
        org_id: orgId,
        type: poolType,
        status: 'draft',
        season_label: seasonLabel || null,
        created_by: user.id
      })
      .select()
      .single()

    if (poolError) {
      setError(poolError.message)
      setIsLoading(false)
      return
    }

    // Note: pool_commissioner_trigger automatically creates commissioner membership

    // For Playoff Squares, create sq_pool and games
    if (poolType === 'playoff_squares') {
      const maxSquares = maxSquaresPerPlayer ? parseInt(maxSquaresPerPlayer) : null

      // Create sq_pools record
      const { data: sqPool, error: sqPoolError } = await supabase
        .from('sq_pools')
        .insert({
          pool_id: pool.id,
          reverse_scoring: reverseScoring,
          max_squares_per_player: maxSquares,
          mode: squaresMode,
          scoring_mode: squaresMode === 'single_game' ? scoringMode : null,
        })
        .select()
        .single()

      if (sqPoolError) {
        setError(sqPoolError.message)
        setIsLoading(false)
        return
      }

      if (squaresMode === 'full_playoff') {
        // Create the 13 NFL playoff games
        const gamesToInsert = NFL_PLAYOFF_GAMES.map((game) => ({
          sq_pool_id: sqPool.id,
          game_name: game.game_name,
          home_team: game.home_team,
          away_team: game.away_team,
          round: game.round,
          display_order: game.display_order,
          pays_halftime: game.pays_halftime ?? false,
          status: 'scheduled',
        }))

        const { error: gamesError } = await supabase
          .from('sq_games')
          .insert(gamesToInsert)

        if (gamesError) {
          setError(gamesError.message)
          setIsLoading(false)
          return
        }
      } else {
        // Single Game mode - create just one game
        const { error: gameError } = await supabase
          .from('sq_games')
          .insert({
            sq_pool_id: sqPool.id,
            game_name: gameName || 'Game',
            home_team: homeTeam || 'TBD',
            away_team: awayTeam || 'TBD',
            round: 'single_game',
            display_order: 1,
            pays_halftime: scoringMode === 'quarter', // Quarter mode pays halftime
            status: 'scheduled',
          })

        if (gameError) {
          setError(gameError.message)
          setIsLoading(false)
          return
        }
      }
    }

    setIsOpen(false)
    resetForm()
    router.refresh()
    router.push(`/pools/${pool.id}`)
  }

  const resetForm = () => {
    setName('')
    setSeasonLabel('')
    setPoolType('bowl_buster')
    setReverseScoring(true)
    setMaxSquaresPerPlayer('')
    setSquaresMode('full_playoff')
    setScoringMode('quarter')
    setGameName('')
    setHomeTeam('')
    setAwayTeam('')
    setError(null)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      resetForm()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>Create Pool</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Pool</DialogTitle>
          <DialogDescription>
            Set up a new pool for your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Pool Type Selection */}
            <div className="space-y-2">
              <Label>Pool Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPoolType('bowl_buster')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    poolType === 'bowl_buster'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="font-medium">Bowl Buster</div>
                  <div className="text-xs text-muted-foreground">Pick bowl game winners</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPoolType('playoff_squares')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    poolType === 'playoff_squares'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="font-medium">Squares</div>
                  <div className="text-xs text-muted-foreground">10x10 squares grid</div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Pool Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={poolType === 'bowl_buster' ? 'My Bowl Pool' : 'Super Bowl Squares 2025'}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seasonLabel">Season Label (optional)</Label>
              <Input
                id="seasonLabel"
                value={seasonLabel}
                onChange={(e) => setSeasonLabel(e.target.value)}
                placeholder="2024-2025"
              />
            </div>

            {/* Playoff Squares specific options */}
            {poolType === 'playoff_squares' && (
              <div className="space-y-4 border-t pt-4">
                {/* Mode Selection */}
                <div className="space-y-2">
                  <Label>Squares Mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSquaresMode('full_playoff')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        squaresMode === 'full_playoff'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="font-medium text-sm">Full Playoff</div>
                      <div className="text-xs text-muted-foreground">13 NFL playoff games</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSquaresMode('single_game')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        squaresMode === 'single_game'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="font-medium text-sm">Single Game</div>
                      <div className="text-xs text-muted-foreground">One game (Super Bowl, etc.)</div>
                    </button>
                  </div>
                </div>

                {/* Single Game Options */}
                {squaresMode === 'single_game' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="gameName">Game Name</Label>
                      <Input
                        id="gameName"
                        value={gameName}
                        onChange={(e) => setGameName(e.target.value)}
                        placeholder="Super Bowl LIX"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="awayTeam">Away Team (optional)</Label>
                        <Input
                          id="awayTeam"
                          value={awayTeam}
                          onChange={(e) => setAwayTeam(e.target.value)}
                          placeholder="TBD"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="homeTeam">Home Team (optional)</Label>
                        <Input
                          id="homeTeam"
                          value={homeTeam}
                          onChange={(e) => setHomeTeam(e.target.value)}
                          placeholder="TBD"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Teams can be set later once matchups are known
                    </div>

                    <div className="space-y-2">
                      <Label>Scoring Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setScoringMode('quarter')}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            scoringMode === 'quarter'
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-muted-foreground'
                          }`}
                        >
                          <div className="font-medium text-sm">Quarter Scoring</div>
                          <div className="text-xs text-muted-foreground">Q1, Half, Q3, Final</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setScoringMode('score_change')}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            scoringMode === 'score_change'
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-muted-foreground'
                          }`}
                        >
                          <div className="font-medium text-sm">Every Score</div>
                          <div className="text-xs text-muted-foreground">Winner on each score change</div>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="text-sm font-medium pt-2">Grid Options</div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="reverseScoring" className="text-sm font-normal">Reverse Scoring</Label>
                    <div className="text-xs text-muted-foreground">
                      Pay both normal and reverse winners
                    </div>
                  </div>
                  <Switch
                    id="reverseScoring"
                    checked={reverseScoring}
                    onCheckedChange={setReverseScoring}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxSquares">Max Squares per Player (optional)</Label>
                  <Input
                    id="maxSquares"
                    type="number"
                    min="1"
                    max="100"
                    value={maxSquaresPerPlayer}
                    onChange={(e) => setMaxSquaresPerPlayer(e.target.value)}
                    placeholder="Unlimited"
                  />
                  <div className="text-xs text-muted-foreground">
                    Leave blank for no limit
                  </div>
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Creating...' : 'Create Pool'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
