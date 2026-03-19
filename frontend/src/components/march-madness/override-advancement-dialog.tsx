'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { MmGame, MmPoolTeam, MmEntry } from './game-card'

interface OverrideAdvancementDialogProps {
  game: MmGame
  poolId: string
  poolTeams: MmPoolTeam[]
  entries: MmEntry[]
  trigger?: React.ReactNode
}

export function OverrideAdvancementDialog({
  game,
  poolId,
  poolTeams,
  entries,
  trigger,
}: OverrideAdvancementDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(game.advancing_entry_id)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ message: string; cascade: Array<{ round: string; action: string }> } | null>(null)
  const router = useRouter()

  const higherSeedTeam = poolTeams.find(t => t.id === game.higher_seed_team_id)
  const lowerSeedTeam = poolTeams.find(t => t.id === game.lower_seed_team_id)
  const higherSeedEntry = entries.find(e => e.id === game.higher_seed_entry_id)
  const lowerSeedEntry = entries.find(e => e.id === game.lower_seed_entry_id)
  const currentAdvancing = entries.find(e => e.id === game.advancing_entry_id)

  // Determine who won the actual game
  const gameWinner = game.higher_seed_score !== null && game.lower_seed_score !== null
    ? game.higher_seed_score > game.lower_seed_score ? 'higher' : 'lower'
    : null

  const winningTeam = gameWinner === 'higher' ? higherSeedTeam : lowerSeedTeam

  const handleSubmit = async () => {
    if (!selectedEntryId || selectedEntryId === game.advancing_entry_id) {
      setOpen(false)
      return
    }

    setError(null)
    setResult(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/madness/override-advancement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          newAdvancingEntryId: selectedEntryId,
          poolId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to override')
        setIsSubmitting(false)
        return
      }

      setResult(data)
      setTimeout(() => {
        setOpen(false)
        setResult(null)
        router.refresh()
      }, 2000)
    } catch {
      setError('Network error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isChanged = selectedEntryId !== game.advancing_entry_id

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v)
      if (v) {
        setSelectedEntryId(game.advancing_entry_id)
        setError(null)
        setResult(null)
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-xs">
            Override
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Override Advancement</DialogTitle>
          <DialogDescription>
            Select which entry should advance from this game.
            Changes will cascade through all downstream rounds.
          </DialogDescription>
        </DialogHeader>

        {/* Game Summary */}
        <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{game.round} {game.region && `- ${game.region}`}</span>
            <Badge variant="secondary">Final</Badge>
          </div>
          <div className="text-sm text-center">
            <span className="font-semibold">
              #{higherSeedTeam?.seed} {higherSeedTeam?.bb_teams?.name || 'TBD'}
            </span>
            <span className="mx-2 text-muted-foreground">
              {game.higher_seed_score} - {game.lower_seed_score}
            </span>
            <span className="font-semibold">
              #{lowerSeedTeam?.seed} {lowerSeedTeam?.bb_teams?.name || 'TBD'}
            </span>
          </div>
          {game.spread !== null && (
            <div className="text-xs text-center text-muted-foreground">
              Spread: {game.spread > 0 ? '+' : ''}{game.spread}
              {' | '}Game winner: {winningTeam?.bb_teams?.name}
              {' | '}Currently advancing: {currentAdvancing?.display_name}
            </div>
          )}
        </div>

        {/* Entry Selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Who should advance?</p>

          {/* Higher seed entry */}
          <button
            type="button"
            onClick={() => setSelectedEntryId(game.higher_seed_entry_id)}
            className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
              selectedEntryId === game.higher_seed_entry_id
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-muted hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm">
                  {higherSeedEntry?.display_name || 'Unassigned'}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  (#{higherSeedTeam?.seed} {higherSeedTeam?.bb_teams?.name})
                </span>
              </div>
              {selectedEntryId === game.higher_seed_entry_id && (
                <Badge className="bg-emerald-600">Advances</Badge>
              )}
              {game.advancing_entry_id === game.higher_seed_entry_id && selectedEntryId !== game.higher_seed_entry_id && (
                <Badge variant="outline" className="text-muted-foreground">Current</Badge>
              )}
            </div>
          </button>

          {/* Lower seed entry */}
          <button
            type="button"
            onClick={() => setSelectedEntryId(game.lower_seed_entry_id)}
            className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
              selectedEntryId === game.lower_seed_entry_id
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-muted hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm">
                  {lowerSeedEntry?.display_name || 'Unassigned'}
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  (#{lowerSeedTeam?.seed} {lowerSeedTeam?.bb_teams?.name})
                </span>
              </div>
              {selectedEntryId === game.lower_seed_entry_id && (
                <Badge className="bg-emerald-600">Advances</Badge>
              )}
              {game.advancing_entry_id === game.lower_seed_entry_id && selectedEntryId !== game.lower_seed_entry_id && (
                <Badge variant="outline" className="text-muted-foreground">Current</Badge>
              )}
            </div>
          </button>
        </div>

        {/* Warning if changing */}
        {isChanged && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            This will change who advances and cascade through all downstream games.
            {currentAdvancing && (
              <span className="block mt-1 font-medium">
                {currentAdvancing.display_name} will be marked eliminated at {game.round}.
              </span>
            )}
          </div>
        )}

        {/* Result feedback */}
        {result && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            {result.message}
            {result.cascade.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {result.cascade.map((step, i) => (
                  <li key={i} className="text-xs">{step.round}: {step.action}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !isChanged}
            variant={isChanged ? 'default' : 'secondary'}
          >
            {isSubmitting ? 'Applying...' : isChanged ? 'Apply Override' : 'No Change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
