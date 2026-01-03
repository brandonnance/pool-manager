import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrgMemberActions } from '../org-member-actions'

// Mock next/navigation
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Mock Supabase client
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockSelect = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'org_memberships') {
        return {
          update: mockUpdate,
          delete: mockDelete,
          select: mockSelect,
        }
      }
      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn() }) }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn() }) }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn() }) }),
      }
    },
  }),
}))

// Mock window.confirm
const mockConfirm = vi.fn()
global.confirm = mockConfirm

describe('OrgMemberActions', () => {
  const defaultMemberProps = {
    membershipId: 'membership-1',
    orgId: 'org-1',
    role: 'member',
    userName: 'John Doe',
    isCurrentUser: false,
    adminCount: 2,
  }

  const defaultAdminProps = {
    ...defaultMemberProps,
    role: 'admin',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null }),
      }),
    })
    mockConfirm.mockReturnValue(true)
  })

  describe('for current user', () => {
    it('shows dash for current user', () => {
      render(<OrgMemberActions {...defaultMemberProps} isCurrentUser={true} />)

      expect(screen.getByText('-')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('for member role', () => {
    it('shows promote and remove buttons for members', () => {
      render(<OrgMemberActions {...defaultMemberProps} />)

      expect(screen.getByRole('button', { name: /promote/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
    })

    it('does not show demote button for members', () => {
      render(<OrgMemberActions {...defaultMemberProps} />)

      expect(screen.queryByRole('button', { name: /demote/i })).not.toBeInTheDocument()
    })

    it('calls confirm and promotes member when clicking promote', async () => {
      const user = userEvent.setup()
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      mockUpdate.mockReturnValue({ eq: mockEq })

      render(<OrgMemberActions {...defaultMemberProps} />)

      await user.click(screen.getByRole('button', { name: /promote/i }))

      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to promote John Doe to admin?')
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({ role: 'admin' })
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('does not promote when confirm is cancelled', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(false)

      render(<OrgMemberActions {...defaultMemberProps} />)

      await user.click(screen.getByRole('button', { name: /promote/i }))

      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('for admin role', () => {
    it('shows demote and remove buttons for admins', () => {
      render(<OrgMemberActions {...defaultAdminProps} />)

      expect(screen.getByRole('button', { name: /demote/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
    })

    it('does not show promote button for admins', () => {
      render(<OrgMemberActions {...defaultAdminProps} />)

      expect(screen.queryByRole('button', { name: /promote/i })).not.toBeInTheDocument()
    })

    it('calls confirm and demotes admin when clicking demote', async () => {
      const user = userEvent.setup()
      const mockEq = vi.fn().mockResolvedValue({ error: null })
      mockUpdate.mockReturnValue({ eq: mockEq })

      render(<OrgMemberActions {...defaultAdminProps} />)

      await user.click(screen.getByRole('button', { name: /demote/i }))

      expect(mockConfirm).toHaveBeenCalledWith('Are you sure you want to demote John Doe to member?')
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({ role: 'member' })
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('disables demote when last admin', () => {
      render(<OrgMemberActions {...defaultAdminProps} adminCount={1} />)

      expect(screen.getByRole('button', { name: /demote/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /demote/i })).toHaveAttribute(
        'title',
        'Cannot demote the last admin'
      )
    })

    it('disables remove when last admin', () => {
      render(<OrgMemberActions {...defaultAdminProps} adminCount={1} />)

      expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /remove/i })).toHaveAttribute(
        'title',
        'Cannot remove the last admin'
      )
    })

    it('shows error when trying to demote last admin', async () => {
      // This test verifies the disabled state prevents action
      render(<OrgMemberActions {...defaultAdminProps} adminCount={1} />)

      const demoteButton = screen.getByRole('button', { name: /demote/i })
      expect(demoteButton).toBeDisabled()
    })
  })

  describe('super admin protection', () => {
    it('shows Protected for super admin when current user is not super admin', () => {
      render(
        <OrgMemberActions
          {...defaultAdminProps}
          isMemberSuperAdmin={true}
          isCurrentUserSuperAdmin={false}
        />
      )

      expect(screen.getByText('Protected')).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('shows action buttons for super admin when current user is also super admin', () => {
      render(
        <OrgMemberActions
          {...defaultAdminProps}
          isMemberSuperAdmin={true}
          isCurrentUserSuperAdmin={true}
        />
      )

      expect(screen.getByRole('button', { name: /demote/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
    })
  })

  describe('remove action', () => {
    it('shows detailed confirm message when removing member', async () => {
      const user = userEvent.setup()

      render(<OrgMemberActions {...defaultMemberProps} />)

      await user.click(screen.getByRole('button', { name: /remove/i }))

      expect(mockConfirm).toHaveBeenCalled()
      const confirmCall = mockConfirm.mock.calls[0][0]
      expect(confirmCall).toContain('remove John Doe')
      expect(confirmCall).toContain('Bowl Buster pools')
      expect(confirmCall).toContain('Squares pools')
    })

    it('does not remove when confirm is cancelled', async () => {
      const user = userEvent.setup()
      mockConfirm.mockReturnValue(false)

      render(<OrgMemberActions {...defaultMemberProps} />)

      await user.click(screen.getByRole('button', { name: /remove/i }))

      expect(mockDelete).not.toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('shows loading indicator when promoting', async () => {
      const user = userEvent.setup()
      // Never resolve to keep loading
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockImplementation(() => new Promise(() => {})),
      })

      render(<OrgMemberActions {...defaultMemberProps} />)

      await user.click(screen.getByRole('button', { name: /promote/i }))

      // Both buttons show "..." when loading, so use getAllByText
      await waitFor(() => {
        const loadingIndicators = screen.getAllByText('...')
        expect(loadingIndicators.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('error handling', () => {
    it('shows error message when promote fails', async () => {
      const user = userEvent.setup()
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Database error' } }),
      })

      render(<OrgMemberActions {...defaultMemberProps} />)

      await user.click(screen.getByRole('button', { name: /promote/i }))

      await waitFor(() => {
        expect(screen.getByText('Database error')).toBeInTheDocument()
      })
    })
  })
})
