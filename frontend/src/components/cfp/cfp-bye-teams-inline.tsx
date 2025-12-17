'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TeamAutocomplete } from '../games/team-autocomplete'

interface Team {
  id: string
  name: string
  abbrev: string | null
  logo_url?: string | null
  color?: string | null
}

interface ByeTeam {
  id: string
  seed: number
  team_id: string | null
  team: Team | null
}

interface CfpByeTeamsInlineProps {
  poolId: string
  byeTeams: ByeTeam[]
  teams: Team[]
}

export function CfpByeTeamsInline({ poolId, byeTeams, teams }: CfpByeTeamsInlineProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()
  const hasCreated = useRef(false)

  // Auto-create bye records if they don't exist
  useEffect(() => {
    if (byeTeams.length === 0 && !hasCreated.current && !isCreating) {
      hasCreated.current = true
      const createByeRecords = async () => {
        setIsCreating(true)
        const supabase = createClient()

        const { error } = await supabase
          .from('bb_cfp_pool_byes')
          .insert(
            [1, 2, 3, 4].map(seed => ({
              pool_id: poolId,
              seed,
              team_id: null
            }))
          )

        if (error) {
          console.error('Error creating bye records:', error)
        }

        setIsCreating(false)
        router.refresh()
      }
      createByeRecords()
    }
  }, [byeTeams.length, poolId, router, isCreating])

  const handleTeamChange = async (seed: number, teamId: string) => {
    const bye = byeTeams.find(b => b.seed === seed)
    if (!bye) return

    const supabase = createClient()

    // Check if team changed - if so, delete ALL CFP picks for the pool
    const teamChanged = teamId !== bye.team_id

    if (teamChanged && bye.team_id) {
      // Only prompt if there was an existing team (meaning picks might exist)
      const confirmed = confirm(
        'Changing a bye team will delete ALL CFP bracket picks for ALL users in this pool. ' +
        'Users will need to redo their entire bracket. Are you sure you want to continue?'
      )
      if (!confirmed) {
        return
      }

      // Get all entry IDs for this pool
      const { data: entries, error: entriesError } = await supabase
        .from('bb_entries')
        .select('id')
        .eq('pool_id', poolId)

      if (entriesError) {
        console.error('Failed to get entries:', entriesError)
        return
      }

      if (entries && entries.length > 0) {
        const entryIds = entries.map(e => e.id)
        const { error: deleteError } = await supabase
          .from('bb_cfp_entry_picks')
          .delete()
          .in('entry_id', entryIds)

        if (deleteError) {
          console.error('Failed to clear CFP picks:', deleteError)
          return
        }
      }
    }

    setIsLoading(true)

    const { error } = await supabase
      .from('bb_cfp_pool_byes')
      .update({ team_id: teamId || null })
      .eq('id', bye.id)

    if (error) {
      console.error('Error updating bye team:', error)
    }

    setIsLoading(false)
    router.refresh()
  }

  if (byeTeams.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500 text-sm">Setting up bye team slots...</p>
      </div>
    )
  }

  const getByeForSeed = (seed: number) => byeTeams.find(b => b.seed === seed)

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${isLoading ? 'opacity-50' : ''}`}>
      {[1, 2, 3, 4].map(seed => {
        const bye = getByeForSeed(seed)
        return (
          <TeamAutocomplete
            key={seed}
            teams={teams}
            selectedTeamId={bye?.team_id ?? ''}
            onSelect={(teamId) => handleTeamChange(seed, teamId)}
            label={`#${seed} Seed`}
            id={`bye-seed-${seed}`}
            placeholder="Select team..."
          />
        )
      })}
    </div>
  )
}
