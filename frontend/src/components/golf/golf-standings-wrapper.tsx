'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { GolfStandings } from './golf-standings'

interface GolferScore {
  golferId: string
  golferName: string
  tier: number
  round1: number | null
  round2: number | null
  round3: number | null
  round4: number | null
  totalScore: number
  madeCut: boolean
  counted: boolean
}

interface EntryStanding {
  entryId: string
  entryName: string | null
  userName: string | null
  userId: string
  rank: number
  tied: boolean
  score: number | null
  golferScores: GolferScore[]
}

interface GolfStandingsWrapperProps {
  poolId: string
  currentUserId: string
  tournamentStatus: 'upcoming' | 'in_progress' | 'completed'
}

export function GolfStandingsWrapper({
  poolId,
  currentUserId,
  tournamentStatus
}: GolfStandingsWrapperProps) {
  const [standings, setStandings] = useState<EntryStanding[]>([])
  const [parPerRound, setParPerRound] = useState<number>(72)
  const [totalPar, setTotalPar] = useState<number>(288)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStandings() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/golf/standings?poolId=${poolId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch standings')
        }

        setStandings(data.standings)
        setParPerRound(data.parPerRound ?? 72)
        setTotalPar(data.totalPar ?? 288)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load standings')
      }

      setLoading(false)
    }

    fetchStandings()

    // Refresh every 60 seconds during in-progress tournaments
    if (tournamentStatus === 'in_progress') {
      const interval = setInterval(fetchStandings, 60000)
      return () => clearInterval(interval)
    }
  }, [poolId, tournamentStatus])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {error}
      </div>
    )
  }

  return (
    <GolfStandings
      standings={standings}
      currentUserId={currentUserId}
      tournamentStatus={tournamentStatus}
      parPerRound={parPerRound}
      totalPar={totalPar}
    />
  )
}
