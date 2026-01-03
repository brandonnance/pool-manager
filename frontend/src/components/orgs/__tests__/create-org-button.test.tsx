import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateOrgButton } from '../create-org-button'

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
const mockGetUser = vi.fn()
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      insert: mockInsert,
    }),
  }),
}))

describe('CreateOrgButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
  })

  it('renders the create button', () => {
    render(<CreateOrgButton />)

    expect(screen.getByRole('button', { name: /create organization/i })).toBeInTheDocument()
  })

  it('opens dialog when button is clicked', async () => {
    const user = userEvent.setup()
    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument()
  })

  it('renders dialog description text', async () => {
    const user = userEvent.setup()
    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))

    expect(screen.getByText(/organizations let you group pools together/i)).toBeInTheDocument()
  })

  it('allows typing in name field', async () => {
    const user = userEvent.setup()
    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))
    const input = screen.getByLabelText(/organization name/i)
    await user.type(input, 'My Test Org')

    expect(input).toHaveValue('My Test Org')
  })

  it('disables create button when name is empty', async () => {
    const user = userEvent.setup()
    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))

    // Find the Create button in the dialog (not the trigger)
    const createButton = screen.getByRole('button', { name: /^create$/i })
    expect(createButton).toBeDisabled()
  })

  it('enables create button when name is entered', async () => {
    const user = userEvent.setup()
    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))
    await user.type(screen.getByLabelText(/organization name/i), 'My Org')

    const createButton = screen.getByRole('button', { name: /^create$/i })
    expect(createButton).not.toBeDisabled()
  })

  it('creates organization and redirects on success', async () => {
    const user = userEvent.setup()
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValueOnce({ data: { id: 'org-123', name: 'My Org' }, error: null })

    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))
    await user.type(screen.getByLabelText(/organization name/i), 'My Org')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({ name: 'My Org' })
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/orgs/org-123')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows loading state during creation', async () => {
    const user = userEvent.setup()
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    // Never resolve to keep loading state
    mockSingle.mockImplementation(() => new Promise(() => {}))

    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))
    await user.type(screen.getByLabelText(/organization name/i), 'My Org')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
  })

  it('displays error when not logged in', async () => {
    const user = userEvent.setup()
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))
    await user.type(screen.getByLabelText(/organization name/i), 'My Org')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(screen.getByText('You must be logged in')).toBeInTheDocument()
    })
  })

  it('displays error on creation failure', async () => {
    const user = userEvent.setup()
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Duplicate name' } })

    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))
    await user.type(screen.getByLabelText(/organization name/i), 'Existing Org')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(screen.getByText('Duplicate name')).toBeInTheDocument()
    })
  })

  it('closes dialog and clears form on cancel', async () => {
    const user = userEvent.setup()
    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))
    await user.type(screen.getByLabelText(/organization name/i), 'My Org')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Dialog should be closed
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen to verify form is cleared
    await user.click(screen.getByRole('button', { name: /create organization/i }))
    expect(screen.getByLabelText(/organization name/i)).toHaveValue('')
  })

  it('clears error when dialog is closed', async () => {
    const user = userEvent.setup()
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    render(<CreateOrgButton />)

    await user.click(screen.getByRole('button', { name: /create organization/i }))
    await user.type(screen.getByLabelText(/organization name/i), 'My Org')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => {
      expect(screen.getByText('You must be logged in')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await user.click(screen.getByRole('button', { name: /create organization/i }))

    expect(screen.queryByText('You must be logged in')).not.toBeInTheDocument()
  })
})
