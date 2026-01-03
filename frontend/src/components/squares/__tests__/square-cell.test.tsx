import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SquareCell, type WinningRound } from '../square-cell'

describe('SquareCell', () => {
  const defaultProps = {
    rowIndex: 0,
    colIndex: 0,
    ownerId: null,
    ownerInitials: null,
    ownerName: null,
    isCurrentUser: false,
    winningRound: null as WinningRound,
    canClaim: false,
    canUnclaim: false,
  }

  describe('rendering states', () => {
    it('renders an empty available square', () => {
      render(<SquareCell {...defaultProps} canClaim={true} />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('data-row', '0')
      expect(button).toHaveAttribute('data-col', '0')
    })

    it('renders owner initials when provided', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerInitials="JD"
          ownerName="John Doe"
        />
      )

      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('calculates initials from owner name when initials not provided', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerInitials={null}
          ownerName="John Doe"
        />
      )

      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('calculates single initial for single-name owner', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerInitials={null}
          ownerName="John"
        />
      )

      expect(screen.getByText('J')).toBeInTheDocument()
    })

    it('displays dash for abandoned squares', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerName="John Doe"
          isAbandoned={true}
        />
      )

      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('shows loading indicator when loading', () => {
      render(<SquareCell {...defaultProps} isLoading={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('animate-pulse')
      // Should not show initials when loading
      expect(screen.queryByText('JD')).not.toBeInTheDocument()
    })
  })

  describe('title attributes', () => {
    it('shows "Loading..." title when loading', () => {
      render(<SquareCell {...defaultProps} isLoading={true} />)

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Loading...')
    })

    it('shows "Click to claim" for available squares', () => {
      render(<SquareCell {...defaultProps} canClaim={true} />)

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Click to claim')
    })

    it('shows owner name for owned squares', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerName="John Doe"
        />
      )

      expect(screen.getByRole('button')).toHaveAttribute('title', 'John Doe')
    })

    it('shows unclaim message for current user squares', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerName="John Doe"
          isCurrentUser={true}
          canUnclaim={true}
        />
      )

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'John Doe - Click to unclaim'
      )
    })

    it('shows admin assign message for empty squares', () => {
      render(<SquareCell {...defaultProps} isAdmin={true} />)

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Click to assign')
    })

    it('shows admin reassign message for owned squares', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerName="John Doe"
          isAdmin={true}
        />
      )

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'John Doe - Click to reassign'
      )
    })

    it('shows abandoned message', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          isAbandoned={true}
        />
      )

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Abandoned')
    })

    it('shows abandoned reassign message for admin', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          isAbandoned={true}
          isAdmin={true}
        />
      )

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'Abandoned - Click to reassign'
      )
    })
  })

  describe('click handlers', () => {
    it('calls onClick when claiming available square', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<SquareCell {...defaultProps} canClaim={true} onClick={onClick} />)

      await user.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('calls onUnclaim when unclaiming own square', async () => {
      const user = userEvent.setup()
      const onUnclaim = vi.fn()

      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          isCurrentUser={true}
          canUnclaim={true}
          onUnclaim={onUnclaim}
        />
      )

      await user.click(screen.getByRole('button'))
      expect(onUnclaim).toHaveBeenCalledTimes(1)
    })

    it('calls onAdminClick when admin clicks square', async () => {
      const user = userEvent.setup()
      const onAdminClick = vi.fn()

      render(
        <SquareCell
          {...defaultProps}
          isAdmin={true}
          onAdminClick={onAdminClick}
        />
      )

      await user.click(screen.getByRole('button'))
      expect(onAdminClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when square is not claimable', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<SquareCell {...defaultProps} canClaim={false} onClick={onClick} />)

      await user.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('does not call handlers when loading', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(
        <SquareCell {...defaultProps} canClaim={true} onClick={onClick} isLoading={true} />
      )

      await user.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('prevents unclaim when square is winning', async () => {
      const user = userEvent.setup()
      const onUnclaim = vi.fn()

      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          isCurrentUser={true}
          canUnclaim={true}
          winningRound="wild_card"
          onUnclaim={onUnclaim}
        />
      )

      await user.click(screen.getByRole('button'))
      expect(onUnclaim).not.toHaveBeenCalled()
    })

    it('admin can click abandoned squares even if winning', async () => {
      const user = userEvent.setup()
      const onAdminClick = vi.fn()

      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          isAbandoned={true}
          isAdmin={true}
          winningRound="wild_card"
          onAdminClick={onAdminClick}
        />
      )

      await user.click(screen.getByRole('button'))
      expect(onAdminClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('disabled state', () => {
    it('is disabled when not claimable and not owned', () => {
      render(<SquareCell {...defaultProps} canClaim={false} />)

      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('is disabled when owned by other user and not admin', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="other-user"
          ownerName="Other User"
          isCurrentUser={false}
          canUnclaim={false}
        />
      )

      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('is enabled when admin', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="other-user"
          ownerName="Other User"
          isAdmin={true}
        />
      )

      expect(screen.getByRole('button')).not.toBeDisabled()
    })
  })

  describe('winning states', () => {
    const winningRounds: WinningRound[] = [
      'wild_card',
      'divisional',
      'conference',
      'super_bowl',
      'super_bowl_halftime',
      'single_game',
      'score_change_forward',
      'score_change_reverse',
      'score_change_both',
      'score_change_final',
      'score_change_final_reverse',
      'score_change_final_both',
    ]

    it.each(winningRounds)('renders winning square for %s round', (round) => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerInitials="JD"
          winningRound={round}
        />
      )

      // Should render without errors
      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('applies different styling for current user winning square', () => {
      const { rerender } = render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerInitials="JD"
          winningRound="wild_card"
          isCurrentUser={false}
        />
      )

      const buttonNotCurrentUser = screen.getByRole('button')
      const classesNotCurrentUser = buttonNotCurrentUser.className

      rerender(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerInitials="JD"
          winningRound="wild_card"
          isCurrentUser={true}
        />
      )

      const buttonCurrentUser = screen.getByRole('button')
      const classesCurrentUser = buttonCurrentUser.className

      // Classes should be different
      expect(classesNotCurrentUser).not.toBe(classesCurrentUser)
    })

    it('applies gradient for score_change_both', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerInitials="JD"
          winningRound="score_change_both"
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('gradient')
    })

    it('applies gradient for score_change_final_both', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerInitials="JD"
          winningRound="score_change_final_both"
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('gradient')
    })
  })

  describe('current user styling', () => {
    it('applies sky blue styling for current user non-winning square', () => {
      render(
        <SquareCell
          {...defaultProps}
          ownerId="user-1"
          ownerInitials="JD"
          isCurrentUser={true}
          winningRound={null}
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('sky')
    })
  })

  describe('data attributes', () => {
    it('sets correct row and col data attributes', () => {
      render(<SquareCell {...defaultProps} rowIndex={5} colIndex={7} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-row', '5')
      expect(button).toHaveAttribute('data-col', '7')
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<SquareCell {...defaultProps} className="custom-class" />)

      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })
})
