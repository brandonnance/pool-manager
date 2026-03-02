'use client'

import { createContext, useContext, type ReactNode } from 'react'

interface GpPool {
  id: string
  pool_id: string
  tournament_id: string | null
  min_tier_points: number | null
  picks_lock_at: string | null
  demo_mode: boolean | null
  public_slug: string | null
  public_entries_enabled: boolean | null
}

interface Tournament {
  id: string
  name: string
  start_date: string
  end_date: string
  venue: string | null
  course_name: string | null
  status: string | null
}

interface Pool {
  name: string
  status: string
}

interface TierStatus {
  fieldCount: number
  tieredCount: number
}

interface GolfSetupContextValue {
  poolId: string
  gpPool: GpPool
  tournament: Tournament | null
  pool: Pool
  hasEntries: boolean
  tierStatus: TierStatus
  reload: () => Promise<void>
}

const GolfSetupContext = createContext<GolfSetupContextValue | null>(null)

export function GolfSetupProvider({
  children,
  value,
}: {
  children: ReactNode
  value: GolfSetupContextValue
}) {
  return (
    <GolfSetupContext.Provider value={value}>
      {children}
    </GolfSetupContext.Provider>
  )
}

export function useGolfSetup() {
  const context = useContext(GolfSetupContext)
  if (!context) {
    throw new Error('useGolfSetup must be used within GolfSetupProvider')
  }
  return context
}

export type { GpPool, Tournament, Pool, TierStatus }
