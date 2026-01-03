import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoAccountSquareCell } from '../no-account-square-cell'
import type { WinningRound } from '../square-cell'

describe('NoAccountSquareCell', () => {
  const defaultProps = {
    rowIndex: 0,
    colIndex: 0,
    participantName: null,
    verified: false,
    isCommissioner: false,
    winningRound: null as WinningRound,
  }

  describe('rendering states', () => {
    it('renders empty available square with grid number', () => {
      render(<NoAccountSquareCell {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('00')
    })

    it('renders grid number based on row and column indices', () => {
      render(<NoAccountSquareCell {...defaultProps} rowIndex={5} colIndex={7} />)

      expect(screen.getByRole('button')).toHaveTextContent('57')
    })

    it('renders participant name when assigned', () => {
      render(<NoAccountSquareCell {...defaultProps} participantName="John Doe" />)

      expect(screen.getByRole('button')).toHaveTextContent('John Doe')
    })

    it('shows loading indicator when loading', () => {
      render(<NoAccountSquareCell {...defaultProps} isLoading={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('animate-pulse')
      // Should not show grid number or name when loading
      expect(button).not.toHaveTextContent('00')
    })
  })

  describe('commissioner view', () => {
    it('shows verified status in title for commissioner', () => {
      render(
        <NoAccountSquareCell
          {...defaultProps}
          participantName="John Doe"
          verified={true}
          isCommissioner={true}
        />
      )

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'John Doe - Verified - Click to edit'
      )
    })

    it('shows not verified status in title for commissioner', () => {
      render(
        <NoAccountSquareCell
          {...defaultProps}
          participantName="John Doe"
          verified={false}
          isCommissioner={true}
        />
      )

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'John Doe - Not Verified - Click to edit'
      )
    })

    it('shows assign prompt for empty square in commissioner view', () => {
      render(<NoAccountSquareCell {...defaultProps} isCommissioner={true} />)

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'Square 00 - Click to assign'
      )
    })

    it('applies green styling for verified squares in commissioner view', () => {
      render(
        <NoAccountSquareCell
          {...defaultProps}
          participantName="John Doe"
          verified={true}
          isCommissioner={true}
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('green')
    })

    it('applies red styling for unverified squares in commissioner view', () => {
      render(
        <NoAccountSquareCell
          {...defaultProps}
          participantName="John Doe"
          verified={false}
          isCommissioner={true}
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('red')
    })
  })

  describe('public view', () => {
    it('shows participant name in title for public view', () => {
      render(<NoAccountSquareCell {...defaultProps} participantName="John Doe" />)

      expect(screen.getByRole('button')).toHaveAttribute('title', 'John Doe')
    })

    it('shows available status for empty square in public view', () => {
      render(<NoAccountSquareCell {...defaultProps} />)

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Square 00 - Available')
    })

    it('applies sky blue styling for highlighted squares', () => {
      render(
        <NoAccountSquareCell
          {...defaultProps}
          participantName="John Doe"
          isHighlighted={true}
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('sky')
    })
  })

  describe('click handlers', () => {
    it('calls onClick when commissioner clicks square', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(
        <NoAccountSquareCell
          {...defaultProps}
          isCommissioner={true}
          onClick={onClick}
        />
      )

      await user.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('calls onClick when clicking assigned square in public view', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(
        <NoAccountSquareCell
          {...defaultProps}
          participantName="John Doe"
          onClick={onClick}
        />
      )

      await user.click(screen.getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick for unassigned square in public view', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(<NoAccountSquareCell {...defaultProps} onClick={onClick} />)

      await user.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('does not call onClick when loading', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(
        <NoAccountSquareCell
          {...defaultProps}
          isCommissioner={true}
          isLoading={true}
          onClick={onClick}
        />
      )

      await user.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
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
        <NoAccountSquareCell
          {...defaultProps}
          participantName="Winner"
          winningRound={round}
        />
      )

      expect(screen.getByRole('button')).toHaveTextContent('Winner')
    })

    it('applies gradient for score_change_both', () => {
      render(
        <NoAccountSquareCell
          {...defaultProps}
          participantName="Winner"
          winningRound="score_change_both"
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('gradient')
    })

    it('applies live winning animation when isLiveWinning', () => {
      render(
        <NoAccountSquareCell
          {...defaultProps}
          participantName="Winner"
          isLiveWinning={true}
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('animate-live-winner')
    })
  })

  describe('data attributes', () => {
    it('sets correct row and col data attributes', () => {
      render(<NoAccountSquareCell {...defaultProps} rowIndex={3} colIndex={7} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-row', '3')
      expect(button).toHaveAttribute('data-col', '7')
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<NoAccountSquareCell {...defaultProps} className="custom-class" />)

      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })
})
