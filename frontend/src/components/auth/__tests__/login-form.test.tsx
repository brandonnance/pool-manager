import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../login-form'

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock Supabase client
const mockSignInWithPassword = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete('next')
  })

  it('renders login form with email and password inputs', () => {
    render(<LoginForm />)

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders forgot password link', () => {
    render(<LoginForm />)

    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
  })

  it('renders signup link', () => {
    render(<LoginForm />)

    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/signup')
  })

  it('allows typing in email and password fields', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')

    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('password123')
  })

  it('submits form and redirects to dashboard on successful login', async () => {
    const user = userEvent.setup()
    mockSignInWithPassword.mockResolvedValueOnce({ error: null })

    render(<LoginForm />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })

    expect(mockPush).toHaveBeenCalledWith('/dashboard')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    // Never resolve to keep loading state
    mockSignInWithPassword.mockImplementation(() => new Promise(() => {}))

    render(<LoginForm />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
  })

  it('displays error message on failed login', async () => {
    const user = userEvent.setup()
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    })

    render(<LoginForm />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    })

    // Should not redirect on error
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('redirects to custom URL when next param is provided', async () => {
    const user = userEvent.setup()
    mockSearchParams.set('next', '/pools/123')
    mockSignInWithPassword.mockResolvedValueOnce({ error: null })

    render(<LoginForm />)

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/pools/123')
    })
  })

  it('includes next param in signup link when provided', () => {
    mockSearchParams.set('next', '/pools/123')
    render(<LoginForm />)

    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute(
      'href',
      '/signup?next=%2Fpools%2F123'
    )
  })

  it('clears error when retrying login', async () => {
    const user = userEvent.setup()
    mockSignInWithPassword
      .mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
      .mockResolvedValueOnce({ error: null })

    render(<LoginForm />)

    // First attempt - fails
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    })

    // Second attempt - should clear error on submit
    await user.clear(screen.getByLabelText(/password/i))
    await user.type(screen.getByLabelText(/password/i), 'correctpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.queryByText('Invalid login credentials')).not.toBeInTheDocument()
    })
  })
})
