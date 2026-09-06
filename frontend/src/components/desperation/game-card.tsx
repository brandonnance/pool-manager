'use client'

import { Lock, Check, X, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NdGame, Selection } from '@/lib/desperation/types'
import { fmtKickoff, fmtPeriod } from './format'

interface Props {
  game: NdGame
  selection: Selection | undefined
  editable: boolean
  saving?: boolean
  onSelect: (sel: Selection | null) => void
}

function TeamButton({
  side, game, selected, editable, outcome, onClick,
}: {
  side: Selection
  game: NdGame
  selected: boolean
  editable: boolean
  outcome: 'won' | 'lost' | 'tie' | null
  onClick: () => void
}) {
  const abbr = side === 'home' ? game.home_abbr : game.away_abbr
  const name = side === 'home' ? game.home_team : game.away_team
  const logo = side === 'home' ? game.home_logo : game.away_logo
  const score = side === 'home' ? game.home_score : game.away_score
  const showScore = game.status !== 'scheduled' && game.status !== 'postponed' && score !== null

  return (
    <button
      type="button"
      disabled={!editable}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex flex-1 items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-left transition-all min-w-0',
        selected
          ? outcome === 'lost'
            ? 'border-red-500 bg-red-50'
            : outcome === 'won'
              ? 'border-emerald-600 bg-emerald-50'
              : 'border-primary bg-primary/10'
          : 'border-border bg-card',
        editable && 'hover:border-muted-foreground active:scale-[0.99]',
        !editable && !selected && 'opacity-60'
      )}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-7 shrink-0" />
      ) : (
        <div className="size-7 shrink-0 rounded-full bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-bold leading-tight">{abbr}</span>
          <span className="truncate text-xs text-muted-foreground">{name}</span>
        </div>
      </div>
      {showScore && (
        <span className={cn('text-lg font-bold tabular-nums', outcome === 'won' && 'text-emerald-700')}>
          {score}
        </span>
      )}
      {selected && outcome === 'won' && <Check className="size-4 text-emerald-700 shrink-0" />}
      {selected && outcome === 'lost' && <X className="size-4 text-red-600 shrink-0" />}
    </button>
  )
}

export function GameCard({ game, selection, editable, saving, onSelect }: Props) {
  const isFinal = game.status === 'final'
  const isLive = game.status === 'in_progress'
  const outcomeFor = (side: Selection): 'won' | 'lost' | 'tie' | null => {
    if (!isFinal || !game.winner) return null
    if (game.winner === 'tie') return 'tie'
    return game.winner === side ? 'won' : 'lost'
  }

  const statusLine = isFinal
    ? game.winner === 'tie' ? 'FINAL — TIE (voided)' : 'FINAL'
    : isLive
      ? fmtPeriod(game.period, game.clock) || 'LIVE'
      : game.status === 'postponed'
        ? 'POSTPONED'
        : game.status === 'canceled'
          ? 'CANCELED'
          : fmtKickoff(game.kickoff_at)

  return (
    <div className={cn('rounded-xl border bg-card p-3 shadow-sm', saving && 'opacity-70')}>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className={cn('font-medium', isLive ? 'text-red-600' : 'text-muted-foreground')}>
          {isLive && <span className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-red-600 align-middle" />}
          {statusLine}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {game.odds_details && (
            <span className="tabular-nums" title="Line for reference only — does not affect scoring">
              {game.odds_details}
              {game.over_under != null && <span className="text-muted-foreground/70"> · O/U {game.over_under}</span>}
            </span>
          )}
          {game.neutral_site && <span className="rounded bg-muted px-1.5 py-0.5">Neutral</span>}
          {!editable && game.status === 'scheduled' && <Lock className="size-3" />}
        </span>
      </div>
      <div className="flex items-stretch gap-2">
        <TeamButton
          side="away"
          game={game}
          selected={selection === 'away'}
          editable={editable}
          outcome={selection === 'away' ? outcomeFor('away') : null}
          onClick={() => onSelect(selection === 'away' ? null : 'away')}
        />
        <div className="flex items-center text-xs text-muted-foreground">@</div>
        <TeamButton
          side="home"
          game={game}
          selected={selection === 'home'}
          editable={editable}
          outcome={selection === 'home' ? outcomeFor('home') : null}
          onClick={() => onSelect(selection === 'home' ? null : 'home')}
        />
      </div>
      {!selection && !editable && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Minus className="size-3" /> Skipped
        </div>
      )}
    </div>
  )
}
