'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getEnabledPoolTypes, getNflPlayoffGamesTemplate, type PoolTypes, type NflPlayoffGame } from '@/lib/site-settings'
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

type PoolType = 'bowl_buster' | 'playoff_squares' | 'golf' | 'march_madness'
type SquaresMode = 'full_playoff' | 'single_game'
type ScoringMode = 'quarter' | 'score_change'

export function CreatePoolButton({ orgId }: CreatePoolButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [seasonLabel, setSeasonLabel] = useState('')
  const [poolType, setPoolType] = useState<PoolType>('bowl_buster')

  // Enabled pool types from site settings
  const [enabledPoolTypes, setEnabledPoolTypes] = useState<PoolTypes | null>(null)
  const [nflGamesTemplate, setNflGamesTemplate] = useState<NflPlayoffGame[] | null>(null)

  // Playoff Squares specific options
  const [reverseScoring, setReverseScoring] = useState(true)

  // Single Game Squares mode options
  const [squaresMode, setSquaresMode] = useState<SquaresMode>('full_playoff')
  const [scoringMode, setScoringMode] = useState<ScoringMode>('quarter')
  const [gameName, setGameName] = useState('')
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')

  // Public slug (always enabled for squares - no-account mode only)
  const [publicSlug, setPublicSlug] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Fetch enabled pool types and NFL games template when dialog opens
  useEffect(() => {
    if (isOpen && !enabledPoolTypes) {
      getEnabledPoolTypes().then(setEnabledPoolTypes)
      getNflPlayoffGamesTemplate().then(setNflGamesTemplate)
    }
  }, [isOpen, enabledPoolTypes])

  // Auto-set pool type to first enabled type
  useEffect(() => {
    if (enabledPoolTypes) {
      // Set to first enabled pool type
      if (enabledPoolTypes.bowl_buster) {
        setPoolType('bowl_buster')
      } else if (enabledPoolTypes.playoff_squares) {
        setPoolType('playoff_squares')
      } else if (enabledPoolTypes.golf) {
        setPoolType('golf')
      } else if (enabledPoolTypes.march_madness) {
        setPoolType('march_madness')
      }
    }
  }, [enabledPoolTypes])

  // Auto-generate slug from pool name for squares pools
  useEffect(() => {
    if (poolType === 'playoff_squares' && name) {
      const slug = generateSlug(name)
      setPublicSlug(slug)
      // Clear slug error when auto-generating
      if (slug.length >= 3) {
        setSlugError(null)
      }
    }
  }, [name, poolType])

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

    // For Playoff Squares, create sq_pool and games (always no-account mode)
    if (poolType === 'playoff_squares') {
      // Validate slug format
      if (publicSlug) {
        if (!/^[a-z0-9-]+$/.test(publicSlug)) {
          setError('Slug can only contain lowercase letters, numbers, and hyphens')
          setIsLoading(false)
          return
        }
        if (publicSlug.length < 3 || publicSlug.length > 50) {
          setError('Slug must be between 3 and 50 characters')
          setIsLoading(false)
          return
        }
      }

      // Create sq_pools record - always no_account_mode: true
      const { data: sqPool, error: sqPoolError } = await supabase
        .from('sq_pools')
        .insert({
          pool_id: pool.id,
          reverse_scoring: reverseScoring,
          max_squares_per_player: null, // No limit in no-account mode
          mode: squaresMode,
          scoring_mode: squaresMode === 'single_game' ? scoringMode : null,
          no_account_mode: true, // Always no-account mode
          public_slug: publicSlug || null,
        })
        .select()
        .single()

      if (sqPoolError) {
        setError(sqPoolError.message)
        setIsLoading(false)
        return
      }

      if (squaresMode === 'full_playoff') {
        // Use NFL games template from site_settings
        const template = nflGamesTemplate || []
        const gamesToInsert = template.map((game) => ({
          sq_pool_id: sqPool.id,
          game_name: game.name,
          home_team: 'TBD',
          away_team: 'TBD',
          round: game.round,
          display_order: game.display_order,
          pays_halftime: game.round === 'super_bowl', // Super Bowl pays halftime
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

    // For Golf pools, create gp_pools record
    if (poolType === 'golf') {
      const { error: gpPoolError } = await supabase
        .from('gp_pools')
        .insert({
          pool_id: pool.id,
        })

      if (gpPoolError) {
        setError(gpPoolError.message)
        setIsLoading(false)
        return
      }
    }

    // For March Madness pools, create mm_pools record
    if (poolType === 'march_madness') {
      const { error: mmPoolError } = await supabase
        .from('mm_pools')
        .insert({
          pool_id: pool.id,
          tournament_year: new Date().getFullYear(),
        })

      if (mmPoolError) {
        setError(mmPoolError.message)
        setIsLoading(false)
        return
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
    setSquaresMode('full_playoff')
    setScoringMode('quarter')
    setGameName('')
    setHomeTeam('')
    setAwayTeam('')
    setPublicSlug('')
    setSlugError(null)
    setSlugAvailable(null)
    setCheckingSlug(false)
    setError(null)
  }

  // Check if slug is available
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null)
      return
    }

    setCheckingSlug(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('sq_pools')
      .select('id')
      .eq('public_slug', slug)
      .maybeSingle()

    setCheckingSlug(false)

    if (error) {
      setSlugAvailable(null)
      return
    }

    setSlugAvailable(data === null)
  }, [])

  // Debounced slug availability check
  useEffect(() => {
    if (poolType !== 'playoff_squares' || !publicSlug || slugError) {
      setSlugAvailable(null)
      return
    }

    const timeoutId = setTimeout(() => {
      checkSlugAvailability(publicSlug)
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [publicSlug, poolType, slugError, checkSlugAvailability])

  // Generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
  }

  const handleSlugChange = (value: string) => {
    const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setPublicSlug(formatted)

    if (formatted && formatted.length < 3) {
      setSlugError('Slug must be at least 3 characters')
    } else if (formatted && formatted.length > 50) {
      setSlugError('Slug must be 50 characters or less')
    } else {
      setSlugError(null)
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      resetForm()
    }
  }

  // Count enabled pool types
  const enabledCount = enabledPoolTypes
    ? (enabledPoolTypes.bowl_buster ? 1 : 0) +
      (enabledPoolTypes.playoff_squares ? 1 : 0) +
      (enabledPoolTypes.golf ? 1 : 0) +
      (enabledPoolTypes.march_madness ? 1 : 0)
    : 4

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
          <div className="space-y-4">
            {/* Pool Type Selection - only show if more than one type enabled */}
            {enabledCount > 1 && (
              <div className="space-y-2">
                <Label>Pool Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {enabledPoolTypes?.bowl_buster && (
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
                  )}
                  {enabledPoolTypes?.playoff_squares && (
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
                  )}
                  {enabledPoolTypes?.golf && (
                    <button
                      type="button"
                      onClick={() => setPoolType('golf')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        poolType === 'golf'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="font-medium">Golf Pool</div>
                      <div className="text-xs text-muted-foreground">Pick golfers by tier</div>
                    </button>
                  )}
                  {enabledPoolTypes?.march_madness && (
                    <button
                      type="button"
                      onClick={() => setPoolType('march_madness')}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        poolType === 'march_madness'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <div className="font-medium">March Madness</div>
                      <div className="text-xs text-muted-foreground">64-player blind draw</div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Show single pool type header if only one is enabled */}
            {enabledCount === 1 && enabledPoolTypes && (
              <div className="text-sm text-muted-foreground">
                Creating a {enabledPoolTypes.bowl_buster ? 'Bowl Buster' : 'Squares'} pool
              </div>
            )}

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
                      <div className="text-xs text-muted-foreground">
                        {nflGamesTemplate?.length || 13} NFL playoff games
                      </div>
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

                {/* Public URL slug - always shown for squares */}
                <div className="space-y-2">
                  <Label htmlFor="publicSlug">Public URL Slug</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">/view/</span>
                    <Input
                      id="publicSlug"
                      value={publicSlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="my-pool-name"
                      className={`font-mono text-sm ${
                        slugError ? 'border-destructive' :
                        slugAvailable === false ? 'border-destructive' :
                        slugAvailable === true ? 'border-green-500' : ''
                      }`}
                    />
                    {checkingSlug && (
                      <div className="text-xs text-muted-foreground animate-pulse">...</div>
                    )}
                  </div>
                  {slugError ? (
                    <div className="text-xs text-destructive">{slugError}</div>
                  ) : slugAvailable === false ? (
                    <div className="text-xs text-destructive">
                      This slug is already taken. Try a different one.
                    </div>
                  ) : slugAvailable === true ? (
                    <div className="text-xs text-green-600">
                      This slug is available!
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Share this link for anyone to view the grid
                    </div>
                  )}
                </div>

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
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !name.trim() ||
                (poolType === 'playoff_squares' && (!!slugError || slugAvailable === false || checkingSlug))
              }
            >
              {isLoading ? 'Creating...' : 'Create Pool'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
