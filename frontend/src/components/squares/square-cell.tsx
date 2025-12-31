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
} as const

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
