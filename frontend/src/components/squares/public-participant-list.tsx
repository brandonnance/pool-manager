'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NoAccountSquare } from './squares-grid'

interface Participant {
  name: string
  totalSquares: number
}

interface PublicParticipantListProps {
  squares: NoAccountSquare[]
  selectedParticipantName: string | null
  onSelectParticipant: (name: string | null) => void
  className?: string
}

export function PublicParticipantList({
  squares,
  selectedParticipantName,
  onSelectParticipant,
  className,
}: PublicParticipantListProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Aggregate participant data from squares
  const participants = useMemo(() => {
    const participantMap = new Map<string, Participant>()

    squares.forEach((square) => {
      if (!square.participant_name) return

      const lowerName = square.participant_name.toLowerCase()
      const existing = participantMap.get(lowerName)

      if (existing) {
        existing.totalSquares++
      } else {
        participantMap.set(lowerName, {
          name: square.participant_name, // Preserve original casing from first occurrence
          totalSquares: 1,
        })
      }
    })

    // Sort by name
    return Array.from(participantMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [squares])

  const handleRowClick = (participantName: string) => {
    // Toggle selection - if same participant clicked, deselect
    if (selectedParticipantName === participantName) {
      onSelectParticipant(null)
    } else {
      onSelectParticipant(participantName)
    }
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
          <span className="text-sm text-muted-foreground">
            {squares.filter((s) => s.participant_name).length} squares claimed
          </span>
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
                  <th className="text-center px-4 py-2 font-medium w-24">Squares</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {participants.map((participant) => {
                  const isSelected = selectedParticipantName === participant.name
                  return (
                    <tr
                      key={participant.name.toLowerCase()}
                      onClick={() => handleRowClick(participant.name)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-sky-100 hover:bg-sky-150'
                          : 'hover:bg-muted/30'
                      )}
                    >
                      <td
                        className={cn(
                          'px-4 py-2',
                          isSelected ? 'font-semibold text-sky-700' : 'font-medium'
                        )}
                      >
                        {participant.name}
                      </td>
                      <td
                        className={cn(
                          'text-center px-4 py-2',
                          isSelected && 'text-sky-700'
                        )}
                      >
                        {participant.totalSquares}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
            Click a row to highlight their squares on the grid
          </div>
        </div>
      )}
    </div>
  )
}
