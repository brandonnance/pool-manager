'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Check, Clock, MapPin, Trophy, AlertCircle, Loader2, CheckCircle2, RotateCcw, Globe, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

// Tier color configurations
const TIER_STYLES: Record<number, { bg: string; border: string; badge: string; label: string; desc: string }> = {
  1: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-600 text-white border-emerald-600',
    label: 'Elite',
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
    badge: 'bg-amber-500 text-white border-amber-500',
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

// Email validation regex
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

interface Golfer {
  id: string
  name: string
  country: string | null
  headshot_url: string | null
  owgr_rank: number | null
  tier_value: number
}

interface GolfPublicEntryFormProps {
  poolName: string
  tournamentName: string
  tournamentVenue: string | null
  lockTime: string | null
  gpPoolId: string
  poolId: string
  minTierPoints: number
  golfersByTier: Record<number, Golfer[]>
}

function createAnonClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
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

export function GolfPublicEntryForm({
  poolName,
  tournamentName,
  tournamentVenue,
  lockTime,
  gpPoolId,
  poolId,
  minTierPoints,
  golfersByTier,
}: GolfPublicEntryFormProps) {
  const [participantName, setParticipantName] = useState('')
  const [participantEmail, setParticipantEmail] = useState('')
  const [entryName, setEntryName] = useState('')
  const [honeypot, setHoneypot] = useState('') // Bot detection
  const [selectedGolfers, setSelectedGolfers] = useState<Map<string, Golfer>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submittedEntry, setSubmittedEntry] = useState<{ entryName: string; picks: string[] } | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isLocked, setIsLocked] = useState(false)

  // Calculate total tier points
  const totalTierPoints = Array.from(selectedGolfers.values()).reduce(
    (sum, g) => sum + g.tier_value,
    0
  )

  // Check if email is valid (for UI feedback)
  const emailValid = participantEmail.trim() === '' || isValidEmail(participantEmail.trim())

  // Check if form is valid
  const isFormValid =
    participantName.trim() !== '' &&
    participantEmail.trim() !== '' &&
    isValidEmail(participantEmail.trim()) &&
    entryName.trim() !== '' &&
    selectedGolfers.size === 6 &&
    totalTierPoints >= minTierPoints &&
    honeypot === '' // Bot check

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
    setSelectedGolfers((prev) => {
      const newMap = new Map(prev)
      if (newMap.has(golfer.id)) {
        newMap.delete(golfer.id)
      } else if (newMap.size < 6) {
        newMap.set(golfer.id, golfer)
      }
      return newMap
    })
  }, [])

  const handleSubmit = async () => {
    if (!isFormValid || isLocked) return

    // Double-check honeypot (bot detection)
    if (honeypot !== '') {
      setError('Submission rejected')
      return
    }

    setSubmitting(true)
    setError(null)

    const supabase = createAnonClient()

    // Server-side lock time validation happens via RLS policy
    // Create entry
    const { data: entry, error: entryError } = await supabase
      .from('gp_entries')
      .insert({
        pool_id: poolId,
        participant_name: participantName.trim(),
        participant_email: participantEmail.trim(),
        entry_name: entryName.trim(),
        submitted_at: new Date().toISOString(),
        verified: false,
      })
      .select('id')
      .single()

    if (entryError) {
      if (entryError.message.includes('lock') || entryError.code === '42501') {
        setError('Entries are now locked. Contact the commissioner if there was a problem.')
        setIsLocked(true)
      } else {
        setError(entryError.message || 'Failed to submit entry')
      }
      setSubmitting(false)
      return
    }

    // Create picks
    const picks = Array.from(selectedGolfers.values()).map((golfer) => ({
      entry_id: entry.id,
      golfer_id: golfer.id,
    }))

    const { error: picksError } = await supabase
      .from('gp_entry_picks')
      .insert(picks)

    if (picksError) {
      // Try to clean up the entry
      await supabase.from('gp_entries').delete().eq('id', entry.id)
      setError(picksError.message || 'Failed to save picks')
      setSubmitting(false)
      return
    }

    // Success
    setSubmitted(true)
    setSubmittedEntry({
      entryName: entryName.trim(),
      picks: Array.from(selectedGolfers.values()).map((g) => g.name),
    })
    setSubmitting(false)
  }

  const handleNewEntry = () => {
    setSubmitted(false)
    setSubmittedEntry(null)
    setParticipantName('')
    setParticipantEmail('')
    setEntryName('')
    setSelectedGolfers(new Map())
    setError(null)
  }

  // Locked modal
  if (isLocked && !submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold">Entries Are Locked</h2>
            <p className="text-muted-foreground">
              The entry deadline has passed. Contact the commissioner if you need assistance.
            </p>
            <div className="pt-4">
              <p className="text-sm text-muted-foreground">{poolName}</p>
              <p className="font-medium">{tournamentName}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success view
  if (submitted && submittedEntry) {
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
                <h2 className="text-xl font-bold">Entry Submitted!</h2>
                <p className="text-muted-foreground mt-1">
                  Your entry &quot;{submittedEntry.entryName}&quot; has been recorded.
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4 text-left">
                <p className="font-medium mb-2">Your Picks:</p>
                <ul className="space-y-1">
                  {submittedEntry.picks.map((name, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {i + 1}. {name}
                    </li>
                  ))}
                </ul>
              </div>

              <Button onClick={handleNewEntry} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Make Another Entry
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Entry form
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
                    <span className="text-muted-foreground/50">•</span>
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{tournamentVenue}</span>
                  </>
                )}
              </div>
            </div>
            {lockTime && timeRemaining !== null && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Entries lock in</div>
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
        {/* Entry Info Form */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Your Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={participantEmail}
                  onChange={(e) => setParticipantEmail(e.target.value)}
                  className={cn(
                    !emailValid && 'border-red-500 focus-visible:ring-red-500'
                  )}
                />
                {!emailValid && (
                  <p className="text-xs text-red-500">Please enter a valid email address</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryName">Entry Name *</Label>
              <Input
                id="entryName"
                placeholder="Give your entry a fun name"
                value={entryName}
                onChange={(e) => setEntryName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This will be shown on the leaderboard
              </p>
            </div>
            {/* Honeypot field - hidden from humans, visible to bots */}
            <div className="absolute -left-[9999px]" aria-hidden="true">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pick Sheet */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Select Your 6 Golfers</CardTitle>
            <CardDescription>
              Pick 6 golfers with a total of at least {minTierPoints} tier points.
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
                      Tier {tier}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{tierStyle.label}</span>
                      <span className="text-xs text-muted-foreground">
                        • {tierStyle.desc} • {tier} pt{tier !== 1 ? 's' : ''}
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
                                    Tier {tier} ({tier} pt{tier !== 1 ? 's' : ''})
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
              disabled={!isFormValid || submitting}
              className="shrink-0"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Entry'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
