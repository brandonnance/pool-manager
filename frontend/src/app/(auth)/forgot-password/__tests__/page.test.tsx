import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPasswordPage from '../page'

// Mock Supabase client
const mockResetPasswordForEmail = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
  }),
}))

// Mock window.location.origin
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
  },
  writable: true,
})

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders forgot password form', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('renders explanatory text', () => {
    render(<ForgotPasswordPage />)

    expect(
      screen.getByText(/enter your email address and we'll send you a link/i)
    ).toBeInTheDocument()
  })

  it('renders back to login link', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login')
  })

  it('allows typing in email field', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    const emailInput = screen.getByLabelText(/email address/i)
    await user.type(emailInput, 'test@example.com')

    expect(emailInput).toHaveValue('test@example.com')
  })

  it('submits form and shows success message', async () => {
    const user = userEvent.setup()
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null })

    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
        redirectTo: 'http://localhost:3000/auth/callback?next=/reset-password',
      })
    })

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/check your email for a password reset link/i)).toBeInTheDocument()
    })
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    // Never resolve to keep loading state
    mockResetPasswordForEmail.mockImplementation(() => new Promise(() => {}))

    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
  })

  it('displays error message on failure', async () => {
    const user = userEvent.setup()
    mockResetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'Unable to send reset email' },
    })

    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/email address/i), 'invalid@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByText('Unable to send reset email')).toBeInTheDocument()
    })

    // Should still show form (not success message)
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('shows back to login link in success state', async () => {
    const user = userEvent.setup()
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null })

    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('href', '/login')
    })
  })

  it('email field is required', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('required')
  })
})
