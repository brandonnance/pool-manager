'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Loader2, Search, Check, X, Pencil, User } from 'lucide-react'
import Link from 'next/link'
import { getTierColor, getTierLabel, getTierPoints } from '@/lib/golf/types'
import { validateRoster } from '@/lib/golf/validation'
import { cn } from '@/lib/utils'

interface Entry {
  id: string
  entryName: string | null
  entryNumber: number | null
  submittedAt: string | null
  userId: string
  userName: string | null
  userEmail: string | null
  picks: {
    golferId: string
    golferName: string
    tier: number
  }[]
}

interface Golfer {
  id: string
  name: string
  country: string | null
  tier: number
}

export default function GolfEntriesPage() {
  const params = useParams()
  const router = useRouter()
  const poolId = params.id as string
  const supabase = createClient()
  const loadingRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pool, setPool] = useState<{ name: string } | null>(null)
  const [tournament, setTournament] = useState<{ name: string } | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [minTierPoints, setMinTierPoints] = useState(21)
  const [isCommissioner, setIsCommissioner] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Edit state
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [editPicks, setEditPicks] = useState<Entry['picks']>([])
  const [golferSearch, setGolferSearch] = useState('')

  useEffect(() => {
    if (loadingRef.current) return
    loadingRef.current = true
    loadData()
  }, [poolId])

  async function loadData() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Get pool info
    const { data: poolData } = await supabase
      .from('pools')
      .select('name, org_id')
      .eq('id', poolId)
      .single()

    if (!poolData) {
      setError('Pool not found')
      setLoading(false)
      return
    }

    setPool({ name: poolData.name })

    // Check if commissioner
    const { data: poolMembership } = await supabase
      .from('pool_memberships')
      .select('role')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .single()

    const { data: orgMembership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', poolData.org_id)
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    const commissioner = poolMembership?.role === 'commissioner' ||
                        orgMembership?.role === 'admin' ||
                        profile?.is_super_admin

    if (!commissioner) {
      setError('You must be a commissioner to manage entries')
      setLoading(false)
      return
    }

    setIsCommissioner(true)

    // Get golf pool config
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('id, tournament_id, min_tier_points')
      .eq('pool_id', poolId)
      .single()

    if (!gpPool || !gpPool.tournament_id) {
      setError('Golf pool not configured')
      setLoading(false)
      return
    }

    setMinTierPoints(gpPool.min_tier_points ?? 21)

    // Get tournament info
    const { data: tournamentData } = await supabase
      .from('gp_tournaments')
      .select('name')
      .eq('id', gpPool.tournament_id)
      .single()

    setTournament(tournamentData)

    // Get all golfers with tiers for this pool
    const { data: fieldData } = await supabase
      .from('gp_tournament_field')
      .select('golfer_id')
      .eq('tournament_id', gpPool.tournament_id)

    const { data: tierData } = await supabase
      .from('gp_tier_assignments')
      .select('golfer_id, tier_value')
      .eq('pool_id', gpPool.id)

    const tierMap = new Map(tierData?.map(t => [t.golfer_id, t.tier_value]) || [])

    const { data: golferData } = await supabase
      .from('gp_golfers')
      .select('id, name, country')
      .in('id', fieldData?.map(f => f.golfer_id) || [])

    const golferList: Golfer[] = (golferData || []).map(g => ({
      id: g.id,
      name: g.name,
      country: g.country,
      tier: tierMap.get(g.id) ?? 5,
    })).sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier
      return a.name.localeCompare(b.name)
    })

    setGolfers(golferList)

    // Get all entries
    const { data: entryData } = await supabase
      .from('gp_entries')
      .select('id, entry_name, entry_number, submitted_at, user_id')
      .eq('pool_id', poolId)
      .order('created_at')

    // Get user profiles for all entries
    const userIds = [...new Set(entryData?.map(e => e.user_id) || [])]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', userIds)

    const profileMap = new Map(profilesData?.map(p => [p.id, p]) || [])

    // Get picks for all entries
    const entryIds = entryData?.map(e => e.id) || []
    const { data: picksData } = await supabase
      .from('gp_entry_picks')
      .select('entry_id, golfer_id')
      .in('entry_id', entryIds)

    // Build entry list with picks
    const entriesList: Entry[] = (entryData || []).map(e => {
      const entryPicks = (picksData || [])
        .filter(p => p.entry_id === e.id)
        .map(p => {
          const golfer = golferList.find(g => g.id === p.golfer_id)
          return {
            golferId: p.golfer_id,
            golferName: golfer?.name ?? 'Unknown',
            tier: golfer?.tier ?? 5,
          }
        })

      const profile = profileMap.get(e.user_id)

      return {
        id: e.id,
        entryName: e.entry_name,
        entryNumber: e.entry_number,
        submittedAt: e.submitted_at,
        userId: e.user_id,
        userName: profile?.display_name ?? null,
        userEmail: profile?.email ?? null,
        picks: entryPicks,
      }
    })

    setEntries(entriesList)
    setLoading(false)
  }

  function openEditSheet(entry: Entry) {
    setEditingEntry(entry)
    setEditPicks([...entry.picks])
    setGolferSearch('')
  }

  function toggleGolferInEdit(golfer: Golfer) {
    const existingIndex = editPicks.findIndex(p => p.golferId === golfer.id)

    if (existingIndex >= 0) {
      setEditPicks(editPicks.filter(p => p.golferId !== golfer.id))
    } else if (editPicks.length < 6) {
      setEditPicks([...editPicks, {
        golferId: golfer.id,
        golferName: golfer.name,
        tier: golfer.tier,
      }])
    }
  }

  async function saveEditedPicks() {
    if (!editingEntry) return

    const validation = validateRoster(editPicks, minTierPoints)
    if (!validation.valid) {
      setError(validation.errors.join('. '))
      return
    }

    setSaving(true)
    setError(null)

    // Delete existing picks
    await supabase
      .from('gp_entry_picks')
      .delete()
      .eq('entry_id', editingEntry.id)

    // Insert new picks
    const pickInserts = editPicks.map(p => ({
      entry_id: editingEntry.id,
      golfer_id: p.golferId,
    }))

    const { error: insertError } = await supabase
      .from('gp_entry_picks')
      .insert(pickInserts)

    if (insertError) {
      setError('Failed to save picks')
      setSaving(false)
      return
    }

    // Update entry submitted_at
    await supabase
      .from('gp_entries')
      .update({ submitted_at: new Date().toISOString() })
      .eq('id', editingEntry.id)

    // Update local state
    setEntries(entries.map(e =>
      e.id === editingEntry.id
        ? { ...e, picks: editPicks, submittedAt: new Date().toISOString() }
        : e
    ))

    setEditingEntry(null)
    setSaving(false)
  }

  // Filter entries by search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries
    const query = searchQuery.toLowerCase()
    return entries.filter(e =>
      e.userName?.toLowerCase().includes(query) ||
      e.userEmail?.toLowerCase().includes(query) ||
      e.entryName?.toLowerCase().includes(query)
    )
  }, [entries, searchQuery])

  // Filter golfers in edit sheet
  const filteredGolfers = useMemo(() => {
    if (!golferSearch.trim()) return golfers
    const query = golferSearch.toLowerCase()
    return golfers.filter(g =>
      g.name.toLowerCase().includes(query) ||
      g.country?.toLowerCase().includes(query)
    )
  }, [golfers, golferSearch])

  // Group golfers by tier for edit sheet
  const golfersByTier = useMemo(() => {
    const grouped = new Map<number, Golfer[]>()
    for (let i = 0; i <= 6; i++) grouped.set(i, [])

    filteredGolfers.forEach(g => {
      const list = grouped.get(g.tier) || []
      list.push(g)
      grouped.set(g.tier, list)
    })

    return grouped
  }, [filteredGolfers])

  const editValidation = useMemo(() => validateRoster(editPicks, minTierPoints), [editPicks, minTierPoints])
  const editTierPoints = useMemo(() => editPicks.reduce((sum, p) => sum + getTierPoints(p.tier), 0), [editPicks])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !isCommissioner) {
    return (
      <div className="space-y-4">
        <Link href={`/pools/${poolId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Pool
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href={`/pools/${poolId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" />
          Back to {pool?.name}
        </Link>
        <h1 className="text-2xl font-bold">Manage Entries</h1>
        <p className="text-muted-foreground">
          {tournament?.name} - {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No entries found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Picks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium">{entry.userName || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{entry.userEmail}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.entryName || `Entry ${entry.entryNumber}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {entry.picks.length === 0 ? (
                          <span className="text-muted-foreground text-sm">No picks</span>
                        ) : (
                          entry.picks.slice(0, 3).map((pick, i) => (
                            <span
                              key={pick.golferId}
                              className={cn(
                                'inline-block px-1.5 py-0.5 rounded text-xs text-white',
                                getTierColor(pick.tier)
                              )}
                            >
                              {pick.golferName.split(' ').pop()}
                            </span>
                          ))
                        )}
                        {entry.picks.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{entry.picks.length - 3} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.picks.length === 6 ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                          <Check className="h-3.5 w-3.5" />
                          Complete
                        </span>
                      ) : (
                        <span className="text-yellow-600 text-sm">
                          {entry.picks.length}/6 picks
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditSheet(entry)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Entry Sheet */}
      <Sheet open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Entry</SheetTitle>
            <SheetDescription>
              {editingEntry?.userName || 'Unknown'} - {editingEntry?.entryName || `Entry ${editingEntry?.entryNumber}`}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Current Picks */}
            <div>
              <h4 className="text-sm font-medium mb-2">
                Selected Golfers ({editPicks.length}/6) - {editTierPoints}/{minTierPoints} pts
              </h4>
              <div className="flex flex-wrap gap-2">
                {editPicks.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No golfers selected</span>
                ) : (
                  editPicks.map(pick => (
                    <div
                      key={pick.golferId}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-white',
                        getTierColor(pick.tier)
                      )}
                    >
                      {pick.golferName}
                      <button
                        onClick={() => setEditPicks(editPicks.filter(p => p.golferId !== pick.golferId))}
                        className="ml-1 hover:bg-white/20 rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              {editValidation.errors.length > 0 && (
                <p className="text-sm text-destructive mt-2">
                  {editValidation.errors.join(' • ')}
                </p>
              )}
            </div>

            {/* Golfer Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search golfers..."
                value={golferSearch}
                onChange={(e) => setGolferSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Golfers by Tier */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {Array.from({ length: 7 }, (_, tier) => {
                const tierGolfers = golfersByTier.get(tier) || []
                if (tierGolfers.length === 0) return null

                return (
                  <div key={tier}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('px-2 py-0.5 rounded text-xs text-white', getTierColor(tier))}>
                        {getTierLabel(tier)}
                      </span>
                      <span className="text-xs text-muted-foreground">{getTierPoints(tier)} pts</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {tierGolfers.map(golfer => {
                        const isSelected = editPicks.some(p => p.golferId === golfer.id)
                        const canSelect = isSelected || editPicks.length < 6

                        return (
                          <button
                            key={golfer.id}
                            onClick={() => toggleGolferInEdit(golfer)}
                            disabled={!canSelect}
                            className={cn(
                              'text-left px-2 py-1.5 rounded text-sm transition-colors',
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : canSelect
                                ? 'hover:bg-muted'
                                : 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">{golfer.name}</span>
                              {isSelected && <Check className="h-3 w-3 flex-shrink-0" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Save Button */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setEditingEntry(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={saveEditedPicks}
                disabled={saving || !editValidation.valid}
                className="flex-1"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Picks
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
