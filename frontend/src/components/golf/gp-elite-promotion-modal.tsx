'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Crown, Loader2, ChevronUp, ChevronDown, Star, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Golfer {
  id: string
  name: string
  country: string | null
  owgrRank: number | null
  tier: number
}

interface GpElitePromotionModalProps {
  gpPoolId: string
  tournamentId: string | null
  locked?: boolean
}

export function GpElitePromotionModal({ gpPoolId, tournamentId, locked = false }: GpElitePromotionModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadGolfers = useCallback(async () => {
    if (!tournamentId) return

    setLoading(true)
    setError(null)

    const supabase = createClient()

    // Get golfers in tournament field with their tier assignments
    const { data: fieldData, error: fieldError } = await supabase
      .from('gp_tournament_field')
      .select(`
        golfer_id,
        gp_golfers!inner(id, name, country, owgr_rank)
      `)
      .eq('tournament_id', tournamentId)

    if (fieldError) {
      setError('Failed to load golfers')
      setLoading(false)
      return
    }

    // Get tier assignments
    const { data: tierData } = await supabase
      .from('gp_tier_assignments')
      .select('golfer_id, tier_value')
      .eq('pool_id', gpPoolId)

    const tierMap = new Map(tierData?.map(t => [t.golfer_id, t.tier_value]) ?? [])

    const golferList: Golfer[] = (fieldData ?? []).map(f => ({
      id: f.gp_golfers.id,
      name: f.gp_golfers.name,
      country: f.gp_golfers.country,
      owgrRank: f.gp_golfers.owgr_rank,
      tier: tierMap.get(f.gp_golfers.id) ?? 6,
    }))

    // Sort: Elite (0) first, then Tier 1 by OWGR rank
    golferList.sort((a, b) => {
      // Elite players first
      if (a.tier === 0 && b.tier !== 0) return -1
      if (b.tier === 0 && a.tier !== 0) return 1
      // Then Tier 1 players
      if (a.tier === 1 && b.tier !== 1) return -1
      if (b.tier === 1 && a.tier !== 1) return 1
      // Sort by OWGR rank within groups
      if (a.owgrRank && b.owgrRank) return a.owgrRank - b.owgrRank
      if (a.owgrRank) return -1
      if (b.owgrRank) return 1
      return a.name.localeCompare(b.name)
    })

    setGolfers(golferList)
    setLoading(false)
  }, [gpPoolId, tournamentId])

  useEffect(() => {
    if (open) {
      loadGolfers()
    }
  }, [open, loadGolfers])

  async function handlePromote(golferId: string) {
    setUpdating(golferId)
    setError(null)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('gp_tier_assignments')
      .upsert({
        pool_id: gpPoolId,
        golfer_id: golferId,
        tier_value: 0,
      }, {
        onConflict: 'pool_id,golfer_id',
      })

    if (updateError) {
      setError('Failed to promote golfer')
    } else {
      await loadGolfers()
    }

    setUpdating(null)
  }

  async function handleDemote(golferId: string) {
    setUpdating(golferId)
    setError(null)

    const supabase = createClient()

    // Demote back to Tier 1
    const { error: updateError } = await supabase
      .from('gp_tier_assignments')
      .upsert({
        pool_id: gpPoolId,
        golfer_id: golferId,
        tier_value: 1,
      }, {
        onConflict: 'pool_id,golfer_id',
      })

    if (updateError) {
      setError('Failed to demote golfer')
    } else {
      await loadGolfers()
    }

    setUpdating(null)
  }

  const elitePlayers = golfers.filter(g => g.tier === 0)
  const tier1Players = golfers.filter(g => g.tier === 1)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50">
          <Crown className="mr-2 h-4 w-4" />
          Elite Status
          {elitePlayers.length > 0 && (
            <Badge className="ml-2 bg-amber-500 text-white">{elitePlayers.length}</Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Elite Status (Tier 0)
          </DialogTitle>
          <DialogDescription>
            Promote exceptional players to Elite status. Reserved for players on extraordinary runs.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive px-3 py-2 rounded-md text-sm">
            {error}
          </div>
        )}

        {locked && (
          <div className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-md flex items-start gap-2">
            <Lock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <span className="font-medium">Locked.</span> Entries have been submitted. Elite status changes are disabled.
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !tournamentId ? (
          <div className="text-center py-8 text-muted-foreground">
            Link a tournament first to manage elite players.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Current Elite Players */}
            <div>
              <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                Current Elite Players
              </h3>
              {elitePlayers.length === 0 ? (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                  No players have been promoted to Elite status.
                </div>
              ) : (
                <div className="space-y-1">
                  {elitePlayers.map(golfer => (
                    <div
                      key={golfer.id}
                      className="flex items-center justify-between p-2 rounded-md bg-amber-50 border border-amber-200"
                    >
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <div>
                          <div className="font-medium text-sm">{golfer.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {golfer.owgrRank ? `OWGR #${golfer.owgrRank}` : 'Unranked'}
                            {golfer.country && ` • ${golfer.country}`}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDemote(golfer.id)}
                        disabled={updating === golfer.id || locked}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {updating === golfer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Demote
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tier 1 Players (Promotion Candidates) */}
            <div>
              <h3 className="text-sm font-semibold text-purple-600 mb-2">
                Tier 1 Players (Promotion Candidates)
              </h3>
              {tier1Players.length === 0 ? (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                  No Tier 1 players available. Assign tiers first.
                </div>
              ) : (
                <div className="space-y-1">
                  {tier1Players.map(golfer => (
                    <div
                      key={golfer.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"
                    >
                      <div>
                        <div className="font-medium text-sm">{golfer.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {golfer.owgrRank ? `OWGR #${golfer.owgrRank}` : 'Unranked'}
                          {golfer.country && ` • ${golfer.country}`}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePromote(golfer.id)}
                        disabled={updating === golfer.id || locked}
                        className="border-amber-500 text-amber-600 hover:bg-amber-50"
                      >
                        {updating === golfer.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Promote
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
