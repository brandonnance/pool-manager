'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { getEnabledPoolTypes, getGamesTemplateForEventType, type PoolTypes } from '@/lib/site-settings'
import { formatSlugInput, generateSlugFromName, checkSlugAvailability as checkSlugAvail } from '@/lib/slug'
import { createPoolSchema, type CreatePoolValues } from '@/lib/form-schemas'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface CreatePoolButtonProps {
  orgId: string
}

type PoolType = CreatePoolValues['poolType']
type SquaresEventType = CreatePoolValues['squaresEventType']

const DEFAULTS: CreatePoolValues = {
  name: '',
  seasonLabel: '',
  poolType: 'squares',
  reverseScoring: true,
  squaresEventType: 'nfl_playoffs',
  scoringMode: 'quarter',
  gameName: '',
  homeTeam: '',
  awayTeam: '',
  publicSlug: '',
}

export function CreatePoolButton({ orgId }: CreatePoolButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enabledPoolTypes, setEnabledPoolTypes] = useState<PoolTypes | null>(null)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const router = useRouter()

  const form = useForm<CreatePoolValues>({
    resolver: zodResolver(createPoolSchema),
    defaultValues: DEFAULTS,
  })

  const poolType = form.watch('poolType')
  const name = form.watch('name')
  const squaresEventType = form.watch('squaresEventType')
  const scoringMode = form.watch('scoringMode')
  const publicSlug = form.watch('publicSlug') ?? ''
  const reverseScoring = form.watch('reverseScoring')
  const slugError = form.formState.errors.publicSlug?.message

  // Fetch enabled pool types when dialog opens
  useEffect(() => {
    if (isOpen && !enabledPoolTypes) {
      getEnabledPoolTypes().then(setEnabledPoolTypes)
    }
  }, [isOpen, enabledPoolTypes])

  // Auto-set pool type to first enabled type
  useEffect(() => {
    if (enabledPoolTypes) {
      if (enabledPoolTypes.squares) {
        form.setValue('poolType', 'squares')
      } else if (enabledPoolTypes.march_madness) {
        form.setValue('poolType', 'march_madness')
      } else if (enabledPoolTypes.golf) {
        form.setValue('poolType', 'golf')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledPoolTypes])

  // Auto-generate slug from pool name for squares and march madness pools
  useEffect(() => {
    if ((poolType === 'squares' || poolType === 'march_madness') && name) {
      const slug = generateSlugFromName(name)
      form.setValue('publicSlug', slug, { shouldValidate: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, poolType])

  // Check slug availability (debounced)
  const checkSlugAvailability = useCallback(async (slug: string, type: PoolType) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null)
      return
    }
    setCheckingSlug(true)
    const table = type === 'march_madness' ? 'mm_pools' as const : 'sq_pools' as const
    const available = await checkSlugAvail(slug, table)
    setSlugAvailable(available)
    setCheckingSlug(false)
  }, [])

  useEffect(() => {
    if ((poolType !== 'squares' && poolType !== 'march_madness') || !publicSlug || slugError) {
      setSlugAvailable(null)
      return
    }
    const timeoutId = setTimeout(() => {
      checkSlugAvailability(publicSlug, poolType)
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [publicSlug, poolType, slugError, checkSlugAvailability])

  const handleSlugChange = (value: string) => {
    const formatted = formatSlugInput(value)
    form.setValue('publicSlug', formatted, { shouldValidate: true })
  }

  const onSubmit = async (values: CreatePoolValues) => {
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      return
    }

    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({
        name: values.name,
        org_id: orgId,
        type: values.poolType,
        status: 'draft',
        season_label: values.seasonLabel || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (poolError) {
      setError(poolError.message)
      return
    }

    // For Squares, create sq_pool and games
    if (values.poolType === 'squares') {
      const sqMode = values.squaresEventType === 'single_game' ? 'single_game' : 'full_playoff'

      const { data: sqPool, error: sqPoolError } = await supabase
        .from('sq_pools')
        .insert({
          pool_id: pool.id,
          reverse_scoring: values.reverseScoring,
          mode: sqMode,
          event_type: values.squaresEventType,
          scoring_mode: values.squaresEventType === 'single_game' ? values.scoringMode : null,
          public_slug: values.publicSlug || null,
        })
        .select()
        .single()

      if (sqPoolError) {
        setError(sqPoolError.message)
        return
      }

      if (sqMode === 'full_playoff') {
        const template = getGamesTemplateForEventType(values.squaresEventType)
        const gamesToInsert = template.map((game) => ({
          sq_pool_id: sqPool.id,
          game_name: game.name,
          home_team: 'TBD',
          away_team: 'TBD',
          round: game.round,
          display_order: game.display_order,
          pays_halftime: game.round === 'super_bowl',
          status: 'scheduled',
        }))

        const { error: gamesError } = await supabase.from('sq_games').insert(gamesToInsert)
        if (gamesError) {
          setError(gamesError.message)
          return
        }
      } else {
        const { error: gameError } = await supabase
          .from('sq_games')
          .insert({
            sq_pool_id: sqPool.id,
            game_name: values.gameName || 'Game',
            home_team: values.homeTeam || 'TBD',
            away_team: values.awayTeam || 'TBD',
            round: 'single_game',
            display_order: 1,
            pays_halftime: values.scoringMode === 'quarter' || values.scoringMode === 'hybrid',
            status: 'scheduled',
          })
        if (gameError) {
          setError(gameError.message)
          return
        }
      }
    }

    if (values.poolType === 'golf') {
      const { error: gpPoolError } = await supabase
        .from('gp_pools')
        .insert({ pool_id: pool.id })
      if (gpPoolError) {
        setError(gpPoolError.message)
        return
      }
    }

    if (values.poolType === 'march_madness') {
      const { error: mmPoolError } = await supabase
        .from('mm_pools')
        .insert({
          pool_id: pool.id,
          tournament_year: new Date().getFullYear(),
          public_slug: values.publicSlug || null,
        })
      if (mmPoolError) {
        setError(mmPoolError.message)
        return
      }
    }

    setIsOpen(false)
    form.reset(DEFAULTS)
    router.refresh()
    router.push(`/pools/${pool.id}`)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      form.reset(DEFAULTS)
      setError(null)
      setSlugAvailable(null)
      setCheckingSlug(false)
    }
  }

  const enabledCount = enabledPoolTypes
    ? (enabledPoolTypes.squares ? 1 : 0) +
      (enabledPoolTypes.golf ? 1 : 0) +
      (enabledPoolTypes.march_madness ? 1 : 0)
    : 3

  const setPoolType = (type: PoolType) => form.setValue('poolType', type)
  const setSquaresEventType = (type: SquaresEventType) => form.setValue('squaresEventType', type)

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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4">
              {/* Pool Type Selection */}
              {enabledCount > 1 && (
                <div className="space-y-2">
                  <Label>Pool Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {enabledPoolTypes?.squares && (
                      <button
                        type="button"
                        onClick={() => setPoolType('squares')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          poolType === 'squares'
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

              {enabledCount === 1 && enabledPoolTypes && (
                <div className="text-sm text-muted-foreground">
                  Creating a {enabledPoolTypes.squares ? 'Squares' : enabledPoolTypes.golf ? 'Golf Pool' : 'March Madness'} pool
                </div>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pool Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={
                          poolType === 'squares' ? 'Super Bowl Squares 2025' :
                          poolType === 'golf' ? 'Masters 2025 Pool' :
                          'March Madness 2025'
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seasonLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Season Label (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="2024-2025" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Squares specific options */}
              {poolType === 'squares' && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Event Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSquaresEventType('nfl_playoffs')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          squaresEventType === 'nfl_playoffs'
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <div className="font-medium text-sm">NFL Playoffs</div>
                        <div className="text-xs text-muted-foreground">13 playoff games</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSquaresEventType('march_madness')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          squaresEventType === 'march_madness'
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <div className="font-medium text-sm">March Madness</div>
                        <div className="text-xs text-muted-foreground">63 tournament games</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSquaresEventType('single_game')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          squaresEventType === 'single_game'
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        <div className="font-medium text-sm">Single Game</div>
                        <div className="text-xs text-muted-foreground">One game (Super Bowl, etc.)</div>
                      </button>
                    </div>
                  </div>

                  {squaresEventType === 'single_game' && (
                    <>
                      <FormField
                        control={form.control}
                        name="gameName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Game Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Super Bowl LIX" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="awayTeam"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Away Team (optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="TBD" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="homeTeam"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Home Team (optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="TBD" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Teams can be set later once matchups are known
                      </div>

                      <div className="space-y-2">
                        <Label>Scoring Mode</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => form.setValue('scoringMode', 'quarter')}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              scoringMode === 'quarter'
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-muted-foreground'
                            }`}
                          >
                            <div className="font-medium text-sm">Quarter</div>
                            <div className="text-xs text-muted-foreground">Q1, Half, Q3, Final</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => form.setValue('scoringMode', 'score_change')}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              scoringMode === 'score_change'
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-muted-foreground'
                            }`}
                          >
                            <div className="font-medium text-sm">Every Score</div>
                            <div className="text-xs text-muted-foreground">Winner each score</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => form.setValue('scoringMode', 'hybrid')}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              scoringMode === 'hybrid'
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-muted-foreground'
                            }`}
                          >
                            <div className="font-medium text-sm">Hybrid</div>
                            <div className="text-xs text-muted-foreground">Every score + quarters</div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Public URL slug */}
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
                      onCheckedChange={(val) => form.setValue('reverseScoring', val)}
                    />
                  </div>
                </div>
              )}

              {/* March Madness specific options */}
              {poolType === 'march_madness' && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="mmPublicSlug">Public URL Slug</Label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">/view/mm/</span>
                      <Input
                        id="mmPublicSlug"
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
                        Share this link for anyone to view the bracket
                      </div>
                    )}
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
                  form.formState.isSubmitting ||
                  ((poolType === 'squares' || poolType === 'march_madness') && (slugAvailable === false || checkingSlug))
                }
              >
                {form.formState.isSubmitting ? 'Creating...' : 'Create Pool'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
