import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignupForm } from '../signup-form'

// Mock next/navigation
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

// Mock Supabase client
const mockSignUp = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
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

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete('next')
  })

  it('renders signup form with all fields', () => {
    render(<SignupForm />)

    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('renders password requirement text', () => {
    render(<SignupForm />)

    expect(screen.getByText(/must be at least 6 characters/i)).toBeInTheDocument()
  })

  it('renders login link', () => {
    render(<SignupForm />)

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login')
  })

  it('allows typing in all form fields', async () => {
    const user = userEvent.setup()
    render(<SignupForm />)

    const displayNameInput = screen.getByLabelText(/display name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)

    await user.type(displayNameInput, 'John Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(passwordInput, 'password123')

    expect(displayNameInput).toHaveValue('John Doe')
    expect(emailInput).toHaveValue('john@example.com')
    expect(passwordInput).toHaveValue('password123')
  })

  it('submits form with correct data and shows success message', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValueOnce({ error: null })

    render(<SignupForm />)

    await user.type(screen.getByLabelText(/display name/i), 'John Doe')
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'password123',
        options: {
          data: {
            display_name: 'John Doe',
          },
          emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fdashboard',
        },
      })
    })

    // Check for success message (use getByRole to avoid duplicate text matches)
    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
      expect(alert).toHaveTextContent(/check your email/i)
      expect(alert).toHaveTextContent(/we've sent you a confirmation link/i)
    })
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    // Never resolve to keep loading state
    mockSignUp.mockImplementation(() => new Promise(() => {}))

    render(<SignupForm />)

    await user.type(screen.getByLabelText(/display name/i), 'John Doe')
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled()
  })

  it('displays error message on failed signup', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValueOnce({
      error: { message: 'User already registered' },
    })

    render(<SignupForm />)

    await user.type(screen.getByLabelText(/display name/i), 'John Doe')
    await user.type(screen.getByLabelText(/email address/i), 'existing@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('User already registered')).toBeInTheDocument()
    })

    // Should still show form (not success message)
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows back to login link after successful signup', async () => {
    const user = userEvent.setup()
    mockSignUp.mockResolvedValueOnce({ error: null })

    render(<SignupForm />)

    await user.type(screen.getByLabelText(/display name/i), 'John Doe')
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute(
        'href',
        '/login'
      )
    })
  })

  it('includes next param in callback URL when provided', async () => {
    const user = userEvent.setup()
    mockSearchParams.set('next', '/pools/123')
    mockSignUp.mockResolvedValueOnce({ error: null })

    render(<SignupForm />)

    await user.type(screen.getByLabelText(/display name/i), 'John Doe')
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fpools%2F123',
          }),
        })
      )
    })
  })

  it('includes next param in login link when provided', () => {
    mockSearchParams.set('next', '/pools/123')
    render(<SignupForm />)

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login?next=%2Fpools%2F123'
    )
  })

  it('has minLength validation on password field', () => {
    render(<SignupForm />)

    const passwordInput = screen.getByLabelText(/password/i)
    expect(passwordInput).toHaveAttribute('minLength', '6')
  })

  it('requires all fields', () => {
    render(<SignupForm />)

    expect(screen.getByLabelText(/display name/i)).toHaveAttribute('required')
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('required')
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('required')
  })
})
