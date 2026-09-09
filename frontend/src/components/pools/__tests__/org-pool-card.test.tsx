import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OrgPoolCard } from '../org-pool-card'

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: vi.fn(), auth: { getUser: vi.fn() } }),
}))

const ME = 'user-me'
const OTHER = 'user-other'

function pool(overrides: Partial<Parameters<typeof OrgPoolCard>[0]['pool']> = {}) {
  return {
    id: 'p1',
    name: 'Farmers',
    type: 'golf',
    status: 'completed',
    season_label: '2025',
    archived_at: null,
    pool_memberships: [
      { id: 'm1', user_id: ME, status: 'approved', role: 'member' },
      { id: 'm2', user_id: OTHER, status: 'approved', role: 'member' },
    ],
    ...overrides,
  }
}

describe('OrgPoolCard', () => {
  it('shows the archive control to an org admin on a completed pool', () => {
    render(<OrgPoolCard pool={pool()} orgId="o1" userId={ME} isOrgAdmin={true} />)

    expect(screen.getByRole('button', { name: /archive farmers/i })).toBeInTheDocument()
  })

  it('shows the archive control to a pool commissioner who is not an org admin', () => {
    const p = pool({
      pool_memberships: [{ id: 'm1', user_id: ME, status: 'approved', role: 'commissioner' }],
    })
    render(<OrgPoolCard pool={p} orgId="o1" userId={ME} isOrgAdmin={false} />)

    expect(screen.getByRole('button', { name: /archive farmers/i })).toBeInTheDocument()
  })

  it('hides the archive control from a plain member', () => {
    render(<OrgPoolCard pool={pool()} orgId="o1" userId={ME} isOrgAdmin={false} />)

    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument()
  })

  it('hides the archive control on a pool that is not completed, even for admins', () => {
    render(<OrgPoolCard pool={pool({ status: 'open' })} orgId="o1" userId={ME} isOrgAdmin={true} />)

    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument()
  })

  it('marks an archived pool and offers to unarchive it', () => {
    const p = pool({ archived_at: '2026-09-09T12:00:00Z' })
    render(<OrgPoolCard pool={p} orgId="o1" userId={ME} isOrgAdmin={true} />)

    expect(screen.getByText('Archived')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unarchive farmers/i })).toBeInTheDocument()
  })

  it('links to the pool and shows type, season and approved member count', () => {
    render(<OrgPoolCard pool={pool()} orgId="o1" userId={ME} isOrgAdmin={false} />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/pools/p1')
    expect(screen.getByText(/golf · 2025/i)).toBeInTheDocument()
    expect(screen.getByText('2 members')).toBeInTheDocument()
  })
})
