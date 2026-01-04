'use client'

import { cn } from '@/lib/utils'
import type { WinningRound } from './square-cell'

// Reuse winning colors from existing square-cell
const winningColors = {
  wild_card: {
    normal: 'bg-amber-100 border-amber-400',
    text: 'text-amber-700',
  },
  divisional: {
    normal: 'bg-emerald-100 border-emerald-400',
    text: 'text-emerald-700',
  },
  conference: {
    normal: 'bg-red-100 border-red-400',
    text: 'text-red-700',
  },
  super_bowl: {
    normal: 'bg-purple-100 border-purple-400',
    text: 'text-purple-700',
  },
  super_bowl_halftime: {
    normal: 'bg-violet-50 border-violet-300',
    text: 'text-violet-600',
  },
  single_game: {
    normal: 'bg-teal-100 border-teal-400',
    text: 'text-teal-700',
  },
  score_change_forward: {
    normal: 'bg-emerald-100 border-emerald-400',
    text: 'text-emerald-700',
  },
  score_change_reverse: {
    normal: 'bg-rose-100 border-rose-400',
    text: 'text-rose-700',
  },
  score_change_both: {
    normal: 'border-purple-400',
    text: 'text-purple-700',
  },
  score_change_final: {
    normal: 'bg-purple-100 border-purple-400',
    text: 'text-purple-700',
  },
  score_change_final_reverse: {
    normal: 'bg-fuchsia-100 border-fuchsia-400',
    text: 'text-fuchsia-700',
  },
  score_change_final_both: {
    normal: 'border-violet-400',
    text: 'text-violet-700',
  },
} as const

// Gradient backgrounds for "both" winning states
const bothGradient = 'bg-gradient-to-br from-emerald-100 from-50% to-rose-100 to-50%'
const finalBothGradient = 'bg-gradient-to-br from-purple-100 from-50% to-fuchsia-100 to-50%'

export interface NoAccountSquareCellProps {
  rowIndex: number
  colIndex: number
  participantName: string | null
  verified: boolean
  isCommissioner: boolean
  winningRound: WinningRound
  isLiveWinning?: boolean // Pulsing animation for in-progress game
  isHighlighted?: boolean // Highlight squares for selected participant (public view)
  isLoading?: boolean
  onClick?: () => void
  className?: string
}

export function NoAccountSquareCell({
  rowIndex,
  colIndex,
  participantName,
  verified,
  isCommissioner,
  winningRound,
  isLiveWinning = false,
  isHighlighted = false,
  isLoading = false,
  onClick,
  className,
}: NoAccountSquareCellProps) {
  const isWinning = winningRound !== null
  const isAssigned = participantName !== null
  const gridNumber = `${rowIndex}${colIndex}`

  // Build class list based on state
  const getStateClasses = () => {
    const base =
      'flex items-center justify-center text-[8px] sm:text-[10px] font-medium transition-all border aspect-square relative overflow-hidden'

    if (isWinning && winningRound) {
      const colors = winningColors[winningRound]
      // Special handling for "both" states with diagonal gradient
      if (winningRound === 'score_change_both') {
        return cn(base, bothGradient, colors.normal)
      }
      if (winningRound === 'score_change_final_both') {
        return cn(base, finalBothGradient, colors.normal)
      }
      return cn(base, colors.normal)
    }

    if (!isAssigned) {
      // Available square - light background with visible grid number
      return cn(base, 'bg-gray-50 border-gray-300')
    }

    // Assigned square
    if (isCommissioner) {
      // Commissioner sees verified status
      if (verified) {
        return cn(base, 'bg-green-50 border-green-300')
      } else {
        // Unverified - white with red diagonal stripe
        return cn(base, 'bg-white border-red-300')
      }
    }

    // Public view - show as assigned, with optional highlight
    if (isHighlighted) {
      return cn(base, 'bg-sky-100 border-sky-400')
    }
    return cn(base, 'bg-white border-gray-300')
  }

  // Get text classes based on state
  const getTextClasses = () => {
    if (isWinning && winningRound) {
      return cn('truncate font-semibold', winningColors[winningRound].text)
    }
    if (!isAssigned) {
      // Grid numbers like "00" - larger and darker for visibility
      return 'text-gray-500 text-[10px] sm:text-xs font-semibold'
    }
    // Names need truncation but no padding to maximize space
    if (isCommissioner && !verified) {
      return 'truncate text-red-600'
    }
    if (isCommissioner && verified) {
      return 'truncate text-green-700'
    }
    // Highlighted squares in public view
    if (isHighlighted) {
      return 'truncate text-sky-700 font-semibold'
    }
    return 'truncate text-gray-700'
  }

  const displayText = isAssigned ? participantName : gridNumber
  // Commissioner can always click, public view can click assigned squares for tooltip
  const isClickable = !isLoading && (isCommissioner || isAssigned)
  const title = isAssigned
    ? isCommissioner
      ? `${participantName} - ${verified ? 'Verified' : 'Not Verified'} - Click to edit`
      : participantName
    : isCommissioner
      ? `Square ${gridNumber} - Click to assign`
      : `Square ${gridNumber} - Available`

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      title={title}
      className={cn(
        getStateClasses(),
        isClickable && 'cursor-pointer hover:opacity-80',
        !isClickable && 'cursor-default',
        isLoading && 'animate-pulse cursor-wait',
        isLiveWinning && 'animate-live-winner',
        className
      )}
      data-row={rowIndex}
      data-col={colIndex}
    >
      {/* Red diagonal stripe for unverified commissioner view */}
      {isCommissioner && isAssigned && !verified && !isWinning && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, transparent 45%, rgb(239 68 68 / 0.3) 45%, rgb(239 68 68 / 0.3) 55%, transparent 55%)',
          }}
        />
      )}

      {isLoading ? (
        <span className="size-2 rounded-full bg-muted-foreground/50" />
      ) : (
        <span className={cn(getTextClasses(), 'relative z-10')}>{displayText}</span>
      )}
    </button>
  )
}
