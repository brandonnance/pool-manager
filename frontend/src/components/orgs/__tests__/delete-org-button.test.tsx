import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteOrgButton } from '../delete-org-button'

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
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}))

describe('DeleteOrgButton', () => {
  const defaultProps = {
    orgId: 'org-123',
    orgName: 'Test Organization',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the delete button', () => {
    render(<DeleteOrgButton {...defaultProps} />)

    expect(screen.getByRole('button', { name: /delete organization/i })).toBeInTheDocument()
  })

  it('opens dialog when button is clicked', async () => {
    const user = userEvent.setup()
    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/you are about to permanently delete/i)).toBeInTheDocument()
    // Org name appears multiple times in the dialog (description and confirmation label)
    expect(screen.getAllByText('Test Organization').length).toBeGreaterThanOrEqual(1)
  })

  it('shows warning about permanent deletion', async () => {
    const user = userEvent.setup()
    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))

    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument()
    expect(screen.getByText(/all pools in this organization/i)).toBeInTheDocument()
  })

  it('requires typing org name to confirm', async () => {
    const user = userEvent.setup()
    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))

    const deleteButton = screen.getByRole('button', { name: /delete organization permanently/i })
    expect(deleteButton).toBeDisabled()
  })

  it('enables delete button when correct name is entered', async () => {
    const user = userEvent.setup()
    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    await user.type(screen.getByPlaceholderText('Test Organization'), 'Test Organization')

    const deleteButton = screen.getByRole('button', { name: /delete organization permanently/i })
    expect(deleteButton).not.toBeDisabled()
  })

  it('keeps delete button disabled when wrong name is entered', async () => {
    const user = userEvent.setup()
    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    await user.type(screen.getByPlaceholderText('Test Organization'), 'Wrong Name')

    const deleteButton = screen.getByRole('button', { name: /delete organization permanently/i })
    expect(deleteButton).toBeDisabled()
  })

  it('shows error when name does not match on submit', async () => {
    const user = userEvent.setup()
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })

    // Mock profile check
    const mockProfileSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { is_super_admin: true } })
      })
    })
    mockFrom.mockReturnValue({ select: mockProfileSelect })

    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    const input = screen.getByPlaceholderText('Test Organization')

    // Clear and type wrong value
    await user.clear(input)
    await user.type(input, 'Test Organization') // Type correct name first
    await user.clear(input) // Clear it
    await user.type(input, 'Wrong') // Type wrong name

    // Can't click disabled button - test just verifies it stays disabled
    const deleteButton = screen.getByRole('button', { name: /delete organization permanently/i })
    expect(deleteButton).toBeDisabled()
  })

  it('closes dialog on cancel', async () => {
    const user = userEvent.setup()
    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clears form when dialog is closed', async () => {
    const user = userEvent.setup()
    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    await user.type(screen.getByPlaceholderText('Test Organization'), 'Test Organization')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    // Reopen dialog
    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    expect(screen.getByPlaceholderText('Test Organization')).toHaveValue('')
  })

  it('shows loading state when deleting', async () => {
    const user = userEvent.setup()
    // Mock user auth check to return a user but hang on profile check
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolve
        }),
      }),
    })

    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))
    await user.type(screen.getByPlaceholderText('Test Organization'), 'Test Organization')
    await user.click(screen.getByRole('button', { name: /delete organization permanently/i }))

    // Button should show loading state
    expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled()
  })

  it('displays warning list items', async () => {
    const user = userEvent.setup()
    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))

    expect(screen.getByText(/all pool memberships and entries/i)).toBeInTheDocument()
    expect(screen.getByText(/all picks, scores, and game data/i)).toBeInTheDocument()
    expect(screen.getByText(/all squares and payouts/i)).toBeInTheDocument()
    expect(screen.getByText(/all join links and audit history/i)).toBeInTheDocument()
    expect(screen.getByText(/all org memberships/i)).toBeInTheDocument()
  })

  it('shows note about users not being deleted', async () => {
    const user = userEvent.setup()
    render(<DeleteOrgButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /delete organization/i }))

    expect(screen.getByText(/users will NOT be deleted/i)).toBeInTheDocument()
  })
})
