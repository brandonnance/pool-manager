import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogoutButton } from '../logout-button'

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Mock Supabase client
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}))

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders sign out button', () => {
    render(<LogoutButton />)

    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('calls signOut and redirects to login on click', async () => {
    const user = userEvent.setup()
    mockSignOut.mockResolvedValueOnce({})

    render(<LogoutButton />)

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/login')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('applies correct styling classes', () => {
    render(<LogoutButton />)

    const button = screen.getByRole('button', { name: /sign out/i })
    expect(button).toHaveClass('bg-white/20')
    expect(button).toHaveClass('text-primary-foreground')
  })
})
