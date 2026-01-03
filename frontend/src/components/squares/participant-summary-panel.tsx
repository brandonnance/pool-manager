'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Participant {
  name: string
  totalSquares: number
  verifiedCount: number
  unverifiedCount: number
  squareIds: string[]
}

interface ParticipantSummaryPanelProps {
  sqPoolId: string
  className?: string
}

export function ParticipantSummaryPanel({ sqPoolId, className }: ParticipantSummaryPanelProps) {
  const router = useRouter()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch and aggregate participant data
  const fetchParticipants = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('sq_squares')
      .select('id, participant_name, verified')
      .eq('sq_pool_id', sqPoolId)
      .not('participant_name', 'is', null)

    if (data) {
      // Group by participant name (case-insensitive)
      const participantMap = new Map<string, Participant>()

      data.forEach(square => {
        if (!square.participant_name) return

        const lowerName = square.participant_name.toLowerCase()
        const existing = participantMap.get(lowerName)

        if (existing) {
          existing.totalSquares++
          if (square.verified) {
            existing.verifiedCount++
          } else {
            existing.unverifiedCount++
          }
          existing.squareIds.push(square.id)
        } else {
          participantMap.set(lowerName, {
            name: square.participant_name, // Preserve original casing from first occurrence
            totalSquares: 1,
            verifiedCount: square.verified ? 1 : 0,
            unverifiedCount: square.verified ? 0 : 1,
            squareIds: [square.id],
          })
        }
      })

      // Sort by name
      const sorted = Array.from(participantMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
      setParticipants(sorted)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchParticipants()

    // Subscribe to realtime updates
    const supabase = createClient()
    const channel = supabase
      .channel(`participant-summary-${sqPoolId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sq_squares',
          filter: `sq_pool_id=eq.${sqPoolId}`,
        },
        () => {
          fetchParticipants()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sqPoolId])

  const handleBulkVerify = async (participant: Participant, setVerified: boolean) => {
    setActionLoading(participant.name)

    const supabase = createClient()
    const { error } = await supabase
      .from('sq_squares')
      .update({ verified: setVerified })
      .in('id', participant.squareIds)

    if (!error) {
      await fetchParticipants()
      router.refresh()
    }

    setActionLoading(null)
  }

  // Calculate totals
  const totalSquares = participants.reduce((sum, p) => sum + p.totalSquares, 0)
  const totalVerified = participants.reduce((sum, p) => sum + p.verifiedCount, 0)
  const totalUnverified = participants.reduce((sum, p) => sum + p.unverifiedCount, 0)

  if (isLoading) {
    return (
      <div className={cn('rounded-lg border bg-card p-4', className)}>
        <div className="animate-pulse flex items-center gap-2">
          <div className="size-5 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-32" />
        </div>
      </div>
    )
  }

  if (participants.length === 0) {
    return null
  }

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="size-5 text-muted-foreground" />
          <span className="font-medium">Participants</span>
          <span className="text-sm text-muted-foreground">
            ({participants.length})
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-green-600 font-medium">{totalVerified}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-red-600 font-medium">{totalUnverified}</span>
            <span className="text-muted-foreground text-xs ml-1">verified/unverified</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="size-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/80 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-center px-2 py-2 font-medium w-20">Squares</th>
                  <th className="text-center px-2 py-2 font-medium w-28">Status</th>
                  <th className="text-right px-4 py-2 font-medium w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {participants.map((participant) => (
                  <tr key={participant.name.toLowerCase()} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{participant.name}</td>
                    <td className="text-center px-2 py-2">{participant.totalSquares}</td>
                    <td className="text-center px-2 py-2">
                      <span className="text-green-600">{participant.verifiedCount}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-red-600">{participant.unverifiedCount}</span>
                    </td>
                    <td className="text-right px-4 py-2">
                      {actionLoading === participant.name ? (
                        <span className="text-xs text-muted-foreground">Updating...</span>
                      ) : participant.verifiedCount === participant.totalSquares ? (
                        <span className="text-xs text-green-600 flex items-center justify-end gap-1">
                          <CheckCircle2 className="size-3" />
                          All verified
                        </span>
                      ) : participant.unverifiedCount === participant.totalSquares ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleBulkVerify(participant, true)}
                        >
                          <CheckCircle2 className="size-3 mr-1" />
                          Verify All
                        </Button>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 px-2"
                            onClick={() => handleBulkVerify(participant, true)}
                          >
                            <CheckCircle2 className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                            onClick={() => handleBulkVerify(participant, false)}
                          >
                            <XCircle className="size-3" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
