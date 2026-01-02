'use client'

import { Fragment, useState } from 'react'
import { NoAccountSquareCell } from './no-account-square-cell'
import { cn } from '@/lib/utils'
import type { WinningRound } from './square-cell'

export type LegendMode = 'full_playoff' | 'single_game' | 'score_change'

export interface NoAccountSquare {
  id: string | null
  row_index: number
  col_index: number
  participant_name: string | null
  verified: boolean
}

export interface NoAccountSquaresGridProps {
  sqPoolId: string
  squares: NoAccountSquare[]
  rowNumbers: number[] | null
  colNumbers: number[] | null
  numbersLocked: boolean
  isCommissioner: boolean
  winningSquareRounds?: Map<string, WinningRound>
  homeTeamLabel?: string
  awayTeamLabel?: string
  legendMode?: LegendMode
  onSquareClick?: (rowIndex: number, colIndex: number, square: NoAccountSquare | null) => void
  className?: string
}

export function NoAccountSquaresGrid({
  sqPoolId,
  squares,
  rowNumbers,
  colNumbers,
  numbersLocked,
  isCommissioner,
  winningSquareRounds = new Map(),
  homeTeamLabel = 'Home',
  awayTeamLabel = 'Away',
  legendMode = 'full_playoff',
  onSquareClick,
  className,
}: NoAccountSquaresGridProps) {
  const [loadingCell, setLoadingCell] = useState<string | null>(null)

  // Create a map for quick lookup
  const squareMap = new Map<string, NoAccountSquare>()
  squares.forEach((sq) => {
    squareMap.set(`${sq.row_index}-${sq.col_index}`, sq)
  })

  const handleSquareClick = (rowIndex: number, colIndex: number) => {
    if (!onSquareClick) return
    const cellKey = `${rowIndex}-${colIndex}`
    const square = squareMap.get(cellKey) ?? null
    onSquareClick(rowIndex, colIndex, square)
  }

  // Calculate statistics
  const totalSquares = 100
  const claimedSquares = squares.filter((s) => s.participant_name).length
  const verifiedSquares = squares.filter((s) => s.verified).length
  const availableSquares = totalSquares - claimedSquares

  return (
    <div className={cn('space-y-4', className)}>
      {/* Statistics row */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          <strong className="text-foreground">{claimedSquares}</strong> claimed
        </span>
        <span>
          <strong className="text-foreground">{availableSquares}</strong> available
        </span>
        {isCommissioner && (
          <span>
            <strong className="text-green-600">{verifiedSquares}</strong> verified
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        {/* Away team axis label */}
        <div className="flex items-center justify-center mb-2 ml-10">
          <div className="flex items-center gap-2 px-4 py-1 bg-primary/10 rounded-full">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              {awayTeamLabel}
            </span>
            <span className="text-primary">→</span>
          </div>
        </div>

        <div className="flex">
          {/* Home team axis label */}
          <div className="flex items-center justify-center mr-2 w-8">
            <div className="flex flex-col items-center gap-1 px-1 py-3 bg-primary/10 rounded-full">
              <span
                className="text-xs font-semibold uppercase tracking-wide text-primary"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                {homeTeamLabel}
              </span>
              <span className="text-primary">↓</span>
            </div>
          </div>

          {/* Grid */}
          <div
            className="grid gap-px bg-border p-px rounded-lg min-w-fit flex-1"
            style={{
              gridTemplateColumns: `minmax(36px, 40px) repeat(10, minmax(36px, 1fr))`,
              gridTemplateRows: `minmax(36px, 40px) repeat(10, minmax(36px, 1fr))`,
            }}
          >
            {/* Top-left corner cell - empty */}
            <div className="bg-muted/50 rounded-tl-lg" />

            {/* Column headers (Away team score - 0-9) */}
            {Array.from({ length: 10 }, (_, colIdx) => (
              <div
                key={`col-header-${colIdx}`}
                className={cn(
                  'bg-muted flex items-center justify-center font-bold text-sm',
                  colIdx === 9 && 'rounded-tr-lg'
                )}
              >
                {numbersLocked && colNumbers ? colNumbers[colIdx] : '?'}
              </div>
            ))}

            {/* Rows */}
            {Array.from({ length: 10 }, (_, rowIdx) => (
              <Fragment key={`row-${rowIdx}`}>
                {/* Row header (Home team score - 0-9) */}
                <div
                  key={`row-header-${rowIdx}`}
                  className={cn(
                    'bg-muted flex items-center justify-center font-bold text-sm',
                    rowIdx === 9 && 'rounded-bl-lg'
                  )}
                >
                  {numbersLocked && rowNumbers ? rowNumbers[rowIdx] : '?'}
                </div>

                {/* Square cells for this row */}
                {Array.from({ length: 10 }, (_, colIdx) => {
                  const cellKey = `${rowIdx}-${colIdx}`
                  const square = squareMap.get(cellKey)
                  const isLoading = loadingCell === cellKey

                  return (
                    <NoAccountSquareCell
                      key={cellKey}
                      rowIndex={rowIdx}
                      colIndex={colIdx}
                      participantName={square?.participant_name ?? null}
                      verified={square?.verified ?? false}
                      isCommissioner={isCommissioner}
                      winningRound={square?.id ? winningSquareRounds.get(square.id) ?? null : null}
                      isLoading={isLoading}
                      onClick={() => handleSquareClick(rowIdx, colIdx)}
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-4 rounded border border-gray-300 bg-gray-100 flex items-center justify-center text-[8px] text-gray-400">
            00
          </div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-4 rounded border border-gray-300 bg-white" />
          <span>Claimed</span>
        </div>
        {isCommissioner && (
          <>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-green-300 bg-green-50" />
              <span>Verified</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="size-4 rounded border border-red-300 bg-white"
                style={{
                  background:
                    'linear-gradient(135deg, white 45%, rgb(239 68 68 / 0.3) 45%, rgb(239 68 68 / 0.3) 55%, white 55%)',
                }}
              />
              <span>Not Verified</span>
            </div>
          </>
        )}
        {/* Winner colors based on legend mode */}
        {legendMode === 'full_playoff' ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-amber-400 bg-amber-100" />
              <span>Wild Card</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-emerald-400 bg-emerald-100" />
              <span>Divisional</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-red-400 bg-red-100" />
              <span>Conference</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-violet-300 bg-violet-50" />
              <span>SB Halftime</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-purple-400 bg-purple-100" />
              <span>Super Bowl</span>
            </div>
          </>
        ) : legendMode === 'score_change' ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-emerald-400 bg-emerald-100" />
              <span>Forward</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-rose-400 bg-rose-100" />
              <span>Reverse</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-purple-400 bg-gradient-to-br from-emerald-100 from-50% to-rose-100 to-50%" />
              <span>Both</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-purple-400 bg-purple-100" />
              <span>Final</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-fuchsia-400 bg-fuchsia-100" />
              <span>Final Rev</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-4 rounded border border-violet-400 bg-gradient-to-br from-purple-100 from-50% to-fuchsia-100 to-50%" />
              <span>Final Both</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="size-4 rounded border border-teal-400 bg-teal-100" />
            <span>Winner</span>
          </div>
        )}
      </div>
    </div>
  )
}
