'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Check, Clock, MapPin, Trophy, AlertCircle, Loader2, CheckCircle2, Lock, Award } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// Tier color configurations
const TIER_STYLES: Record<number, { bg: string; border: string; badge: string; label: string; desc: string }> = {
  0: {
    bg: 'bg-amber-100',
    border: 'border-amber-400',
    badge: 'bg-amber-500 text-white border-amber-500',
    label: 'Elite',
    desc: 'Hot Streak',
  },
  1: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-600 text-white border-emerald-600',
    label: 'Premier',
    desc: 'OWGR 1-15',
  },
  2: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-600 text-white border-blue-600',
    label: 'Top',
    desc: 'OWGR 16-40',
  },
  3: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    badge: 'bg-violet-600 text-white border-violet-600',
    label: 'Solid',
    desc: 'OWGR 41-75',
  },
  4: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-500 text-white border-orange-500',
    label: 'Mid',
    desc: 'OWGR 76-125',
  },
  5: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-600 text-white border-amber-600',
    label: 'Value',
    desc: 'OWGR 126-200',
  },
  6: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    badge: 'bg-slate-500 text-white border-slate-500',
    label: 'Longshot',
    desc: 'OWGR 200+',
  },
}

// Country code to flag emoji
function getCountryFlag(country: string | null): string {
  if (!country) return ''

  const countryFlags: Record<string, string> = {
    'USA': '🇺🇸', 'United States': '🇺🇸',
    'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'NIR': '🇬🇧', 'Northern Ireland': '🇬🇧',
    'WAL': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    'IRL': '🇮🇪', 'Ireland': '🇮🇪',
    'ESP': '🇪🇸', 'Spain': '🇪🇸',
    'GER': '🇩🇪', 'Germany': '🇩🇪',
    'FRA': '🇫🇷', 'France': '🇫🇷',
    'ITA': '🇮🇹', 'Italy': '🇮🇹',
    'AUS': '🇦🇺', 'Australia': '🇦🇺',
    'CAN': '🇨🇦', 'Canada': '🇨🇦',
    'RSA': '🇿🇦', 'South Africa': '🇿🇦',
    'JPN': '🇯🇵', 'Japan': '🇯🇵',
    'KOR': '🇰🇷', 'South Korea': '🇰🇷', 'Korea': '🇰🇷',
    'SWE': '🇸🇪', 'Sweden': '🇸🇪',
    'NOR': '🇳🇴', 'Norway': '🇳🇴',
    'DEN': '🇩🇰', 'Denmark': '🇩🇰',
    'MEX': '🇲🇽', 'Mexico': '🇲🇽',
    'ARG': '🇦🇷', 'Argentina': '🇦🇷',
    'CHI': '🇨🇱', 'Chile': '🇨🇱',
    'COL': '🇨🇴', 'Colombia': '🇨🇴',
    'NZL': '🇳🇿', 'New Zealand': '🇳🇿',
    'CHN': '🇨🇳', 'China': '🇨🇳',
    'TPE': '🇹🇼', 'Taiwan': '🇹🇼', 'Chinese Taipei': '🇹🇼',
    'THA': '🇹🇭', 'Thailand': '🇹🇭',
    'IND': '🇮🇳', 'India': '🇮🇳',
    'PHI': '🇵🇭', 'Philippines': '🇵🇭',
    'BEL': '🇧🇪', 'Belgium': '🇧🇪',
    'NED': '🇳🇱', 'Netherlands': '🇳🇱',
    'AUT': '🇦🇹', 'Austria': '🇦🇹',
    'FIN': '🇫🇮', 'Finland': '🇫🇮',
    'POR': '🇵🇹', 'Portugal': '🇵🇹',
    'VEN': '🇻🇪', 'Venezuela': '🇻🇪',
    'PAR': '🇵🇾', 'Paraguay': '🇵🇾',
    'PUR': '🇵🇷', 'Puerto Rico': '🇵🇷',
    'ZIM': '🇿🇼', 'Zimbabwe': '🇿🇼',
  }

  return countryFlags[country] || '🌍'
}

interface Golfer {
  id: string
  name: string
  country: string | null
  headshot_url: string | null
  owgr_rank: number | null
  tier_value: number
}

interface GolfPublicEditFormProps {
  poolName: string
  tournamentName: string
  tournamentVenue: string | null
  lockTime: string | null
  gpPoolId: string
  poolId: string
  minTierPoints: number
  golfersByTier: Record<number, Golfer[]>
  entryId: string
  entryName: string
  participantName: string
  participantEmail: string
  currentPicks: Set<string>
  golferMap: Map<string, Golfer>
  editToken: string
  isLocked: boolean
  lockReason: 'locked' | 'expired' | null
  slug: string
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00:00'

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return `${days}d ${remainingHours}h ${minutes.toString().padStart(2, '0')}m`
  }

  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export function GolfPublicEditForm({
  poolName,
  tournamentName,
  tournamentVenue,
  lockTime,
  gpPoolId,
  poolId,
  minTierPoints,
  golfersByTier,
  entryId,
  entryName,
  participantName,
  participantEmail,
  currentPicks,
  golferMap,
  editToken,
  isLocked: initialIsLocked,
  lockReason,
  slug,
}: GolfPublicEditFormProps) {
  // Initialize selected golfers from current picks
  const [selectedGolfers, setSelectedGolfers] = useState<Map<string, Golfer>>(() => {
    const map = new Map<string, Golfer>()
    for (const golferId of currentPicks) {
      const golfer = golferMap.get(golferId)
      if (golfer) {
        map.set(golferId, golfer)
      }
    }
    return map
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isLocked, setIsLocked] = useState(initialIsLocked)

  // Calculate total tier points
  const totalTierPoints = Array.from(selectedGolfers.values()).reduce(
    (sum, g) => sum + g.tier_value,
    0
  )

  // Check if form is valid
  const isFormValid =
    selectedGolfers.size === 6 &&
    totalTierPoints >= minTierPoints

  // Check if picks have changed
  const hasChanges = (() => {
    if (selectedGolfers.size !== currentPicks.size) return true
    for (const golferId of selectedGolfers.keys()) {
      if (!currentPicks.has(golferId)) return true
    }
    return false
  })()

  // Countdown timer
  useEffect(() => {
    if (!lockTime) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const lock = new Date(lockTime).getTime()
      const remaining = lock - now

      if (remaining <= 0) {
        setTimeRemaining(0)
        setIsLocked(true)
      } else {
        setTimeRemaining(remaining)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [lockTime])

  const handleGolferSelect = useCallback((golfer: Golfer) => {
    if (isLocked) return

    setSelectedGolfers((prev) => {
      const newMap = new Map(prev)
      if (newMap.has(golfer.id)) {
        newMap.delete(golfer.id)
      } else if (newMap.size < 6) {
        newMap.set(golfer.id, golfer)
      }
      return newMap
    })
  }, [isLocked])

  const handleSubmit = async () => {
    if (!isFormValid || isLocked || !hasChanges) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/golf/update-public-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId,
          editToken,
          golferIds: Array.from(selectedGolfers.keys()),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403) {
          setError('Entry editing is locked. Contact the commissioner if you need to make changes.')
          setIsLocked(true)
        } else {
          setError(data.error || 'Failed to update entry')
        }
        return
      }

      setSubmitted(true)
    } catch (err) {
      setError('Failed to update entry. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Locked modal
  if (isLocked && !submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold">
              {lockReason === 'expired' ? 'Edit Link Expired' : 'Entry Editing Locked'}
            </h2>
            <p className="text-muted-foreground">
              {lockReason === 'expired'
                ? 'This edit link has expired. Contact the commissioner if you need to make changes.'
                : 'The entry deadline has passed. Contact the commissioner if you need to make changes.'}
            </p>
            <div className="pt-4">
              <p className="text-sm text-muted-foreground">{poolName}</p>
              <p className="font-medium">{tournamentName}</p>
            </div>
            <Link
              href={`/pools/golf/${slug}`}
              className="inline-block mt-4 text-primary hover:underline"
            >
              View Leaderboard
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success view
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <h1 className="text-2xl font-bold text-gray-900">{poolName}</h1>
            <p className="text-sm text-muted-foreground mt-1">{tournamentName}</p>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4">
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Entry Updated!</h2>
                <p className="text-muted-foreground mt-1">
                  Your entry &quot;{entryName}&quot; has been updated.
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4 text-left">
                <p className="font-medium mb-2">Your Updated Picks:</p>
                <ul className="space-y-1">
                  {Array.from(selectedGolfers.values())
                    .sort((a, b) => a.tier_value - b.tier_value)
                    .map((golfer, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        <span className="inline-block w-8 text-xs font-medium text-gray-500">
                          T{golfer.tier_value}
                        </span>
                        {golfer.name}
                      </li>
                    ))}
                </ul>
              </div>

              <Link
                href={`/pools/golf/${slug}`}
                className="inline-flex items-center justify-center rounded-md bg-primary text-white px-6 py-3 font-medium hover:bg-primary/90"
              >
                View Leaderboard
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Edit form
  const tiers = Object.keys(golfersByTier)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{poolName}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                <Trophy className="h-3.5 w-3.5" />
                <span>{tournamentName}</span>
                {tournamentVenue && (
                  <>
                    <span className="text-muted-foreground/50">|</span>
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{tournamentVenue}</span>
                  </>
                )}
              </div>
            </div>
            {lockTime && timeRemaining !== null && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Edit until</div>
                <div className={cn(
                  'font-mono font-bold text-lg',
                  timeRemaining < 60 * 60 * 1000 && 'text-amber-600',
                  timeRemaining < 15 * 60 * 1000 && 'text-red-600'
                )}>
                  <Clock className="h-4 w-4 inline mr-1" />
                  {formatCountdown(timeRemaining)}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-32 space-y-6">
        {/* Entry Info */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Check className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Editing: {entryName}</p>
                <p className="text-sm text-muted-foreground">
                  Submitted by {participantName} ({participantEmail})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pick Sheet */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Edit Your 6 Golfers</CardTitle>
            <CardDescription>
              Select 6 golfers with a total of at least {minTierPoints} tier points.
              Click a golfer to select/deselect.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-3 sm:px-6">
            {tiers.map((tier) => {
              const tierStyle = TIER_STYLES[tier] || TIER_STYLES[6]
              return (
                <div
                  key={tier}
                  className={cn(
                    'rounded-xl border-2 p-4',
                    tierStyle.bg,
                    tierStyle.border
                  )}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className={cn('font-bold text-sm px-3 py-1', tierStyle.badge)}>
                      {tier === 0 ? 'Elite' : `Tier ${tier}`}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{tierStyle.label}</span>
                      <span className="text-xs text-muted-foreground">
                        | {tierStyle.desc} | {tier} pt{tier !== 1 && tier !== 0 ? 's' : ''}
                      </span>
                    </div>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {golfersByTier[tier]?.length || 0} golfers
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {golfersByTier[tier]?.map((golfer) => {
                      const isSelected = selectedGolfers.has(golfer.id)
                      const canSelect = selectedGolfers.size < 6 || isSelected
                      const countryFlag = getCountryFlag(golfer.country)

                      return (
                        <HoverCard key={golfer.id} openDelay={200} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <button
                              onClick={() => handleGolferSelect(golfer)}
                              disabled={!canSelect}
                              className={cn(
                                'p-3 rounded-lg border-2 text-left transition-all bg-white',
                                'hover:border-primary/50 hover:shadow-md hover:scale-[1.02]',
                                isSelected && 'border-primary bg-primary/10 ring-2 ring-primary shadow-md',
                                !canSelect && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {isSelected && (
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className={cn(
                                    'font-medium text-sm truncate',
                                    isSelected && 'text-primary'
                                  )}>
                                    {countryFlag && <span className="mr-1">{countryFlag}</span>}
                                    {golfer.name}
                                  </p>
                                  {golfer.owgr_rank && (
                                    <p className="text-xs text-muted-foreground">
                                      #{golfer.owgr_rank} OWGR
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent side="top" className="w-72">
                            <div className="flex gap-4">
                              {golfer.headshot_url && (
                                <div className="shrink-0">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={golfer.headshot_url}
                                    alt={golfer.name}
                                    className="w-16 h-16 rounded-full object-cover bg-gray-100"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                </div>
                              )}
                              <div className="space-y-2 flex-1 min-w-0">
                                <div>
                                  <h4 className="font-semibold text-base">{golfer.name}</h4>
                                  {golfer.country && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                      <span className="text-base">{countryFlag}</span>
                                      {golfer.country}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {golfer.owgr_rank && (
                                    <Badge variant="outline" className="text-xs">
                                      <Award className="h-3 w-3 mr-1" />
                                      OWGR #{golfer.owgr_rank}
                                    </Badge>
                                  )}
                                  <Badge className={cn('text-xs', tierStyle.badge)}>
                                    {tier === 0 ? 'Elite (0 pts)' : `Tier ${tier} (${tier} pt${tier !== 1 ? 's' : ''})`}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </main>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Picks</p>
                  <p className={cn(
                    'font-bold',
                    selectedGolfers.size === 6 ? 'text-green-600' : ''
                  )}>
                    {selectedGolfers.size} / 6
                  </p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <p className="text-sm text-muted-foreground">Tier Points</p>
                  <p className={cn(
                    'font-bold',
                    totalTierPoints >= minTierPoints ? 'text-green-600' : 'text-amber-600'
                  )}>
                    {totalTierPoints} / {minTierPoints} min
                  </p>
                </div>
              </div>
              {selectedGolfers.size > 0 && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {Array.from(selectedGolfers.values()).map(g => g.name).join(', ')}
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!isFormValid || submitting || !hasChanges}
              className="shrink-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : !hasChanges ? (
                'No Changes'
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
