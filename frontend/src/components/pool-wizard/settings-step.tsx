'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import {
  PoolType,
  SquaresMode,
  ScoringMode,
  SquaresSettings,
  GolfSettings,
  generateSlug,
  isValidSlug,
} from './types'

interface SettingsStepProps {
  poolType: PoolType
  mode: SquaresMode | null
  settings: SquaresSettings | GolfSettings
  onUpdate: (settings: SquaresSettings | GolfSettings) => void
  onBack: () => void
  onNext: () => void
}

/**
 * Step 5: Pool Settings
 *
 * Type-specific pool configuration:
 * - Squares: name, slug, scoring mode (single game), reverse scoring
 * - Golf: name, tier points, picks lock time, public entries
 */
export function SettingsStep({
  poolType,
  mode,
  settings,
  onUpdate,
  onBack,
  onNext,
}: SettingsStepProps) {
  // Slug validation state (squares only)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)

  const isSquares = poolType === 'playoff_squares'
  const isGolf = poolType === 'golf'
  const isSingleGame = isSquares && mode === 'single_game'

  // Type guards
  const squaresSettings = settings as SquaresSettings
  const golfSettings = settings as GolfSettings

  // Auto-generate slug from name for squares
  useEffect(() => {
    if (isSquares && squaresSettings.name && !squaresSettings.publicSlug) {
      const slug = generateSlug(squaresSettings.name)
      onUpdate({ ...squaresSettings, publicSlug: slug })
    }
  }, [isSquares, squaresSettings.name])

  // Debounced slug availability check
  const checkSlugAvailability = useCallback(
    async (slug: string) => {
      if (!slug || slug.length < 3) {
        setSlugAvailable(null)
        setSlugError(null)
        return
      }

      if (!isValidSlug(slug)) {
        setSlugError('Slug can only contain lowercase letters, numbers, and hyphens (3-50 chars)')
        setSlugAvailable(false)
        return
      }

      setCheckingSlug(true)
      setSlugError(null)

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('sq_pools')
          .select('id')
          .eq('public_slug', slug)
          .maybeSingle()

        if (error) throw error

        if (data) {
          setSlugError('This slug is already taken')
          setSlugAvailable(false)
        } else {
          setSlugAvailable(true)
        }
      } catch {
        setSlugError('Failed to check slug availability')
        setSlugAvailable(null)
      } finally {
        setCheckingSlug(false)
      }
    },
    []
  )

  // Debounce slug check
  useEffect(() => {
    if (isSquares && squaresSettings.publicSlug) {
      const timer = setTimeout(() => {
        checkSlugAvailability(squaresSettings.publicSlug)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isSquares, squaresSettings.publicSlug, checkSlugAvailability])

  const canContinue = () => {
    if (!settings.name.trim()) return false
    if (isSquares && squaresSettings.publicSlug && !slugAvailable) return false
    if (isSingleGame && !squaresSettings.gameName.trim()) return false
    return true
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Pool Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your {isSquares ? 'squares' : 'golf'} pool.
        </p>
      </div>

      <div className="space-y-4">
        {/* Pool Name (all types) */}
        <div className="space-y-2">
          <Label htmlFor="name">Pool Name *</Label>
          <Input
            id="name"
            value={settings.name}
            onChange={(e) => onUpdate({ ...settings, name: e.target.value })}
            placeholder={isSquares ? 'Super Bowl Squares 2025' : 'Masters 2025'}
          />
        </div>

        {/* Season Label (all types) */}
        <div className="space-y-2">
          <Label htmlFor="seasonLabel">Season Label</Label>
          <Input
            id="seasonLabel"
            value={settings.seasonLabel}
            onChange={(e) => onUpdate({ ...settings, seasonLabel: e.target.value })}
            placeholder="2024-2025"
          />
          <p className="text-xs text-muted-foreground">Optional label for the season</p>
        </div>

        {/* Squares-specific settings */}
        {isSquares && (
          <>
            {/* Public Slug */}
            <div className="space-y-2">
              <Label htmlFor="publicSlug">Public URL Slug</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="publicSlug"
                  value={squaresSettings.publicSlug}
                  onChange={(e) =>
                    onUpdate({ ...squaresSettings, publicSlug: e.target.value.toLowerCase() })
                  }
                  placeholder="super-bowl-2025"
                />
                {checkingSlug && (
                  <span className="text-sm text-muted-foreground">Checking...</span>
                )}
                {!checkingSlug && slugAvailable && (
                  <span className="text-sm text-green-600">Available</span>
                )}
              </div>
              {slugError && <p className="text-sm text-destructive">{slugError}</p>}
              <p className="text-xs text-muted-foreground">
                Players can join at bnpools.com/squares/{squaresSettings.publicSlug || 'your-slug'}
              </p>
            </div>

            {/* Reverse Scoring */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Reverse Scoring</Label>
                <p className="text-xs text-muted-foreground">
                  Row/column headers assigned after squares are claimed
                </p>
              </div>
              <Switch
                checked={squaresSettings.reverseScoring}
                onCheckedChange={(checked) =>
                  onUpdate({ ...squaresSettings, reverseScoring: checked })
                }
              />
            </div>

            {/* Single Game specific settings */}
            {isSingleGame && (
              <>
                {/* Game Name */}
                <div className="space-y-2">
                  <Label htmlFor="gameName">Game Name *</Label>
                  <Input
                    id="gameName"
                    value={squaresSettings.gameName}
                    onChange={(e) =>
                      onUpdate({ ...squaresSettings, gameName: e.target.value })
                    }
                    placeholder="Super Bowl LIX"
                  />
                </div>

                {/* Teams */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="awayTeam">Away Team</Label>
                    <Input
                      id="awayTeam"
                      value={squaresSettings.awayTeam}
                      onChange={(e) =>
                        onUpdate({ ...squaresSettings, awayTeam: e.target.value })
                      }
                      placeholder="TBD"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="homeTeam">Home Team</Label>
                    <Input
                      id="homeTeam"
                      value={squaresSettings.homeTeam}
                      onChange={(e) =>
                        onUpdate({ ...squaresSettings, homeTeam: e.target.value })
                      }
                      placeholder="TBD"
                    />
                  </div>
                </div>

                {/* Scoring Mode */}
                <div className="space-y-2">
                  <Label>Scoring Mode</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({ ...squaresSettings, scoringMode: 'quarter' as ScoringMode })
                      }
                      className={`p-3 rounded-lg border text-left transition-all ${
                        squaresSettings.scoringMode === 'quarter'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm">Quarter Scoring</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Q1, Halftime, Q3, Final
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdate({ ...squaresSettings, scoringMode: 'score_change' as ScoringMode })
                      }
                      className={`p-3 rounded-lg border text-left transition-all ${
                        squaresSettings.scoringMode === 'score_change'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-sm">Every Score</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Payout on every score change
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* Golf-specific settings */}
        {isGolf && (
          <>
            {/* Min Tier Points */}
            <div className="space-y-2">
              <Label htmlFor="minTierPoints">Minimum Tier Points</Label>
              <Input
                id="minTierPoints"
                type="number"
                min={50}
                max={200}
                value={golfSettings.minTierPoints}
                onChange={(e) =>
                  onUpdate({ ...golfSettings, minTierPoints: parseInt(e.target.value) || 100 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Total tier points required for each entry (default: 100)
              </p>
            </div>

            {/* Picks Lock Time */}
            <div className="space-y-2">
              <Label htmlFor="picksLockAt">Picks Lock Time</Label>
              <Input
                id="picksLockAt"
                type="datetime-local"
                value={golfSettings.picksLockAt}
                onChange={(e) =>
                  onUpdate({ ...golfSettings, picksLockAt: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                When entries can no longer be modified
              </p>
            </div>

            {/* Public Entries */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Public Entries</Label>
                <p className="text-xs text-muted-foreground">
                  Allow anyone to view all entries
                </p>
              </div>
              <Switch
                checked={golfSettings.publicEntriesEnabled}
                onCheckedChange={(checked) =>
                  onUpdate({ ...golfSettings, publicEntriesEnabled: checked })
                }
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canContinue()}>
          Continue
        </Button>
      </div>
    </div>
  )
}
