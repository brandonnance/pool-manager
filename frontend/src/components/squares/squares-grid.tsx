'use client'

import { Fragment, useState, useRef, useEffect } from 'react'
import { SquareCell } from './square-cell'
import { cn } from '@/lib/utils'
import type { WinningRound } from './square-cell'

export type LegendMode = 'full_playoff' | 'single_game' | 'score_change'

interface SelectedSquare {
  rowIndex: number
  colIndex: number
  participantName: string
}

// Square type for public-facing squares pool (uses participant_name)
export interface Square {
  id: string | null
  row_index: number
  col_index: number
  participant_name: string | null
  verified: boolean
  user_id?: string | null // Legacy field, unused in current model
}

export interface SquaresGridProps {
  sqPoolId: string
  squares: Square[]
  rowNumbers: number[] | null
  colNumbers: number[] | null
  numbersLocked: boolean
  isCommissioner: boolean
  winningSquareRounds?: Map<string, WinningRound>
  liveWinningSquareIds?: Set<string> // Square IDs currently winning from in-progress games
  homeTeamLabel?: string
  awayTeamLabel?: string
  legendMode?: LegendMode
  onSquareClick?: (rowIndex: number, colIndex: number, square: Square | null) => void
  // Controlled selection for external participant list integration
  controlledParticipantName?: string | null
  onParticipantSelect?: (name: string | null) => void
  className?: string
}

export function SquaresGrid({
  sqPoolId,
  squares,
  rowNumbers,
  colNumbers,
  numbersLocked,
  isCommissioner,
  winningSquareRounds = new Map(),
  liveWinningSquareIds = new Set(),
  homeTeamLabel = 'Home',
  awayTeamLabel = 'Away',
  legendMode = 'full_playoff',
  onSquareClick,
  controlledParticipantName,
  onParticipantSelect,
  className,
}: SquaresGridProps) {
  const [loadingCell, setLoadingCell] = useState<string | null>(null)
  const [internalSelectedSquare, setInternalSelectedSquare] = useState<SelectedSquare | null>(null)

  // Use controlled participant name if provided, otherwise use internal state
  const isControlled = controlledParticipantName !== undefined
  const selectedParticipantName = isControlled
    ? controlledParticipantName
    : internalSelectedSquare?.participantName ?? null
  const tooltipRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Create a map for quick lookup
  const squareMap = new Map<string, Square>()
  squares.forEach((sq) => {
    squareMap.set(`${sq.row_index}-${sq.col_index}`, sq)
  })

  // Helper to update selection (respects controlled/uncontrolled mode)
  const setSelectedParticipant = (name: string | null) => {
    if (isControlled) {
      onParticipantSelect?.(name)
    } else {
      if (name) {
        // Find a square with this participant to set as selected
        const sq = squares.find((s) => s.participant_name === name)
        if (sq) {
          setInternalSelectedSquare({
            rowIndex: sq.row_index,
            colIndex: sq.col_index,
            participantName: name,
          })
        }
      } else {
        setInternalSelectedSquare(null)
      }
    }
  }

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        selectedParticipantName &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        gridRef.current &&
        !gridRef.current.contains(e.target as Node)
      ) {
        setSelectedParticipant(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedParticipantName, isControlled])

  const handleSquareClick = (rowIndex: number, colIndex: number) => {
    // Commissioner mode - use the external handler
    if (isCommissioner && onSquareClick) {
      const cellKey = `${rowIndex}-${colIndex}`
      const square = squareMap.get(cellKey) ?? null
      onSquareClick(rowIndex, colIndex, square)
      return
    }

    // Public view - show tooltip for claimed squares
    const cellKey = `${rowIndex}-${colIndex}`
    const square = squareMap.get(cellKey)
    if (square?.participant_name) {
      // Toggle selection - if same participant clicked, close; otherwise open new
      if (selectedParticipantName === square.participant_name) {
        setSelectedParticipant(null)
      } else {
        setSelectedParticipant(square.participant_name)
      }
    } else {
      setSelectedParticipant(null)
    }
  }

  // Count squares for selected participant
  const selectedParticipantSquareCount = selectedParticipantName
    ? squares.filter((s) => s.participant_name === selectedParticipantName).length
    : 0

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

      {/* Tooltip for selected participant */}
      {selectedParticipantName && (
        <div
          ref={tooltipRef}
          className="mb-3 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between gap-4"
        >
          <div>
            <p className="font-semibold text-foreground">{selectedParticipantName}</p>
            <p className="text-sm text-muted-foreground">
              {selectedParticipantSquareCount} square{selectedParticipantSquareCount !== 1 ? 's' : ''} (highlighted in blue)
            </p>
          </div>
          <button
            onClick={() => setSelectedParticipant(null)}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div ref={gridRef} className="overflow-x-auto overflow-y-visible pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* Away team axis label */}
        <div className="flex items-center justify-center mb-1 sm:mb-2 ml-7 sm:ml-10">
          <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-0.5 sm:py-1 bg-primary/10 rounded-full">
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-primary">
              {awayTeamLabel}
            </span>
            <span className="text-primary text-xs sm:text-base">→</span>
          </div>
        </div>

        <div className="flex">
          {/* Home team axis label */}
          <div className="flex items-center justify-center mr-1 sm:mr-2 w-6 sm:w-8">
            <div className="flex flex-col items-center gap-0.5 sm:gap-1 px-0.5 sm:px-1 py-2 sm:py-3 bg-primary/10 rounded-full">
              <span
                className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-primary"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
              >
                {homeTeamLabel}
              </span>
              <span className="text-primary text-xs sm:text-base">↓</span>
            </div>
          </div>

          {/* Grid - CSS variable based sizing for mobile */}
          <div
            className="grid gap-px bg-border p-px rounded-lg flex-1"
            style={{
              gridTemplateColumns: `minmax(28px, 32px) repeat(10, minmax(28px, 1fr))`,
              gridTemplateRows: `minmax(28px, 32px) repeat(10, minmax(28px, 1fr))`,
            }}
          >
            {/* Top-left corner cell - empty */}
            <div className="bg-slate-100 rounded-tl-lg" />

            {/* Column headers (Away team score - 0-9) */}
            {Array.from({ length: 10 }, (_, colIdx) => (
              <div
                key={`col-header-${colIdx}`}
                className={cn(
                  'bg-slate-100 flex items-center justify-center font-bold text-base sm:text-lg text-slate-700',
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
                    'bg-slate-100 flex items-center justify-center font-bold text-base sm:text-lg text-slate-700',
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
                  // Highlight if this square belongs to selected participant
                  const isHighlighted = selectedParticipantName
                    ? square?.participant_name === selectedParticipantName
                    : false

                  return (
                    <SquareCell
                      key={cellKey}
                      rowIndex={rowIdx}
                      colIndex={colIdx}
                      participantName={square?.participant_name ?? null}
                      verified={square?.verified ?? false}
                      isCommissioner={isCommissioner}
                      winningRound={square?.id ? winningSquareRounds.get(square.id) ?? null : null}
                      isLiveWinning={square?.id ? liveWinningSquareIds.has(square.id) : false}
                      isHighlighted={isHighlighted}
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
      <div className="flex flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground mt-2">
        <div className="flex items-center gap-1">
          <div className="size-3 sm:size-4 rounded border border-gray-300 bg-gray-100 flex items-center justify-center text-[6px] sm:text-[8px] text-gray-400">
            00
          </div>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="size-3 sm:size-4 rounded border border-gray-300 bg-white" />
          <span>Claimed/Verified</span>
        </div>
        {isCommissioner && (
          <>
            <div className="flex items-center gap-1">
              <div
                className="size-3 sm:size-4 rounded border border-red-300 bg-white"
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
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-amber-400 bg-amber-100" />
              <span>Wild Card</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-emerald-400 bg-emerald-100" />
              <span>Divisional</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-red-400 bg-red-100" />
              <span>Conference</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-violet-300 bg-violet-50" />
              <span>SB Half</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-purple-400 bg-purple-100" />
              <span>Super Bowl</span>
            </div>
          </>
        ) : legendMode === 'score_change' ? (
          <>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-emerald-400 bg-emerald-100" />
              <span>Forward</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-rose-400 bg-rose-100" />
              <span>Reverse</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-purple-400 bg-gradient-to-br from-emerald-100 from-50% to-rose-100 to-50%" />
              <span>Both</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-purple-400 bg-purple-100" />
              <span>Final</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-fuchsia-400 bg-fuchsia-100" />
              <span>Final Rev</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="size-3 sm:size-4 rounded border border-violet-400 bg-gradient-to-br from-purple-100 from-50% to-fuchsia-100 to-50%" />
              <span>Final Both</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1">
            <div className="size-3 sm:size-4 rounded border border-teal-400 bg-teal-100" />
            <span>Winner</span>
          </div>
        )}
      </div>
    </div>
  )
}
