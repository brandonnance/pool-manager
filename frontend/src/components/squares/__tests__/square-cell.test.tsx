import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SquareCell } from '../square-cell'
import type { WinningRound } from '../square-cell'

describe('SquareCell', () => {
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
      render(<SquareCell {...defaultProps} />)

      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveTextContent('00')
    })

    it('renders grid number based on row and column indices', () => {
      render(<SquareCell {...defaultProps} rowIndex={5} colIndex={7} />)

      expect(screen.getByRole('button')).toHaveTextContent('57')
    })

    it('renders participant name when assigned', () => {
      render(<SquareCell {...defaultProps} participantName="John Doe" />)

      expect(screen.getByRole('button')).toHaveTextContent('John Doe')
    })

    it('shows loading indicator when loading', () => {
      render(<SquareCell {...defaultProps} isLoading={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('animate-pulse')
      // Should not show grid number or name when loading
      expect(button).not.toHaveTextContent('00')
    })
  })

  describe('commissioner view', () => {
    it('shows verified status in title for commissioner', () => {
      render(
        <SquareCell
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
        <SquareCell
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
      render(<SquareCell {...defaultProps} isCommissioner={true} />)

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'Square 00 - Click to assign'
      )
    })

    it('applies neutral styling for verified squares in commissioner view', () => {
      render(
        <SquareCell
          {...defaultProps}
          participantName="John Doe"
          verified={true}
          isCommissioner={true}
        />
      )

      const button = screen.getByRole('button')
      // Verified squares use white background with gray border
      expect(button.className).toContain('bg-white')
      expect(button.className).toContain('border-gray')
    })

    it('applies red styling for unverified squares in commissioner view', () => {
      render(
        <SquareCell
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
      render(<SquareCell {...defaultProps} participantName="John Doe" />)

      expect(screen.getByRole('button')).toHaveAttribute('title', 'John Doe')
    })

    it('shows available status for empty square in public view', () => {
      render(<SquareCell {...defaultProps} />)

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Square 00 - Available')
    })

    it('applies sky blue styling for highlighted squares', () => {
      render(
        <SquareCell
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
        <SquareCell
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
        <SquareCell
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

      render(<SquareCell {...defaultProps} onClick={onClick} />)

      await user.click(screen.getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })

    it('does not call onClick when loading', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()

      render(
        <SquareCell
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
      // Hybrid mode winning rounds
      'hybrid_q1',
      'hybrid_q1_reverse',
      'hybrid_q1_both',
      'hybrid_halftime',
      'hybrid_halftime_reverse',
      'hybrid_halftime_both',
      'hybrid_q3',
      'hybrid_q3_reverse',
      'hybrid_q3_both',
      'hybrid_final',
      'hybrid_final_reverse',
      'hybrid_final_both',
    ]

    it.each(winningRounds)('renders winning square for %s round', (round) => {
      render(
        <SquareCell
          {...defaultProps}
          participantName="Winner"
          winningRound={round}
        />
      )

      expect(screen.getByRole('button')).toHaveTextContent('Winner')
    })

    it('applies gradient for score_change_both', () => {
      render(
        <SquareCell
          {...defaultProps}
          participantName="Winner"
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
          participantName="Winner"
          winningRound="score_change_final_both"
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('gradient')
    })

    it('applies gradient for hybrid_q1_both', () => {
      render(
        <SquareCell
          {...defaultProps}
          participantName="Winner"
          winningRound="hybrid_q1_both"
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('gradient')
    })

    it('applies gradient for hybrid_halftime_both', () => {
      render(
        <SquareCell
          {...defaultProps}
          participantName="Winner"
          winningRound="hybrid_halftime_both"
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('gradient')
    })

    it('applies gradient for hybrid_q3_both', () => {
      render(
        <SquareCell
          {...defaultProps}
          participantName="Winner"
          winningRound="hybrid_q3_both"
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('gradient')
    })

    it('applies gradient for hybrid_final_both', () => {
      render(
        <SquareCell
          {...defaultProps}
          participantName="Winner"
          winningRound="hybrid_final_both"
        />
      )

      const button = screen.getByRole('button')
      expect(button.className).toContain('gradient')
    })

    it('applies live winning animation when isLiveWinning', () => {
      render(
        <SquareCell
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
      render(<SquareCell {...defaultProps} rowIndex={3} colIndex={7} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('data-row', '3')
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
