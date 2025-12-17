'use client'

import { useState } from 'react'
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

interface CfpByeTeamFormProps {
  poolId: string
  byeTeam: ByeTeam
  teams: Team[]
  onSave: () => void
}

export function CfpByeTeamForm({ poolId, byeTeam, teams, onSave }: CfpByeTeamFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState(byeTeam.team_id ?? '')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!selectedTeamId) {
      setError('Please select a team')
      setIsLoading(false)
      return
    }

    const supabase = createClient()

    // Check if team changed - if so, delete ALL CFP picks for the pool
    const teamChanged = selectedTeamId !== byeTeam.team_id

    if (teamChanged && byeTeam.team_id) {
      // Only prompt if there was an existing team (meaning picks might exist)
      const confirmed = confirm(
        'Changing a bye team will delete ALL CFP bracket picks for ALL users in this pool. ' +
        'Users will need to redo their entire bracket. Are you sure you want to continue?'
      )
      if (!confirmed) {
        setIsLoading(false)
        return
      }

      // Get all entry IDs for this pool
      const { data: entries, error: entriesError } = await supabase
        .from('bb_entries')
        .select('id')
        .eq('pool_id', poolId)

      if (entriesError) {
        setError(`Failed to get entries: ${entriesError.message}`)
        setIsLoading(false)
        return
      }

      if (entries && entries.length > 0) {
        const entryIds = entries.map(e => e.id)
        const { error: deleteError } = await supabase
          .from('bb_cfp_entry_picks')
          .delete()
          .in('entry_id', entryIds)

        if (deleteError) {
          setError(`Failed to clear CFP picks: ${deleteError.message}`)
          setIsLoading(false)
          return
        }
      }
    }

    const { error: updateError } = await supabase
      .from('bb_cfp_pool_byes')
      .update({ team_id: selectedTeamId })
      .eq('id', byeTeam.id)

    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    router.refresh()
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TeamAutocomplete
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelect={setSelectedTeamId}
        label={`Seed #${byeTeam.seed} Team`}
        id={`bye-seed-${byeTeam.seed}`}
        placeholder="Search for team..."
      />

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
