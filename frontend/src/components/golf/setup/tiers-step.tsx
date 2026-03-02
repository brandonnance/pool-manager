'use client'

import { useGolfSetup } from './golf-setup-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GpElitePromotionModal } from '@/components/golf/gp-elite-promotion-modal'
import { Check, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export function TiersStep() {
  const { poolId, gpPool, tierStatus, hasEntries } = useGolfSetup()
  const { fieldCount, tieredCount } = tierStatus
  const allTiered = fieldCount > 0 && tieredCount >= fieldCount
  const missing = fieldCount - tieredCount

  return (
    <div className="space-y-6">
      {/* Tier Status */}
      <Card>
        <CardHeader>
          <CardTitle>Tier Assignments</CardTitle>
          <CardDescription>
            Assign each golfer to a tier before opening the pool
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fieldCount === 0 ? (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <span>No golfers in tournament field. Import a tournament first.</span>
            </div>
          ) : allTiered ? (
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              <span>All {fieldCount} golfers have tier assignments.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <span>{missing} of {fieldCount} golfer{missing === 1 ? '' : 's'} still need tier assignments.</span>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Link href={`/pools/${poolId}/golf/tiers`}>
              <Button variant={allTiered ? 'outline' : 'default'}>
                {allTiered ? 'View Tier Assignments' : 'Edit Tier Assignments'}
              </Button>
            </Link>
            {gpPool.tournament_id && (
              <GpElitePromotionModal
                gpPoolId={gpPool.id}
                tournamentId={gpPool.tournament_id}
                locked={hasEntries}
              />
            )}
          </div>

          {hasEntries && (
            <p className="text-sm text-muted-foreground">
              Entries exist for this pool. Tier assignments are locked to prevent inconsistencies.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
