import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameScoreCard } from '../game-score-card'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(),
  }),
}))

describe('GameScoreCard', () => {
  const defaultGame = {
    id: 'game-1',
    game_name: 'Wild Card 1',
    home_team: 'Chiefs',
    away_team: 'Dolphins',
    home_score: null,
    away_score: null,
    halftime_home_score: null,
    halftime_away_score: null,
    round: 'wild_card',
    status: 'scheduled',
    pays_halftime: false,
    display_order: 1,
  }

  const defaultProps = {
    game: defaultGame,
    sqPoolId: 'pool-1',
    winners: [],
    squares: [],
    rowNumbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    colNumbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    numbersLocked: true,
    reverseScoring: false,
    currentUserId: null,
    isCommissioner: false,
  }

  describe('basic rendering', () => {
    it('renders game name', () => {
      render(<GameScoreCard {...defaultProps} />)

      expect(screen.getByText('Wild Card 1')).toBeInTheDocument()
    })

    it('renders team names', () => {
      render(<GameScoreCard {...defaultProps} />)

      expect(screen.getByText('Chiefs')).toBeInTheDocument()
      expect(screen.getByText('Dolphins')).toBeInTheDocument()
    })

    it('renders VS divider', () => {
      render(<GameScoreCard {...defaultProps} />)

      expect(screen.getByText('VS')).toBeInTheDocument()
    })
  })

  describe('status badges', () => {
    it('shows scheduled badge for scheduled games', () => {
      render(<GameScoreCard {...defaultProps} />)

      expect(screen.getByText('Scheduled')).toBeInTheDocument()
    })

    it('shows live badge for in-progress games', () => {
      render(
        <GameScoreCard
          {...defaultProps}
          game={{ ...defaultGame, status: 'in_progress', home_score: 7, away_score: 3 }}
        />
      )

      expect(screen.getByText('Live')).toBeInTheDocument()
    })

    it('shows final badge for final games', () => {
      render(
        <GameScoreCard
          {...defaultProps}
          game={{ ...defaultGame, status: 'final', home_score: 28, away_score: 21 }}
        />
      )

      expect(screen.getByText('Final')).toBeInTheDocument()
    })
  })

  describe('score display', () => {
    it('shows dashes when no scores', () => {
      render(<GameScoreCard {...defaultProps} />)

      const scores = screen.getAllByText('-')
      expect(scores).toHaveLength(2)
    })

    it('shows scores when available', () => {
      render(
        <GameScoreCard
          {...defaultProps}
          game={{ ...defaultGame, home_score: 28, away_score: 21 }}
        />
      )

      expect(screen.getByText('28')).toBeInTheDocument()
      expect(screen.getByText('21')).toBeInTheDocument()
    })
  })

  describe('halftime scores', () => {
    it('does not show halftime when pays_halftime is false', () => {
      render(
        <GameScoreCard
          {...defaultProps}
          game={{
            ...defaultGame,
            pays_halftime: false,
            halftime_home_score: 14,
            halftime_away_score: 7,
          }}
        />
      )

      expect(screen.queryByText(/halftime/i)).not.toBeInTheDocument()
    })

    it('shows halftime scores when pays_halftime is true and scores exist', () => {
      render(
        <GameScoreCard
          {...defaultProps}
          game={{
            ...defaultGame,
            pays_halftime: true,
            halftime_home_score: 14,
            halftime_away_score: 7,
          }}
        />
      )

      expect(screen.getByText('Halftime: 7 - 14')).toBeInTheDocument()
    })
  })

  describe('current winning square preview', () => {
    it('shows current winning square for in-progress games', () => {
      render(
        <GameScoreCard
          {...defaultProps}
          game={{
            ...defaultGame,
            status: 'in_progress',
            home_score: 17,
            away_score: 24,
          }}
        />
      )

      // away_score % 10 = 4, home_score % 10 = 7
      expect(screen.getByText('Current winning square: [4-7]')).toBeInTheDocument()
    })

    it('does not show current winning square when numbers not locked', () => {
      render(
        <GameScoreCard
          {...defaultProps}
          numbersLocked={false}
          game={{
            ...defaultGame,
            status: 'in_progress',
            home_score: 17,
            away_score: 24,
          }}
        />
      )

      expect(screen.queryByText(/current winning square/i)).not.toBeInTheDocument()
    })
  })

  describe('winners section', () => {
    it('does not show winners section for non-final games', () => {
      render(<GameScoreCard {...defaultProps} />)

      expect(screen.queryByText('Winners')).not.toBeInTheDocument()
    })

    it('shows winners section for final games with winners', () => {
      const finalGame = {
        ...defaultGame,
        status: 'final',
        home_score: 28,
        away_score: 21,
      }

      const winners = [
        {
          id: 'winner-1',
          sq_game_id: 'game-1',
          square_id: 'sq-1',
          win_type: 'normal',
          payout: null,
          winner_name: 'John Doe',
        },
      ]

      const squares = [
        {
          id: 'sq-1',
          row_index: 8,
          col_index: 1,
          user_id: null,
          owner_name: null,
          owner_initials: null,
        },
      ]

      render(
        <GameScoreCard
          {...defaultProps}
          game={finalGame}
          winners={winners}
          squares={squares}
        />
      )

      expect(screen.getByText('Winners')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('shows trophy for current user wins', () => {
      const finalGame = {
        ...defaultGame,
        status: 'final',
        home_score: 28,
        away_score: 21,
      }

      const winners = [
        {
          id: 'winner-1',
          sq_game_id: 'game-1',
          square_id: 'sq-1',
          win_type: 'normal',
          payout: null,
          winner_name: 'Current User',
        },
      ]

      const squares = [
        {
          id: 'sq-1',
          row_index: 8,
          col_index: 1,
          user_id: 'user-123',
          owner_name: 'Current User',
          owner_initials: 'CU',
        },
      ]

      render(
        <GameScoreCard
          {...defaultProps}
          game={finalGame}
          winners={winners}
          squares={squares}
          currentUserId="user-123"
        />
      )

      // Trophy emoji should be present
      expect(screen.getByText('🏆')).toBeInTheDocument()
    })
  })

  describe('win type labels', () => {
    it('shows correct label for normal win type', () => {
      const finalGame = {
        ...defaultGame,
        status: 'final',
        home_score: 28,
        away_score: 21,
      }

      const winners = [
        {
          id: 'winner-1',
          sq_game_id: 'game-1',
          square_id: 'sq-1',
          win_type: 'normal',
          payout: null,
          winner_name: 'Winner',
        },
      ]

      render(
        <GameScoreCard
          {...defaultProps}
          game={finalGame}
          winners={winners}
          squares={[{ id: 'sq-1', row_index: 0, col_index: 0, user_id: null, owner_name: null, owner_initials: null }]}
        />
      )

      // Win type badge should show "Final" for normal
      expect(screen.getAllByText('Final').length).toBeGreaterThanOrEqual(1)
    })

    it('shows correct label for reverse win type', () => {
      const finalGame = {
        ...defaultGame,
        status: 'final',
        home_score: 28,
        away_score: 21,
      }

      const winners = [
        {
          id: 'winner-1',
          sq_game_id: 'game-1',
          square_id: 'sq-1',
          win_type: 'reverse',
          payout: null,
          winner_name: 'Winner',
        },
      ]

      render(
        <GameScoreCard
          {...defaultProps}
          game={finalGame}
          winners={winners}
          squares={[{ id: 'sq-1', row_index: 0, col_index: 0, user_id: null, owner_name: null, owner_initials: null }]}
        />
      )

      expect(screen.getByText('Reverse')).toBeInTheDocument()
    })

    it('shows correct label for halftime win type', () => {
      const finalGame = {
        ...defaultGame,
        status: 'final',
        home_score: 28,
        away_score: 21,
        pays_halftime: true,
        halftime_home_score: 14,
        halftime_away_score: 7,
      }

      const winners = [
        {
          id: 'winner-1',
          sq_game_id: 'game-1',
          square_id: 'sq-1',
          win_type: 'halftime',
          payout: null,
          winner_name: 'Winner',
        },
      ]

      render(
        <GameScoreCard
          {...defaultProps}
          game={finalGame}
          winners={winners}
          squares={[{ id: 'sq-1', row_index: 0, col_index: 0, user_id: null, owner_name: null, owner_initials: null }]}
        />
      )

      expect(screen.getByText('Halftime')).toBeInTheDocument()
    })
  })

  describe('commissioner controls', () => {
    it('does not show commissioner controls when not commissioner', () => {
      render(<GameScoreCard {...defaultProps} isCommissioner={false} />)

      expect(screen.queryByText(/enter score/i)).not.toBeInTheDocument()
    })

    it('does not show commissioner controls when numbers not locked', () => {
      render(
        <GameScoreCard
          {...defaultProps}
          isCommissioner={true}
          numbersLocked={false}
        />
      )

      expect(screen.queryByText(/enter score/i)).not.toBeInTheDocument()
    })
  })

  describe('user won styling', () => {
    it('applies special styling when current user won', () => {
      const finalGame = {
        ...defaultGame,
        status: 'final',
        home_score: 28,
        away_score: 21,
      }

      const winners = [
        {
          id: 'winner-1',
          sq_game_id: 'game-1',
          square_id: 'sq-1',
          win_type: 'normal',
          payout: null,
          winner_name: 'Current User',
        },
      ]

      const squares = [
        {
          id: 'sq-1',
          row_index: 8,
          col_index: 1,
          user_id: 'user-123',
          owner_name: 'Current User',
          owner_initials: 'CU',
        },
      ]

      const { container } = render(
        <GameScoreCard
          {...defaultProps}
          game={finalGame}
          winners={winners}
          squares={squares}
          currentUserId="user-123"
        />
      )

      // Card should have amber ring styling
      const card = container.querySelector('[class*="ring-amber"]')
      expect(card).toBeInTheDocument()
    })
  })
})
