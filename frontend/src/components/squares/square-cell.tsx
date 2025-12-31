'use client'

import { cn } from '@/lib/utils'

// Round-based winning colors
const winningColors = {
  wild_card: {
    normal: 'bg-amber-100 border-amber-400',
    currentUser: 'bg-amber-300 border-amber-500',
    text: 'text-amber-700',
  },
  divisional: {
    normal: 'bg-emerald-100 border-emerald-400',
    currentUser: 'bg-emerald-300 border-emerald-500',
    text: 'text-emerald-700',
  },
  conference: {
    normal: 'bg-red-100 border-red-400',
    currentUser: 'bg-red-300 border-red-500',
    text: 'text-red-700',
  },
  super_bowl: {
    normal: 'bg-purple-100 border-purple-400',
    currentUser: 'bg-purple-300 border-purple-500',
    text: 'text-purple-700',
  },
  super_bowl_halftime: {
    normal: 'bg-violet-50 border-violet-300',
    currentUser: 'bg-violet-200 border-violet-400',
    text: 'text-violet-600',
  },
  single_game: {
    normal: 'bg-teal-100 border-teal-400',
    currentUser: 'bg-teal-300 border-teal-500',
    text: 'text-teal-700',
  },
  // Single game forward/reverse scoring colors
  score_change_forward: {
    normal: 'bg-emerald-100 border-emerald-400',
    currentUser: 'bg-emerald-300 border-emerald-500',
    text: 'text-emerald-700',
  },
  score_change_reverse: {
    normal: 'bg-rose-100 border-rose-400',
    currentUser: 'bg-rose-300 border-rose-500',
    text: 'text-rose-700',
  },
  // Both forward and reverse - uses gradient (handled specially in getStateClasses)
  score_change_both: {
    normal: 'border-purple-400',
    currentUser: 'border-purple-500',
    text: 'text-purple-700',
  },
  // Final score winners (purple)
  score_change_final: {
    normal: 'bg-purple-100 border-purple-400',
    currentUser: 'bg-purple-300 border-purple-500',
    text: 'text-purple-700',
  },
  score_change_final_reverse: {
    normal: 'bg-fuchsia-100 border-fuchsia-400',
    currentUser: 'bg-fuchsia-300 border-fuchsia-500',
    text: 'text-fuchsia-700',
  },
  // Both final forward and reverse - uses gradient
  score_change_final_both: {
    normal: 'border-violet-400',
    currentUser: 'border-violet-500',
    text: 'text-violet-700',
  },
} as const

// Gradient backgrounds for "both" winning state (diagonal split)
const bothGradient = {
  normal: 'bg-gradient-to-br from-emerald-100 from-50% to-rose-100 to-50%',
  currentUser: 'bg-gradient-to-br from-emerald-300 from-50% to-rose-300 to-50%',
}

// Gradient for final score "both" state (purple/fuchsia)
const finalBothGradient = {
  normal: 'bg-gradient-to-br from-purple-100 from-50% to-fuchsia-100 to-50%',
  currentUser: 'bg-gradient-to-br from-purple-300 from-50% to-fuchsia-300 to-50%',
}

export type WinningRound = keyof typeof winningColors | null

export interface SquareCellProps {
  rowIndex: number
  colIndex: number
  ownerId: string | null
  ownerInitials: string | null
  ownerName: string | null
  isCurrentUser: boolean
  winningRound: WinningRound
  canClaim: boolean
  canUnclaim: boolean
  isAdmin?: boolean
  isLoading?: boolean
  onClick?: () => void
  onUnclaim?: () => void
  onAdminClick?: () => void
  className?: string
}

function getInitials(name: string | null): string {
  if (!name) return ''
  const parts = name.trim().split(' ')
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function SquareCell({
  rowIndex,
  colIndex,
  ownerId,
  ownerInitials,
  ownerName,
  isCurrentUser,
  winningRound,
  canClaim,
  canUnclaim,
  isAdmin = false,
  isLoading = false,
  onClick,
  onUnclaim,
  onAdminClick,
  className,
}: SquareCellProps) {
  const isWinning = winningRound !== null

  // Build class list based on state
  const getStateClasses = () => {
    const base =
      'flex items-center justify-center text-xs font-medium transition-all border aspect-square min-w-[36px] min-h-[36px]'

    if (!ownerId) {
      // Available
      return cn(base, 'bg-muted/50 hover:bg-muted cursor-pointer border-border')
    }

    if (isWinning && winningRound) {
      // Winning square - use round-specific colors
      const colors = winningColors[winningRound]
      // Special handling for "both" state with diagonal gradient
      if (winningRound === 'score_change_both') {
        const gradient = isCurrentUser ? bothGradient.currentUser : bothGradient.normal
        const border = isCurrentUser ? colors.currentUser : colors.normal
        return cn(base, gradient, border)
      }
      // Special handling for final score "both" state with diagonal gradient
      if (winningRound === 'score_change_final_both') {
        const gradient = isCurrentUser ? finalBothGradient.currentUser : finalBothGradient.normal
        const border = isCurrentUser ? colors.currentUser : colors.normal
        return cn(base, gradient, border)
      }
      return cn(base, isCurrentUser ? colors.currentUser : colors.normal)
    }

    if (isCurrentUser) {
      // Current user's square - light blue
      return cn(base, 'bg-sky-100 border-sky-400 hover:bg-sky-200 cursor-pointer')
    }

    // Other owned square
    return cn(base, 'bg-card border-border')
  }

  const displayInitials = ownerInitials || getInitials(ownerName)
  const canClickToClaim = canClaim && !ownerId && !isLoading
  const canClickToUnclaim = canUnclaim && isCurrentUser && !isWinning && !isLoading
  // Admin can always click (when not loading and pool not locked for winners)
  const canAdminClick = isAdmin && !isLoading && !isWinning
  const isClickable = canClickToClaim || canClickToUnclaim || canAdminClick

  const handleClick = () => {
    if (canAdminClick && onAdminClick) {
      onAdminClick()
    } else if (canClickToClaim && onClick) {
      onClick()
    } else if (canClickToUnclaim && onUnclaim) {
      onUnclaim()
    }
  }

  const getTitle = () => {
    if (isLoading) return 'Loading...'
    if (canAdminClick) return ownerName ? `${ownerName} - Click to reassign` : 'Click to assign'
    if (canClickToUnclaim) return `${ownerName} - Click to unclaim`
    if (ownerName) return ownerName
    if (canClickToClaim) return 'Click to claim'
    return undefined
  }

  // Get text color based on state
  const getTextClasses = () => {
    if (isWinning && winningRound) {
      return cn('truncate px-0.5 font-semibold', winningColors[winningRound].text)
    }
    if (isCurrentUser) {
      return 'truncate px-0.5 text-sky-700 font-semibold'
    }
    return 'truncate px-0.5'
  }

  return (
    <button
      type="button"
      onClick={isClickable ? handleClick : undefined}
      disabled={!isClickable}
      title={getTitle()}
      className={cn(
        getStateClasses(),
        isLoading && 'animate-pulse cursor-wait',
        !isClickable && !ownerId && 'cursor-default',
        className
      )}
      data-row={rowIndex}
      data-col={colIndex}
    >
      {isLoading ? (
        <span className="size-2 rounded-full bg-muted-foreground/50" />
      ) : (
        displayInitials && <span className={getTextClasses()}>{displayInitials}</span>
      )}
    </button>
  )
}
