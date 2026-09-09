import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArchivePoolButton } from '../archive-pool-button'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRefresh }),
}))

const mockUpdate = vi.fn()
const mockEq = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'pools') throw new Error(`unexpected table ${table}`)
      return { update: mockUpdate }
    },
  }),
}))

const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}))

describe('ArchivePoolButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ error: null })
  })

  it('offers to archive an active pool', () => {
    render(<ArchivePoolButton poolId="p1" poolName="Farmers" archived={false} />)

    expect(screen.getByRole('button', { name: /archive farmers/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unarchive/i })).not.toBeInTheDocument()
  })

  it('offers to unarchive an archived pool', () => {
    render(<ArchivePoolButton poolId="p1" poolName="Farmers" archived={true} />)

    expect(screen.getByRole('button', { name: /unarchive farmers/i })).toBeInTheDocument()
  })

  it('archiving stamps archived_at on that pool and refreshes', async () => {
    const user = userEvent.setup()
    render(<ArchivePoolButton poolId="p1" poolName="Farmers" archived={false} />)

    await user.click(screen.getByRole('button', { name: /archive farmers/i }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const payload = mockUpdate.mock.calls[0][0] as { archived_at: string | null }
    expect(typeof payload.archived_at).toBe('string')
    expect(Number.isNaN(Date.parse(payload.archived_at as string))).toBe(false)
    expect(mockEq).toHaveBeenCalledWith('id', 'p1')
  })

  it('unarchiving clears archived_at on that pool and refreshes', async () => {
    const user = userEvent.setup()
    render(<ArchivePoolButton poolId="p1" poolName="Farmers" archived={true} />)

    await user.click(screen.getByRole('button', { name: /unarchive farmers/i }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    expect(mockUpdate).toHaveBeenCalledWith({ archived_at: null })
    expect(mockEq).toHaveBeenCalledWith('id', 'p1')
  })

  it('does not let the click bubble to the surrounding card', async () => {
    const user = userEvent.setup()
    const onCardClick = vi.fn()
    render(
      <div onClick={onCardClick}>
        <ArchivePoolButton poolId="p1" poolName="Farmers" archived={false} />
      </div>
    )

    await user.click(screen.getByRole('button', { name: /archive farmers/i }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('reports a failed update instead of refreshing', async () => {
    const user = userEvent.setup()
    mockEq.mockResolvedValue({ error: { message: 'permission denied' } })
    render(<ArchivePoolButton poolId="p1" poolName="Farmers" archived={false} />)

    await user.click(screen.getByRole('button', { name: /archive farmers/i }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalled())
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
