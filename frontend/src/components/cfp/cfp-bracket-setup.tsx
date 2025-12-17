'use client'

import { useState } from 'react'
import { CfpRound1Form } from './cfp-round1-form'
import { CfpByeTeamsInline } from './cfp-bye-teams-inline'
import { CfpLaterRoundForm } from './cfp-later-round-form'

interface Team {
  id: string
  name: string
  abbrev: string | null
  logo_url?: string | null
  color?: string | null
}

interface Game {
  id: string
  game_name: string | null
  kickoff_at: string | null
  home_spread: number | null
  status: string
}

interface Round1Matchup {
  id: string
  slot_key: string
  team_a_id: string | null
  team_b_id: string | null
  game_id: string | null
  team_a: Team | null
  team_b: Team | null
  game: Game | null
}

interface ByeTeam {
  id: string
  seed: number
  team_id: string | null
  team: Team | null
}

interface SlotGame {
  id: string
  slot_key: string
  game_id: string | null
  game: {
    id: string
    game_name: string | null
    kickoff_at: string | null
    status: string
  } | null
}

interface TemplateSlot {
  id: string
  slot_key: string
  round: string
  display_order: number | null
  depends_on_slot_a: string | null
  depends_on_slot_b: string | null
}

interface CfpConfig {
  pool_id: string
  template_id: string
  cfp_lock_at: string
  bb_cfp_templates: {
    id: string
    name: string
    description: string | null
  }
}

interface CfpBracketSetupProps {
  poolId: string
  cfpConfig: CfpConfig
  round1Matchups: Round1Matchup[]
  byeTeams: ByeTeam[]
  slotGames: SlotGame[]
  templateSlots: TemplateSlot[]
  teams: Team[]
}

const ROUND1_LABELS: Record<string, { name: string; seeds: string }> = {
  'R1A': { name: 'First Round Game 1', seeds: '#8 vs #9' },
  'R1B': { name: 'First Round Game 2', seeds: '#7 vs #10' },
  'R1C': { name: 'First Round Game 3', seeds: '#6 vs #11' },
  'R1D': { name: 'First Round Game 4', seeds: '#5 vs #12' },
}

const QF_LABELS: Record<string, { name: string; matchup: string; bracketNote: string }> = {
  'QFA': { name: 'Quarterfinal A', matchup: '#1 seed vs R1A winner', bracketNote: '#8/#9 R1A winner @ #1 bye team' },
  'QFB': { name: 'Quarterfinal B', matchup: '#2 seed vs R1B winner', bracketNote: '#7/#10 R1B winner @ #2 bye team' },
  'QFC': { name: 'Quarterfinal C', matchup: '#3 seed vs R1C winner', bracketNote: '#6/#11 R1C winner @ #3 bye team' },
  'QFD': { name: 'Quarterfinal D', matchup: '#4 seed vs R1D winner', bracketNote: '#5/#12 R1D winner @ #4 bye team' },
}

const SF_LABELS: Record<string, { name: string; matchup: string; bracketNote: string }> = {
  'SFA': { name: 'Semifinal A', matchup: 'QFA winner vs QFD winner', bracketNote: 'QFA winner vs QFD winner' },
  'SFB': { name: 'Semifinal B', matchup: 'QFB winner vs QFC winner', bracketNote: 'QFB winner vs QFC winner' },
}

const F_LABELS: Record<string, { name: string; matchup: string; bracketNote: string }> = {
  'F': { name: 'National Championship', matchup: 'SFA winner vs SFB winner', bracketNote: 'SFA winner vs SFB winner' },
}

// Format matchup display like "Away Team @ Home Team" with spread next to favored team
function formatMatchupWithSpread(
  awayTeam: string,
  homeTeam: string,
  homeSpread: number | null
): string {
  if (homeSpread === null) {
    return `${awayTeam} @ ${homeTeam}`
  }

  // Spread is shown next to the favored team (negative spread = favored)
  if (homeSpread < 0) {
    // Home team is favored
    return `${awayTeam} @ ${homeTeam} (${homeSpread})`
  } else {
    // Away team is favored (invert the spread for display)
    const awaySpread = -homeSpread
    return `${awayTeam} (${awaySpread}) @ ${homeTeam}`
  }
}

export function CfpBracketSetup({
  poolId,
  cfpConfig,
  round1Matchups,
  byeTeams,
  slotGames,
  templateSlots,
  teams,
}: CfpBracketSetupProps) {
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null)

  const r1Slots = templateSlots.filter((s) => s.round === 'R1').sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const qfSlots = templateSlots.filter((s) => s.round === 'QF').sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const sfSlots = templateSlots.filter((s) => s.round === 'SF').sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  const fSlots = templateSlots.filter((s) => s.round === 'F')

  const getMatchupForSlot = (slotKey: string) => {
    return round1Matchups.find((m) => m.slot_key === slotKey)
  }

  const getSlotGameForSlot = (slotKey: string) => {
    return slotGames.find((sg) => sg.slot_key === slotKey)
  }

  const isR1SlotConfigured = (matchup: Round1Matchup | undefined) => {
    return matchup && matchup.team_a_id && matchup.team_b_id
  }

  const isByeConfigured = (bye: ByeTeam | undefined) => {
    return bye && bye.team_id
  }

  const isSlotGameConfigured = (slotGame: SlotGame | undefined) => {
    return slotGame && slotGame.game_id
  }

  const r1ConfiguredCount = round1Matchups.filter(m => m.team_a_id && m.team_b_id).length
  const byeConfiguredCount = byeTeams.filter(b => b.team_id).length
  const qfConfiguredCount = qfSlots.filter(s => isSlotGameConfigured(getSlotGameForSlot(s.slot_key))).length
  const sfConfiguredCount = sfSlots.filter(s => isSlotGameConfigured(getSlotGameForSlot(s.slot_key))).length
  const fConfiguredCount = fSlots.filter(s => isSlotGameConfigured(getSlotGameForSlot(s.slot_key))).length

  return (
    <div className="space-y-6">
      {/* CFP Config Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {cfpConfig.bb_cfp_templates.name}
            </h2>
            {cfpConfig.bb_cfp_templates.description && (
              <p className="text-sm text-gray-600 mt-1">
                {cfpConfig.bb_cfp_templates.description}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Picks Lock At</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(cfpConfig.cfp_lock_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Bye Teams (Seeds 1-4) */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bye Teams (Seeds 1-4)</h2>
              <p className="text-sm text-gray-600 mt-1">
                The top 4 seeds receive first-round byes and enter in the Quarterfinals.
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                byeConfiguredCount === 4
                  ? 'bg-green-100 text-green-800'
                  : byeConfiguredCount > 0
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {byeConfiguredCount}/4 Configured
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <CfpByeTeamsInline
            poolId={poolId}
            byeTeams={byeTeams}
            teams={teams}
          />
        </div>
      </div>

      {/* Round 1 Setup */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">First Round Matchups</h2>
              <p className="text-sm text-gray-600 mt-1">
                Set up the 4 first-round games. Seeds 5-12 play; seeds 1-4 get byes.
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                r1ConfiguredCount === 4
                  ? 'bg-green-100 text-green-800'
                  : r1ConfiguredCount > 0
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {r1ConfiguredCount}/4 Configured
              </span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {r1Slots.map((slot) => {
            const matchup = getMatchupForSlot(slot.slot_key)
            const configured = isR1SlotConfigured(matchup)
            const label = ROUND1_LABELS[slot.slot_key]
            const isExpanded = expandedSlot === slot.slot_key

            return (
              <div key={slot.id} className="px-6 py-4">
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setExpandedSlot(isExpanded ? null : slot.slot_key)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      configured
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {slot.slot_key}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{label?.name || slot.slot_key}</p>
                      {configured && matchup ? (
                        <p className="text-sm text-gray-600">
                          {formatMatchupWithSpread(
                            matchup.team_b?.name || 'TBD',
                            matchup.team_a?.name || 'TBD',
                            matchup.game?.home_spread ?? null
                          )}
                          {matchup.game?.kickoff_at && (
                            <span className="text-gray-400 ml-2">
                              ({new Date(matchup.game.kickoff_at).toLocaleDateString()})
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">{label?.seeds || 'Not configured'}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {configured ? (
                      <span className="text-green-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-yellow-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && matchup && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <CfpRound1Form
                      poolId={poolId}
                      matchup={matchup}
                      teams={teams}
                      slotLabel={label?.name || slot.slot_key}
                      onSave={() => setExpandedSlot(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Quarterfinals Setup */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Quarterfinals</h2>
              <p className="text-sm text-gray-600 mt-1">
                Set up game names and kickoff times for the 4 quarterfinal games.
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                qfConfiguredCount === qfSlots.length && qfSlots.length > 0
                  ? 'bg-green-100 text-green-800'
                  : qfConfiguredCount > 0
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {qfConfiguredCount}/{qfSlots.length} Configured
              </span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {qfSlots.map((slot) => {
            const slotGame = getSlotGameForSlot(slot.slot_key)
            const configured = isSlotGameConfigured(slotGame)
            const label = QF_LABELS[slot.slot_key]
            const isExpanded = expandedSlot === slot.slot_key

            return (
              <div key={slot.id} className="px-6 py-4">
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setExpandedSlot(isExpanded ? null : slot.slot_key)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      configured
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {slot.slot_key}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{label?.name || slot.slot_key}</p>
                      {configured && slotGame?.game ? (
                        <p className="text-sm text-gray-600">
                          {slotGame.game.game_name || 'Unnamed'}
                          {slotGame.game.kickoff_at && (
                            <span className="text-gray-400 ml-2">
                              ({new Date(slotGame.game.kickoff_at).toLocaleDateString()})
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">{label?.matchup || 'Not configured'}</p>
                      )}
                      <p className="text-xs text-blue-600 mt-1 italic">{label?.bracketNote}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {configured ? (
                      <span className="text-green-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-yellow-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <CfpLaterRoundForm
                      poolId={poolId}
                      slotGame={slotGame ?? null}
                      slotKey={slot.slot_key}
                      slotLabel={label?.name || slot.slot_key}
                      onSave={() => setExpandedSlot(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Semifinals Setup */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Semifinals</h2>
              <p className="text-sm text-gray-600 mt-1">
                Set up game names and kickoff times for the 2 semifinal games.
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                sfConfiguredCount === sfSlots.length && sfSlots.length > 0
                  ? 'bg-green-100 text-green-800'
                  : sfConfiguredCount > 0
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {sfConfiguredCount}/{sfSlots.length} Configured
              </span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {sfSlots.map((slot) => {
            const slotGame = getSlotGameForSlot(slot.slot_key)
            const configured = isSlotGameConfigured(slotGame)
            const label = SF_LABELS[slot.slot_key]
            const isExpanded = expandedSlot === slot.slot_key

            return (
              <div key={slot.id} className="px-6 py-4">
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setExpandedSlot(isExpanded ? null : slot.slot_key)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      configured
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {slot.slot_key}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{label?.name || slot.slot_key}</p>
                      {configured && slotGame?.game ? (
                        <p className="text-sm text-gray-600">
                          {slotGame.game.game_name || 'Unnamed'}
                          {slotGame.game.kickoff_at && (
                            <span className="text-gray-400 ml-2">
                              ({new Date(slotGame.game.kickoff_at).toLocaleDateString()})
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">{label?.matchup || 'Not configured'}</p>
                      )}
                      {label?.bracketNote && (
                        <p className="text-xs text-blue-600 mt-1 italic">{label.bracketNote}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {configured ? (
                      <span className="text-green-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-yellow-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <CfpLaterRoundForm
                      poolId={poolId}
                      slotGame={slotGame ?? null}
                      slotKey={slot.slot_key}
                      slotLabel={label?.name || slot.slot_key}
                      onSave={() => setExpandedSlot(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Championship Setup */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">National Championship</h2>
              <p className="text-sm text-gray-600 mt-1">
                Set up the Championship game name and kickoff time.
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                fConfiguredCount === fSlots.length && fSlots.length > 0
                  ? 'bg-green-100 text-green-800'
                  : fConfiguredCount > 0
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {fConfiguredCount}/{fSlots.length} Configured
              </span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {fSlots.map((slot) => {
            const slotGame = getSlotGameForSlot(slot.slot_key)
            const configured = isSlotGameConfigured(slotGame)
            const label = F_LABELS[slot.slot_key]
            const isExpanded = expandedSlot === slot.slot_key

            return (
              <div key={slot.id} className="px-6 py-4">
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setExpandedSlot(isExpanded ? null : slot.slot_key)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      configured
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      F
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{label?.name || slot.slot_key}</p>
                      {configured && slotGame?.game ? (
                        <p className="text-sm text-gray-600">
                          {slotGame.game.game_name || 'Unnamed'}
                          {slotGame.game.kickoff_at && (
                            <span className="text-gray-400 ml-2">
                              ({new Date(slotGame.game.kickoff_at).toLocaleDateString()})
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400">{label?.matchup || 'Not configured'}</p>
                      )}
                      {label?.bracketNote && (
                        <p className="text-xs text-blue-600 mt-1 italic">{label.bracketNote}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {configured ? (
                      <span className="text-green-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-yellow-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <CfpLaterRoundForm
                      poolId={poolId}
                      slotGame={slotGame ?? null}
                      slotKey={slot.slot_key}
                      slotLabel={label?.name || slot.slot_key}
                      onSave={() => setExpandedSlot(null)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
