'use client'

import { useState } from 'react'
import { type Square } from '../squares-grid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import type { SqWinner, ScoreChange } from './types'

// Score Change Log
export function SimpleScoreChangeLog({
  scoreChanges,
  squares,
  rowNumbers,
  colNumbers,
  reverseScoring,
  winners,
  isCommissioner = false,
  isFinal = false,
  onDeleteScoreChange,
}: {
  scoreChanges: ScoreChange[]
  squares: Square[]
  rowNumbers: number[]
  colNumbers: number[]
  reverseScoring: boolean
  winners: SqWinner[]
  isCommissioner?: boolean
  isFinal?: boolean
  onDeleteScoreChange?: (changeOrder: number) => void
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [scoreChangeToDelete, setScoreChangeToDelete] = useState<ScoreChange | null>(null)

  const sortedScoreChanges = [...scoreChanges].sort((a, b) => a.change_order - b.change_order)
  const deletesMultiple = scoreChangeToDelete
    ? sortedScoreChanges.filter((sc) => sc.change_order >= scoreChangeToDelete.change_order).length > 1
    : false

  const handleDeleteClick = (change: ScoreChange) => {
    setScoreChangeToDelete(change)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = () => {
    if (scoreChangeToDelete && onDeleteScoreChange) {
      onDeleteScoreChange(scoreChangeToDelete.change_order)
    }
    setDeleteConfirmOpen(false)
    setScoreChangeToDelete(null)
  }
  // Group winners by change_order (stored in payout) - includes both score_change and hybrid types
  const winnersByChangeOrder = new Map<number, SqWinner[]>()
  for (const w of winners) {
    // Include score_change, score_change_reverse, and hybrid quarter types
    if (w.win_type === 'score_change' || w.win_type === 'score_change_reverse' ||
        w.win_type.startsWith('hybrid_')) {
      const order = w.payout ?? 0
      if (!winnersByChangeOrder.has(order)) {
        winnersByChangeOrder.set(order, [])
      }
      winnersByChangeOrder.get(order)!.push(w)
    }
  }

  // Get quarter badge color
  const getQuarterBadgeStyle = (quarter: string) => {
    switch (quarter) {
      case 'q1': return 'bg-amber-100 text-amber-700'
      case 'halftime': return 'bg-blue-100 text-blue-700'
      case 'q3': return 'bg-teal-100 text-teal-700'
      case 'final': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  // Get winner badge style based on win type
  const getWinnerBadgeStyle = (winType: string) => {
    if (winType.includes('_reverse')) {
      if (winType.startsWith('hybrid_q1')) return 'bg-orange-100 text-orange-700'
      if (winType.startsWith('hybrid_halftime')) return 'bg-cyan-100 text-cyan-700'
      if (winType.startsWith('hybrid_q3')) return 'bg-green-100 text-green-700'
      if (winType.startsWith('hybrid_final')) return 'bg-fuchsia-100 text-fuchsia-700'
      return 'bg-rose-100 text-rose-700'
    }
    if (winType.startsWith('hybrid_q1')) return 'bg-amber-100 text-amber-700'
    if (winType.startsWith('hybrid_halftime')) return 'bg-blue-100 text-blue-700'
    if (winType.startsWith('hybrid_q3')) return 'bg-teal-100 text-teal-700'
    if (winType.startsWith('hybrid_final')) return 'bg-purple-100 text-purple-700'
    return 'bg-emerald-100 text-emerald-700'
  }

  return (
    <>
      <div className="space-y-2">
        {scoreChanges
          .sort((a, b) => b.change_order - a.change_order)
          .map((change) => {
            const changeWinners = winnersByChangeOrder.get(change.change_order) || []
            const homeDigit = change.home_score % 10
            const awayDigit = change.away_score % 10

            return (
              <div key={change.id} className="p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      #{change.change_order}
                    </Badge>
                    <div className="font-mono text-lg font-bold">
                      {change.away_score} - {change.home_score}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      [{awayDigit}-{homeDigit}]
                    </span>
                    {change.quarter_marker && change.quarter_marker.length > 0 && (
                      <>
                        {change.quarter_marker.map((qm) => (
                          <span key={qm} className={`text-xs px-1.5 py-0.5 rounded font-medium ${getQuarterBadgeStyle(qm)}`}>
                            {qm === 'q1' ? 'Q1' :
                             qm === 'halftime' ? 'HALF' :
                             qm === 'q3' ? 'Q3' :
                             qm === 'final' ? 'FINAL' :
                             qm.toUpperCase()}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                  {isCommissioner && !isFinal && onDeleteScoreChange && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteClick(change)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {changeWinners.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-dashed flex flex-wrap gap-2">
                    {changeWinners.map((winner) => (
                      <div
                        key={winner.id}
                        className={`text-xs px-2 py-1 rounded ${getWinnerBadgeStyle(winner.win_type)}`}
                      >
                        {winner.win_type.includes('_reverse') && <span className="mr-1">(R)</span>}
                        {winner.winner_name || 'Unclaimed'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

        {scoreChanges.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No score changes recorded yet.
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletesMultiple ? 'Delete Multiple Score Changes?' : 'Delete Score Change?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletesMultiple ? (
                <>
                  Deleting score #{scoreChangeToDelete?.change_order} will also delete all{' '}
                  <strong>
                    {sortedScoreChanges.filter(
                      (sc) => sc.change_order > (scoreChangeToDelete?.change_order ?? 0)
                    ).length}{' '}
                    score changes after it
                  </strong>{' '}
                  and their associated winners. This cannot be undone.
                </>
              ) : (
                <>
                  This will delete score #{scoreChangeToDelete?.change_order} (
                  {scoreChangeToDelete?.away_score}-{scoreChangeToDelete?.home_score}) and its
                  associated winners. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
