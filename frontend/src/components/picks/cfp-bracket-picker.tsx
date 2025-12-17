'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Team {
  id: string
  name: string
  abbrev: string | null
  logo_url?: string | null
  color?: string | null
}

interface ByeTeam {
  seed: number
  team_id: string | null
  team: Team | null
}

interface Round1Matchup {
  slot_key: string
  team_a_id: string | null
  team_b_id: string | null
  team_a: Team | null
  team_b: Team | null
}

interface CfpPick {
  slot_key: string
  picked_team_id: string | null
}

interface CfpBracketPickerProps {
  poolId: string
  entryId: string
  byeTeams: ByeTeam[]
  round1Matchups: Round1Matchup[]
  existingPicks: CfpPick[]
  isLocked: boolean
}

// Bracket flow mapping
const BRACKET_FLOW = {
  // R1 winners feed into QF
  R1A: { nextSlot: 'QFA', position: 'away' },
  R1B: { nextSlot: 'QFB', position: 'away' },
  R1C: { nextSlot: 'QFC', position: 'away' },
  R1D: { nextSlot: 'QFD', position: 'away' },
  // QF winners feed into SF
  QFA: { nextSlot: 'SFA', position: 'top' },
  QFD: { nextSlot: 'SFA', position: 'bottom' },
  QFB: { nextSlot: 'SFB', position: 'top' },
  QFC: { nextSlot: 'SFB', position: 'bottom' },
  // SF winners feed into Final
  SFA: { nextSlot: 'F', position: 'top' },
  SFB: { nextSlot: 'F', position: 'bottom' },
}

// Bye team seed mapping to QF slots
const BYE_TO_QF: Record<number, string> = {
  1: 'QFA',
  2: 'QFB',
  3: 'QFC',
  4: 'QFD',
}

export function CfpBracketPicker({
  poolId,
  entryId,
  byeTeams,
  round1Matchups,
  existingPicks,
  isLocked,
}: CfpBracketPickerProps) {
  const [picks, setPicks] = useState<Record<string, string | null>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Initialize picks from existing data
  useEffect(() => {
    const picksMap: Record<string, string | null> = {}
    existingPicks.forEach(pick => {
      picksMap[pick.slot_key] = pick.picked_team_id
    })
    setPicks(picksMap)
  }, [existingPicks])

  // Get team by ID from all available teams
  const getTeamById = (teamId: string | null): Team | null => {
    if (!teamId) return null

    // Check bye teams
    for (const bye of byeTeams) {
      if (bye.team?.id === teamId) return bye.team
    }

    // Check R1 teams
    for (const matchup of round1Matchups) {
      if (matchup.team_a?.id === teamId) return matchup.team_a
      if (matchup.team_b?.id === teamId) return matchup.team_b
    }

    return null
  }

  // Get the teams for a given slot based on picks
  const getSlotTeams = (slotKey: string): { teamA: Team | null; teamB: Team | null } => {
    if (slotKey.startsWith('R1')) {
      const matchup = round1Matchups.find(m => m.slot_key === slotKey)
      return { teamA: matchup?.team_a || null, teamB: matchup?.team_b || null }
    }

    if (slotKey.startsWith('QF')) {
      // QF: Away team is R1 winner, Home team is bye team
      const qfIndex = slotKey.charAt(2) // A, B, C, D
      const r1Slot = `R1${qfIndex}`
      const byeSeed = { A: 1, B: 2, C: 3, D: 4 }[qfIndex] || 1

      const r1Pick = picks[r1Slot]
      const r1Winner = r1Pick ? getTeamById(r1Pick) : null
      const byeTeam = byeTeams.find(b => b.seed === byeSeed)?.team || null

      return { teamA: r1Winner, teamB: byeTeam }
    }

    if (slotKey === 'SFA') {
      // SFA: QFA winner vs QFD winner
      const qfaPick = picks['QFA']
      const qfdPick = picks['QFD']
      return {
        teamA: qfaPick ? getTeamById(qfaPick) : null,
        teamB: qfdPick ? getTeamById(qfdPick) : null,
      }
    }

    if (slotKey === 'SFB') {
      // SFB: QFB winner vs QFC winner
      const qfbPick = picks['QFB']
      const qfcPick = picks['QFC']
      return {
        teamA: qfbPick ? getTeamById(qfbPick) : null,
        teamB: qfcPick ? getTeamById(qfcPick) : null,
      }
    }

    if (slotKey === 'F') {
      // Final: SFA winner vs SFB winner
      const sfaPick = picks['SFA']
      const sfbPick = picks['SFB']
      return {
        teamA: sfaPick ? getTeamById(sfaPick) : null,
        teamB: sfbPick ? getTeamById(sfbPick) : null,
      }
    }

    return { teamA: null, teamB: null }
  }

  // Clear downstream picks when a pick changes
  const clearDownstreamPicks = (slotKey: string, newPicks: Record<string, string | null>): string[] => {
    const clearedSlots: string[] = []
    const flow = BRACKET_FLOW[slotKey as keyof typeof BRACKET_FLOW]

    if (flow && newPicks[flow.nextSlot]) {
      // Check if the downstream pick depends on this slot's result
      const nextSlotTeams = getSlotTeamsWithPicks(flow.nextSlot, newPicks)
      const currentPick = newPicks[flow.nextSlot]

      // If the current pick for the next slot is no longer valid, clear it
      if (currentPick && nextSlotTeams.teamA?.id !== currentPick && nextSlotTeams.teamB?.id !== currentPick) {
        newPicks[flow.nextSlot] = null
        clearedSlots.push(flow.nextSlot)
        // Recursively clear further downstream
        clearedSlots.push(...clearDownstreamPicks(flow.nextSlot, newPicks))
      }
    }

    return clearedSlots
  }

  // Helper to get slot teams with a given picks state
  const getSlotTeamsWithPicks = (slotKey: string, picksState: Record<string, string | null>): { teamA: Team | null; teamB: Team | null } => {
    if (slotKey.startsWith('R1')) {
      const matchup = round1Matchups.find(m => m.slot_key === slotKey)
      return { teamA: matchup?.team_a || null, teamB: matchup?.team_b || null }
    }

    if (slotKey.startsWith('QF')) {
      const qfIndex = slotKey.charAt(2)
      const r1Slot = `R1${qfIndex}`
      const byeSeed = { A: 1, B: 2, C: 3, D: 4 }[qfIndex] || 1

      const r1Pick = picksState[r1Slot]
      const r1Winner = r1Pick ? getTeamById(r1Pick) : null
      const byeTeam = byeTeams.find(b => b.seed === byeSeed)?.team || null

      return { teamA: r1Winner, teamB: byeTeam }
    }

    if (slotKey === 'SFA') {
      return {
        teamA: picksState['QFA'] ? getTeamById(picksState['QFA']) : null,
        teamB: picksState['QFD'] ? getTeamById(picksState['QFD']) : null,
      }
    }

    if (slotKey === 'SFB') {
      return {
        teamA: picksState['QFB'] ? getTeamById(picksState['QFB']) : null,
        teamB: picksState['QFC'] ? getTeamById(picksState['QFC']) : null,
      }
    }

    if (slotKey === 'F') {
      return {
        teamA: picksState['SFA'] ? getTeamById(picksState['SFA']) : null,
        teamB: picksState['SFB'] ? getTeamById(picksState['SFB']) : null,
      }
    }

    return { teamA: null, teamB: null }
  }

  const handlePick = async (slotKey: string, teamId: string) => {
    if (isLocked) {
      setError('CFP picks are locked')
      return
    }

    setSaving(slotKey)
    setError(null)

    const supabase = createClient()

    // Create new picks state
    const newPicks = { ...picks, [slotKey]: teamId }

    // Clear any downstream picks that are now invalid
    const clearedSlots = clearDownstreamPicks(slotKey, newPicks)

    // Update main pick
    const { data: existingPick } = await supabase
      .from('bb_cfp_entry_picks')
      .select('id')
      .eq('entry_id', entryId)
      .eq('slot_key', slotKey)
      .single()

    if (existingPick) {
      const { error: updateError } = await supabase
        .from('bb_cfp_entry_picks')
        .update({ picked_team_id: teamId, updated_at: new Date().toISOString() })
        .eq('id', existingPick.id)

      if (updateError) {
        setError(updateError.message)
        setSaving(null)
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from('bb_cfp_entry_picks')
        .insert({
          entry_id: entryId,
          slot_key: slotKey,
          picked_team_id: teamId,
        })

      if (insertError) {
        setError(insertError.message)
        setSaving(null)
        return
      }
    }

    // Delete cleared downstream picks
    for (const clearedSlot of clearedSlots) {
      await supabase
        .from('bb_cfp_entry_picks')
        .delete()
        .eq('entry_id', entryId)
        .eq('slot_key', clearedSlot)
    }

    setPicks(newPicks)
    setSaving(null)
    router.refresh()
  }

  // Render a team button for the bracket
  const TeamButton = ({
    team,
    slotKey,
    isSelected,
    disabled,
    position
  }: {
    team: Team | null
    slotKey: string
    isSelected: boolean
    disabled: boolean
    position: 'top' | 'bottom'
  }) => {
    if (!team) {
      return (
        <div className={`p-2 border-2 border-dashed border-gray-300 rounded ${position === 'top' ? 'rounded-b-none' : 'rounded-t-none'} bg-gray-50 text-gray-400 text-center text-sm`}>
          TBD
        </div>
      )
    }

    return (
      <button
        onClick={() => handlePick(slotKey, team.id)}
        disabled={disabled || saving === slotKey}
        className={`w-full p-2 border-2 rounded text-sm font-medium transition-all ${
          position === 'top' ? 'rounded-b-none border-b' : 'rounded-t-none'
        } ${
          isSelected
            ? 'border-blue-500 bg-blue-50 text-blue-700'
            : 'border-gray-300 hover:border-gray-400 bg-white'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${
          saving === slotKey ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          {team.logo_url && (
            <img src={team.logo_url} alt="" className="w-5 h-5 object-contain" />
          )}
          <span className="truncate">{team.abbrev || team.name}</span>
          {isSelected && (
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </button>
    )
  }

  // Render a matchup box
  const MatchupBox = ({
    slotKey,
    label,
    sublabel
  }: {
    slotKey: string
    label: string
    sublabel?: string
  }) => {
    const { teamA, teamB } = getSlotTeams(slotKey)
    const currentPick = picks[slotKey]
    const canPick = !isLocked && teamA && teamB

    return (
      <div className="w-40">
        <div className="text-xs text-gray-500 mb-1 text-center font-medium">{label}</div>
        {sublabel && <div className="text-xs text-gray-400 mb-1 text-center">{sublabel}</div>}
        <div className="border border-gray-200 rounded shadow-sm">
          <TeamButton
            team={teamA}
            slotKey={slotKey}
            isSelected={currentPick === teamA?.id}
            disabled={!canPick}
            position="top"
          />
          <TeamButton
            team={teamB}
            slotKey={slotKey}
            isSelected={currentPick === teamB?.id}
            disabled={!canPick}
            position="bottom"
          />
        </div>
      </div>
    )
  }

  // Count completed picks
  const totalSlots = 11 // 4 R1 + 4 QF + 2 SF + 1 F
  const completedPicks = Object.values(picks).filter(p => p !== null).length

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">CFP Bracket</h2>
          <p className="text-sm text-gray-500">Pick winners through each round of the playoff</p>
        </div>
        <div className="text-sm">
          <span className={completedPicks === totalSlots ? 'text-green-600 font-medium' : 'text-gray-500'}>
            {completedPicks}/{totalSlots} picks
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isLocked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-yellow-700">CFP picks are locked</p>
        </div>
      )}

      {/* Bracket Layout */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px] p-4">
          {/* First Round */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">First Round</h3>
            <div className="flex justify-center gap-6">
              <MatchupBox slotKey="R1A" label="R1A" sublabel="#8 vs #9" />
              <MatchupBox slotKey="R1B" label="R1B" sublabel="#7 vs #10" />
              <MatchupBox slotKey="R1C" label="R1C" sublabel="#6 vs #11" />
              <MatchupBox slotKey="R1D" label="R1D" sublabel="#5 vs #12" />
            </div>
          </div>

          {/* Quarterfinals */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">Quarterfinals</h3>
            <div className="flex justify-center gap-6">
              <MatchupBox slotKey="QFA" label="QFA" sublabel="R1A winner @ #1" />
              <MatchupBox slotKey="QFB" label="QFB" sublabel="R1B winner @ #2" />
              <MatchupBox slotKey="QFC" label="QFC" sublabel="R1C winner @ #3" />
              <MatchupBox slotKey="QFD" label="QFD" sublabel="R1D winner @ #4" />
            </div>
          </div>

          {/* Semifinals */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">Semifinals</h3>
            <div className="flex justify-center gap-16">
              <MatchupBox slotKey="SFA" label="Semifinal A" sublabel="QFA vs QFD" />
              <MatchupBox slotKey="SFB" label="Semifinal B" sublabel="QFB vs QFC" />
            </div>
          </div>

          {/* Championship */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 text-center">National Championship</h3>
            <div className="flex justify-center">
              <MatchupBox slotKey="F" label="Championship" sublabel="SFA vs SFB" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
