import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResetPasswordPage from '../page'

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
const mockUpdateUser = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
    },
  }),
}))

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders reset password form', () => {
    render(<ResetPasswordPage />)

    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('renders explanatory text', () => {
    render(<ResetPasswordPage />)

    expect(screen.getByText(/enter your new password below/i)).toBeInTheDocument()
  })

  it('renders back to login link', () => {
    render(<ResetPasswordPage />)

    expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login')
  })

  it('allows typing in password fields', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)

    const passwordInput = screen.getByLabelText('New password')
    const confirmInput = screen.getByLabelText('Confirm new password')

    await user.type(passwordInput, 'newpassword123')
    await user.type(confirmInput, 'newpassword123')

    expect(passwordInput).toHaveValue('newpassword123')
    expect(confirmInput).toHaveValue('newpassword123')
  })

  it('validates passwords match', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)

    await user.type(screen.getByLabelText('New password'), 'password123')
    await user.type(screen.getByLabelText('Confirm new password'), 'differentpassword')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })

    // Should not call updateUser
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('validates password minimum length', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordPage />)

    await user.type(screen.getByLabelText('New password'), '12345')
    await user.type(screen.getByLabelText('Confirm new password'), '12345')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
    })

    // Should not call updateUser
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('submits form and redirects to dashboard on success', async () => {
    const user = userEvent.setup()
    mockUpdateUser.mockResolvedValueOnce({ error: null })

    render(<ResetPasswordPage />)

    await user.type(screen.getByLabelText('New password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      })
    })

    expect(mockPush).toHaveBeenCalledWith('/dashboard?message=password-updated')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    // Never resolve to keep loading state
    mockUpdateUser.mockImplementation(() => new Promise(() => {}))

    render(<ResetPasswordPage />)

    await user.type(screen.getByLabelText('New password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    expect(screen.getByRole('button', { name: /updating/i })).toBeDisabled()
  })

  it('displays error message on failure', async () => {
    const user = userEvent.setup()
    mockUpdateUser.mockResolvedValueOnce({
      error: { message: 'Session expired' },
    })

    render(<ResetPasswordPage />)

    await user.type(screen.getByLabelText('New password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByText('Session expired')).toBeInTheDocument()
    })

    // Should not redirect
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('password fields are required', () => {
    render(<ResetPasswordPage />)

    expect(screen.getByLabelText('New password')).toHaveAttribute('required')
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('required')
  })

  it('clears error when retrying', async () => {
    const user = userEvent.setup()
    mockUpdateUser
      .mockResolvedValueOnce({ error: { message: 'Session expired' } })
      .mockResolvedValueOnce({ error: null })

    render(<ResetPasswordPage />)

    // First attempt - fails
    await user.type(screen.getByLabelText('New password'), 'newpassword123')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.getByText('Session expired')).toBeInTheDocument()
    })

    // Second attempt - error should clear on submit
    await user.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(screen.queryByText('Session expired')).not.toBeInTheDocument()
    })
  })
})
