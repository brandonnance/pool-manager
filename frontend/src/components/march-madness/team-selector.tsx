'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface BbTeam {
  id: string
  name: string
  abbrev: string | null
}

interface SelectedTeam {
  teamId: string
  seed: number
  region: string
}

interface TeamSelectorProps {
  mmPoolId: string
  existingTeams: Array<{
    id: string
    team_id: string
    seed: number
    region: string
    bb_teams: { id: string; name: string; abbrev: string | null } | null
  }>
}

const REGIONS = ['East', 'West', 'South', 'Midwest'] as const
const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1)

export function TeamSelector({ mmPoolId, existingTeams }: TeamSelectorProps) {
  const [availableTeams, setAvailableTeams] = useState<BbTeam[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [selectedSeed, setSelectedSeed] = useState<string>('')
  const [selectedRegion, setSelectedRegion] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Load available teams
  useEffect(() => {
    const loadTeams = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('bb_teams')
        .select('id, name, abbrev')
        .order('name')

      if (data) {
        setAvailableTeams(data)
      }
    }
    loadTeams()
  }, [])

  // Get used team IDs, seeds, and regions
  const usedTeamIds = new Set(existingTeams.map(t => t.team_id))
  const usedSeeds = new Map<string, Set<number>>()
  REGIONS.forEach(region => {
    usedSeeds.set(
      region,
      new Set(
        existingTeams
          .filter(t => t.region === region)
          .map(t => t.seed)
      )
    )
  })

  // Filter teams by search query and exclude already selected
  const filteredTeams = availableTeams
    .filter(t => !usedTeamIds.has(t.id))
    .filter(t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.abbrev && t.abbrev.toLowerCase().includes(searchQuery.toLowerCase()))
    )

  // Get available seeds for selected region
  const availableSeeds = selectedRegion
    ? SEEDS.filter(s => !usedSeeds.get(selectedRegion)?.has(s))
    : []

  const handleAddTeam = async () => {
    if (!selectedTeam || !selectedSeed || !selectedRegion) {
      setError('Please select a team, seed, and region')
      return
    }

    setError(null)
    setIsSubmitting(true)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('mm_pool_teams').insert({
      mm_pool_id: mmPoolId,
      team_id: selectedTeam,
      seed: parseInt(selectedSeed),
      region: selectedRegion,
    })

    if (insertError) {
      setError(insertError.message)
      setIsSubmitting(false)
      return
    }

    // Reset form and refresh
    setSelectedTeam(null)
    setSelectedSeed('')
    setSelectedRegion('')
    setSearchQuery('')
    setIsSubmitting(false)
    router.refresh()
  }

  const handleRemoveTeam = async (poolTeamId: string) => {
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('mm_pool_teams')
      .delete()
      .eq('id', poolTeamId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    router.refresh()
  }

  // Group existing teams by region
  const teamsByRegion = new Map<string, typeof existingTeams>()
  REGIONS.forEach(region => {
    teamsByRegion.set(
      region,
      existingTeams
        .filter(t => t.region === region)
        .sort((a, b) => a.seed - b.seed)
    )
  })

  return (
    <div className="space-y-6">
      {/* Add team form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Add Team</span>
            <Badge variant="outline">{existingTeams.length} / 64</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Team search */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Team</label>
              <Input
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && filteredTeams.length > 0 && (
                <div className="max-h-40 overflow-y-auto border rounded-md bg-background">
                  {filteredTeams.slice(0, 10).map(team => (
                    <button
                      key={team.id}
                      onClick={() => {
                        setSelectedTeam(team.id)
                        setSearchQuery(team.name)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                        selectedTeam === team.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      {team.name} {team.abbrev && `(${team.abbrev})`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Region select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Region</label>
              <Select value={selectedRegion} onValueChange={(v) => {
                setSelectedRegion(v)
                setSelectedSeed('') // Reset seed when region changes
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map(region => (
                    <SelectItem key={region} value={region}>
                      {region} ({16 - (usedSeeds.get(region)?.size || 0)} spots)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seed select */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Seed</label>
              <Select
                value={selectedSeed}
                onValueChange={setSelectedSeed}
                disabled={!selectedRegion}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select seed" />
                </SelectTrigger>
                <SelectContent>
                  {availableSeeds.map(seed => (
                    <SelectItem key={seed} value={seed.toString()}>
                      #{seed}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleAddTeam}
            disabled={!selectedTeam || !selectedSeed || !selectedRegion || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Team'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing teams by region */}
      <div className="grid gap-4 md:grid-cols-2">
        {REGIONS.map(region => {
          const regionTeams = teamsByRegion.get(region) || []
          const isEmpty = regionTeams.length === 0

          return (
            <Card key={region}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{region} Region</span>
                  <Badge variant={regionTeams.length === 16 ? 'default' : 'secondary'}>
                    {regionTeams.length} / 16
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isEmpty ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No teams added yet
                  </p>
                ) : (
                  <div className="space-y-1">
                    {regionTeams.map(team => (
                      <div
                        key={team.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-muted-foreground w-6 text-center">
                            {team.seed}
                          </span>
                          <span>{team.bb_teams?.name || 'Unknown'}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveTeam(team.id)}
                        >
                          &times;
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
