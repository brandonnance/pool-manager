'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/lib/supabase/client'
import { getNflPlayoffGamesTemplate } from '@/lib/site-settings'
import {
  Sport,
  PoolType,
  SquaresMode,
  SquaresSettings,
  GolfSettings,
  SPORT_INFO,
  POOL_TYPE_INFO,
} from './types'

interface ReviewStepProps {
  orgId: string
  orgName: string
  sport: Sport
  poolType: PoolType
  mode: SquaresMode | null
  eventId: string
  eventName: string
  settings: SquaresSettings | GolfSettings
  onBack: () => void
}

/**
 * Step 6: Review & Create
 *
 * Shows a summary of all selections and handles pool creation.
 * Creates the pool record, type-specific record, and any associated games.
 */
export function ReviewStep({
  orgId,
  orgName,
  sport,
  poolType,
  mode,
  eventId,
  eventName,
  settings,
  onBack,
}: ReviewStepProps) {
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSquares = poolType === 'playoff_squares'
  const isGolf = poolType === 'golf'
  const isSingleGame = isSquares && mode === 'single_game'

  const squaresSettings = settings as SquaresSettings
  const golfSettings = settings as GolfSettings

  const handleCreate = async () => {
    setIsCreating(true)
    setError(null)

    const supabase = createClient()

    try {
      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to create a pool')
      }

      // 1. Create base pool record
      const { data: pool, error: poolError } = await supabase
        .from('pools')
        .insert({
          name: settings.name,
          org_id: orgId,
          type: poolType,
          status: 'draft',
          season_label: settings.seasonLabel || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (poolError) {
        throw new Error(poolError.message)
      }

      // 2. Create type-specific record
      if (isSquares) {
        // Create sq_pools record
        const { data: sqPool, error: sqPoolError } = await supabase
          .from('sq_pools')
          .insert({
            pool_id: pool.id,
            reverse_scoring: squaresSettings.reverseScoring,
            max_squares_per_player: null,
            mode: mode,
            scoring_mode: isSingleGame ? squaresSettings.scoringMode : null,
            no_account_mode: true,
            public_slug: squaresSettings.publicSlug || null,
            scoring_source: 'global', // Enable global events scoring
          })
          .select()
          .single()

        if (sqPoolError) {
          throw new Error(sqPoolError.message)
        }

        // 3. Create games
        if (mode === 'full_playoff') {
          // Use NFL games template
          const template = await getNflPlayoffGamesTemplate()
          const gamesToInsert = template.map((game) => ({
            sq_pool_id: sqPool.id,
            game_name: game.name,
            home_team: 'TBD',
            away_team: 'TBD',
            round: game.round,
            display_order: game.display_order,
            pays_halftime: game.round === 'super_bowl',
            status: 'scheduled',
            event_id: eventId, // Link to global event
          }))

          const { error: gamesError } = await supabase
            .from('sq_games')
            .insert(gamesToInsert)

          if (gamesError) {
            throw new Error(gamesError.message)
          }
        } else {
          // Single game mode
          const { error: gameError } = await supabase
            .from('sq_games')
            .insert({
              sq_pool_id: sqPool.id,
              game_name: squaresSettings.gameName || 'Game',
              home_team: squaresSettings.homeTeam || 'TBD',
              away_team: squaresSettings.awayTeam || 'TBD',
              round: 'single_game',
              display_order: 1,
              pays_halftime: squaresSettings.scoringMode === 'quarter',
              status: 'scheduled',
              event_id: eventId, // Link to global event
            })

          if (gameError) {
            throw new Error(gameError.message)
          }
        }
      }

      if (isGolf) {
        // Create gp_pools record
        const { error: gpPoolError } = await supabase
          .from('gp_pools')
          .insert({
            pool_id: pool.id,
            min_tier_points: golfSettings.minTierPoints || 100,
            picks_lock_at: golfSettings.picksLockAt || null,
            public_entries_enabled: golfSettings.publicEntriesEnabled || false,
            event_id: eventId, // Link to global event
            scoring_source: 'global', // Enable global events scoring
          })

        if (gpPoolError) {
          throw new Error(gpPoolError.message)
        }
      }

      // Success! Redirect to pool page
      router.refresh()
      router.push(`/pools/${pool.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pool')
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review & Create</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your pool settings before creating.
        </p>
      </div>

      {/* Summary */}
      <div className="space-y-4 bg-gray-50 rounded-lg p-4">
        {/* Organization */}
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Organization</span>
          <span className="text-sm font-medium">{orgName}</span>
        </div>

        {/* Sport */}
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Sport</span>
          <span className="text-sm font-medium">
            {SPORT_INFO[sport].icon} {SPORT_INFO[sport].name}
          </span>
        </div>

        {/* Pool Type */}
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Pool Type</span>
          <span className="text-sm font-medium">{POOL_TYPE_INFO[poolType].name}</span>
        </div>

        {/* Mode (Squares only) */}
        {isSquares && mode && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Mode</span>
            <span className="text-sm font-medium">
              {mode === 'full_playoff' ? 'Full Playoff (13 games)' : 'Single Game'}
            </span>
          </div>
        )}

        {/* Event */}
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Event</span>
          <span className="text-sm font-medium">{eventName}</span>
        </div>

        <hr className="border-gray-200" />

        {/* Pool Name */}
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Pool Name</span>
          <span className="text-sm font-medium">{settings.name}</span>
        </div>

        {/* Season Label */}
        {settings.seasonLabel && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Season</span>
            <span className="text-sm font-medium">{settings.seasonLabel}</span>
          </div>
        )}

        {/* Squares-specific */}
        {isSquares && (
          <>
            {squaresSettings.publicSlug && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Public URL</span>
                <span className="text-sm font-medium">
                  /squares/{squaresSettings.publicSlug}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Reverse Scoring</span>
              <span className="text-sm font-medium">
                {squaresSettings.reverseScoring ? 'Yes' : 'No'}
              </span>
            </div>
            {isSingleGame && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Game Name</span>
                  <span className="text-sm font-medium">{squaresSettings.gameName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Scoring Mode</span>
                  <span className="text-sm font-medium">
                    {squaresSettings.scoringMode === 'quarter' ? 'Quarter' : 'Every Score'}
                  </span>
                </div>
              </>
            )}
          </>
        )}

        {/* Golf-specific */}
        {isGolf && (
          <>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Min Tier Points</span>
              <span className="text-sm font-medium">{golfSettings.minTierPoints}</span>
            </div>
            {golfSettings.picksLockAt && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Picks Lock</span>
                <span className="text-sm font-medium">
                  {new Date(golfSettings.picksLockAt).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Public Entries</span>
              <span className="text-sm font-medium">
                {golfSettings.publicEntriesEnabled ? 'Yes' : 'No'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Auto-sync notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm text-blue-800">
            This pool will automatically sync scores from the selected event.
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} disabled={isCreating}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create Pool'}
        </Button>
      </div>
    </div>
  )
}
