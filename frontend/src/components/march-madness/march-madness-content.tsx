'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, ExternalLink, Check, X, Edit2 } from 'lucide-react'
import { BracketView } from './bracket-view'
import { StandingsTable } from './standings-table'
import { TeamDrawDisplay } from './team-draw-display'
import { RandomDrawButton } from './random-draw-button'
import type { MmGame, MmEntry, MmPoolTeam } from './game-card'

interface MmPool {
  id: string
  pool_id: string
  tournament_year: number
  draw_completed: boolean
  draw_completed_at: string | null
  sweet16_payout_pct: number
  elite8_payout_pct: number
  final4_payout_pct: number
  runnerup_payout_pct: number
  champion_payout_pct: number
  push_rule: string
  auto_sync_enabled: boolean
  public_slug: string | null
}

interface MarchMadnessContentProps {
  mmPool: MmPool
  poolId: string
  entries: MmEntry[]
  poolTeams: MmPoolTeam[]
  games: MmGame[]
  currentUserId: string
  isCommissioner: boolean
}

// Commissioner Tools Card with Public URL management
interface CommissionerToolsCardProps {
  mmPoolId: string
  poolId: string
  publicSlug: string | null
}

function CommissionerToolsCard({ mmPoolId, poolId, publicSlug }: CommissionerToolsCardProps) {
  const router = useRouter()
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const [slugInput, setSlugInput] = useState(publicSlug ?? '')
  const [isUpdatingSlug, setIsUpdatingSlug] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const publicUrl = publicSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/view/mm/${publicSlug}`
    : null

  const copyToClipboard = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  const handleUpdateSlug = async () => {
    const trimmedSlug = slugInput.trim().toLowerCase()
    if (!trimmedSlug) {
      setError('Please enter a valid slug')
      return
    }

    // Validate format
    if (!/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens')
      return
    }
    if (trimmedSlug.length < 3 || trimmedSlug.length > 50) {
      setError('Slug must be between 3 and 50 characters')
      return
    }

    setIsUpdatingSlug(true)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('mm_pools')
      .update({ public_slug: trimmedSlug })
      .eq('id', mmPoolId)

    if (updateError) {
      if (updateError.code === '23505') {
        setError('This slug is already in use. Please choose a different one.')
      } else {
        setError(updateError.message)
      }
      setIsUpdatingSlug(false)
      return
    }

    setIsUpdatingSlug(false)
    setIsEditingSlug(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Commissioner Tools</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/pools/${poolId}/march-madness/games`}>
              Enter Scores
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/pools/${poolId}/march-madness/entries`}>
              Manage Entries
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/pools/${poolId}/march-madness/setup`}>
              Edit Teams
            </Link>
          </Button>
        </div>

        {/* Public URL Section */}
        <div className="pt-4 border-t space-y-3">
          <Label>Public View URL</Label>
          {isEditingSlug ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="your-pool-name"
                  disabled={isUpdatingSlug}
                  className="flex-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleUpdateSlug}
                  disabled={isUpdatingSlug}
                  className="flex-1"
                >
                  <Check className="size-4 mr-1" />
                  {isUpdatingSlug ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditingSlug(false)
                    setSlugInput(publicSlug ?? '')
                    setError(null)
                  }}
                  disabled={isUpdatingSlug}
                  className="flex-1"
                >
                  <X className="size-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : publicUrl ? (
            <div className="space-y-2">
              {/* URL Display */}
              <div className="p-3 bg-muted rounded-md border">
                <p className="text-sm font-mono break-all text-foreground">
                  {publicUrl}
                </p>
              </div>
              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyToClipboard}
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <Check className="size-4 mr-1.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4 mr-1.5" />
                      Copy
                    </>
                  )}
                </Button>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 mr-1.5" />
                    Open
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingSlug(true)}
                  className="w-full"
                >
                  <Edit2 className="size-4 mr-1.5" />
                  Edit
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="your-pool-name"
                disabled={isUpdatingSlug}
              />
              <p className="text-xs text-muted-foreground">
                Your URL will be: {typeof window !== 'undefined' ? window.location.origin : ''}/view/mm/<span className="font-medium">{slugInput || 'your-pool-name'}</span>
              </p>
              <Button
                onClick={handleUpdateSlug}
                disabled={isUpdatingSlug || !slugInput.trim()}
                className="w-full"
              >
                {isUpdatingSlug ? 'Saving...' : 'Set Public URL'}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Share this URL with participants to view the bracket
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function MarchMadnessContent({
  mmPool,
  poolId,
  entries,
  poolTeams,
  games,
  currentUserId,
  isCommissioner,
}: MarchMadnessContentProps) {
  const [activeTab, setActiveTab] = useState('bracket')

  // Calculate stats
  const aliveCount = entries.filter(e => !e.eliminated).length
  const completedGames = games.filter(g => g.status === 'final').length
  const totalGames = games.length

  // Check setup status
  const teamsReady = poolTeams.length === 64
  const entriesReady = entries.length === 64
  const drawReady = mmPool.draw_completed

  // Check if setup is incomplete
  const needsSetup = !teamsReady || (!drawReady && !entriesReady)

  if (needsSetup && isCommissioner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pool Setup Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Setup checklist */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                teamsReady ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                {teamsReady ? '✓' : '1'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Add 64 Teams</p>
                <p className="text-sm text-muted-foreground">
                  {poolTeams.length}/64 teams added
                </p>
              </div>
              {!teamsReady && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/pools/${poolId}/march-madness/setup`}>
                    Add Teams
                  </Link>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                entriesReady ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                {entriesReady ? '✓' : '2'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Add 64 Entries</p>
                <p className="text-sm text-muted-foreground">
                  {entries.length}/64 participant names added
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/pools/${poolId}/march-madness/entries`}>
                  Add Entries
                </Link>
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                drawReady ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                {drawReady ? '✓' : '3'}
              </div>
              <div className="flex-1">
                <p className="font-medium">Run Random Draw</p>
                <p className="text-sm text-muted-foreground">
                  {drawReady ? 'Completed' : 'Waiting for 64 teams and 64 entries'}
                </p>
              </div>
              {teamsReady && entriesReady && !drawReady && (
                <RandomDrawButton
                  mmPoolId={mmPool.id}
                  entryCount={entries.length}
                  teamCount={poolTeams.length}
                  drawCompleted={mmPool.draw_completed}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (needsSetup && !isCommissioner) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Pool Setup in Progress</h3>
          <p className="text-muted-foreground mb-4">
            The commissioner is still setting up this pool.
          </p>
          <div className="flex justify-center gap-4">
            <Badge variant="outline">
              {poolTeams.length}/64 Teams
            </Badge>
            <Badge variant="outline">
              {entries.length}/64 Entries
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{aliveCount}</p>
            <p className="text-sm text-muted-foreground">Players Alive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{64 - aliveCount}</p>
            <p className="text-sm text-muted-foreground">Eliminated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{completedGames}</p>
            <p className="text-sm text-muted-foreground">Games Played</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalGames - completedGames}</p>
            <p className="text-sm text-muted-foreground">Games Remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bracket">Bracket</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="bracket" className="mt-4">
          <BracketView
            games={games}
            entries={entries}
            poolTeams={poolTeams}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="standings" className="mt-4">
          <StandingsTable
            entries={entries}
            poolTeams={poolTeams}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          <TeamDrawDisplay
            entries={entries}
            poolTeams={poolTeams}
            currentUserId={currentUserId}
            drawCompleted={mmPool.draw_completed}
          />
        </TabsContent>
      </Tabs>

      {/* Commissioner tools */}
      {isCommissioner && (
        <CommissionerToolsCard
          mmPoolId={mmPool.id}
          poolId={poolId}
          publicSlug={mmPool.public_slug}
        />
      )}
    </div>
  )
}
