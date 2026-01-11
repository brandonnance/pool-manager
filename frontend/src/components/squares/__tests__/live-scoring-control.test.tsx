import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LiveScoringControl } from '../live-scoring-control'

// Mock next/navigation
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null }),
            }),
          }),
        }),
      }),
      insert: () => Promise.resolve({ error: null }),
    }),
  }),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('LiveScoringControl', () => {
  const defaultProps = {
    gameId: 'game-1',
    sqPoolId: 'pool-1',
    espnGameId: '401772981',
    currentStatus: 'scheduled',
    paysHalftime: false,
    reverseScoring: false,
    rowNumbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    colNumbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render nothing when espnGameId is null', () => {
      const { container } = render(
        <LiveScoringControl {...defaultProps} espnGameId={null} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should show ESPN badge for final games but no controls', () => {
      render(<LiveScoringControl {...defaultProps} currentStatus="final" />)
      expect(screen.getByText('ESPN: 401772981')).toBeInTheDocument()
      expect(screen.queryByText('Start Live')).not.toBeInTheDocument()
      expect(screen.queryByText('Sync')).not.toBeInTheDocument()
    })

    it('should show ESPN ID badge for non-final games', () => {
      render(<LiveScoringControl {...defaultProps} />)
      expect(screen.getByText('ESPN: 401772981')).toBeInTheDocument()
    })

    it('should show Start Live button when not polling', () => {
      render(<LiveScoringControl {...defaultProps} />)
      expect(screen.getByText('Start Live')).toBeInTheDocument()
    })

    it('should show Sync button for non-final games', () => {
      render(<LiveScoringControl {...defaultProps} />)
      expect(screen.getByText('Sync')).toBeInTheDocument()
    })

    it('should render for in_progress games', () => {
      render(<LiveScoringControl {...defaultProps} currentStatus="in_progress" />)
      expect(screen.getByText('Start Live')).toBeInTheDocument()
      expect(screen.getByText('Sync')).toBeInTheDocument()
    })
  })

  describe('sync functionality', () => {
    it('should call sync API when Sync button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'in_progress',
          homeScore: 7,
          awayScore: 14,
          halftimeHomeScore: null,
          halftimeAwayScore: null,
          q1HomeScore: null,
          q1AwayScore: null,
          q3HomeScore: null,
          q3AwayScore: null,
        }),
      })

      render(<LiveScoringControl {...defaultProps} />)

      const syncButton = screen.getByText('Sync')
      fireEvent.click(syncButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/squares/sync-score?espnGameId=401772981'
        )
      })
    })

    it('should display error when sync fails with API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Game not found' }),
      })

      render(<LiveScoringControl {...defaultProps} />)

      const syncButton = screen.getByText('Sync')
      fireEvent.click(syncButton)

      await waitFor(() => {
        expect(screen.getByText('Game not found')).toBeInTheDocument()
      })
    })

    it('should display generic error when sync fails without message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      render(<LiveScoringControl {...defaultProps} />)

      const syncButton = screen.getByText('Sync')
      fireEvent.click(syncButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch score')).toBeInTheDocument()
      })
    })

    it('should show last synced time after successful sync', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'in_progress',
          homeScore: 7,
          awayScore: 14,
          halftimeHomeScore: null,
          halftimeAwayScore: null,
          q1HomeScore: null,
          q1AwayScore: null,
          q3HomeScore: null,
          q3AwayScore: null,
        }),
      })

      render(<LiveScoringControl {...defaultProps} />)

      const syncButton = screen.getByText('Sync')
      fireEvent.click(syncButton)

      await waitFor(() => {
        expect(screen.getByText('0s ago')).toBeInTheDocument()
      })
    })

    it('should call router.refresh after successful sync', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          status: 'in_progress',
          homeScore: 7,
          awayScore: 14,
          halftimeHomeScore: null,
          halftimeAwayScore: null,
          q1HomeScore: null,
          q1AwayScore: null,
          q3HomeScore: null,
          q3AwayScore: null,
        }),
      })

      render(<LiveScoringControl {...defaultProps} />)

      const syncButton = screen.getByText('Sync')
      fireEvent.click(syncButton)

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })
  })

  describe('polling toggle', () => {
    it('should toggle button text when Start Live is clicked', async () => {
      // Don't actually sync - just test the button toggle
      mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

      render(<LiveScoringControl {...defaultProps} />)

      expect(screen.getByText('Start Live')).toBeInTheDocument()

      const startButton = screen.getByText('Start Live')
      fireEvent.click(startButton)

      // Button should change to Live (even while sync is pending)
      await waitFor(() => {
        expect(screen.getByText('Live')).toBeInTheDocument()
      })
    })
  })
})
