'use client'

import { useState } from 'react'
import { Link2, Copy, Check, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { NdWeek, NdGame } from '@/lib/desperation/types'
import type { NdDashboardEntry } from '@/lib/data/desperation'
import type { Database } from '@/types/database'
import { NdScheduleCard } from './nd-schedule-card'
import { NdEntriesCard } from './nd-entries-card'
import { NdMyEntryCard } from './nd-my-entry-card'
import { NdJoinSettings } from './nd-join-settings'
import { rankByPoints } from '@/lib/desperation/scoring'

type NdPoolRow = Database['public']['Tables']['nd_pools']['Row']

interface Props {
  ndPool: NdPoolRow
  weeks: NdWeek[]
  currentWeek: NdWeek | null
  currentGames: NdGame[]
  entries: NdDashboardEntry[]
  seasonTotals: Record<string, number>
  isCommissioner: boolean
  /** pools.status — joining only works while 'open' */
  poolStatus: string
  /** Signed-in user's email, used to find their own entry in the roster */
  viewerEmail: string | null
  /** Absolute site origin (NEXT_PUBLIC_APP_URL) for building shareable links */
  appOrigin: string
}

export function DesperationContent({ ndPool, weeks, currentWeek, currentGames, entries, seasonTotals, isCommissioner, poolStatus, viewerEmail, appOrigin }: Props) {
  const [copied, setCopied] = useState(false)
  const mine = viewerEmail ? entries.find((e) => e.email === viewerEmail.toLowerCase()) ?? null : null

  const publicUrl = ndPool.public_slug ? `${appOrigin}/desperation/${ndPool.public_slug}` : null
  const standings = rankByPoints(entries.filter((e) => e.active).map((e) => ({ entryId: e.id, points: seasonTotals[e.id] ?? 0 })))
  const byId = new Map(entries.map((e) => [e.id, e]))

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <NdScheduleCard
          seasonYear={ndPool.season_year}
          weeks={weeks}
          currentWeek={currentWeek}
          currentGames={currentGames}
          isCommissioner={isCommissioner}
        />
        {isCommissioner && (
          <NdEntriesCard ndPoolId={ndPool.id} publicSlug={ndPool.public_slug} entries={entries} seasonTotals={seasonTotals} appOrigin={appOrigin} />
        )}
      </div>

      <div className="space-y-6">
        {isCommissioner && (
          <NdMyEntryCard
            ndPoolId={ndPool.id}
            publicSlug={ndPool.public_slug}
            mine={mine}
            viewerEmail={viewerEmail}
            seasonPoints={mine ? seasonTotals[mine.id] ?? 0 : 0}
            appOrigin={appOrigin}
          />
        )}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Link2 className="size-4" /> Join link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {publicUrl ? (
              <>
                <div className="flex items-center gap-1">
                  <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{publicUrl}</code>
                  <Button size="icon" variant="ghost" className="size-8" onClick={async () => { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }} aria-label="Copy">
                    {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8" asChild>
                    <a href={publicUrl} target="_blank" rel="noreferrer" aria-label="Open"><ExternalLink className="size-4" /></a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this with the group. Anyone who opens it can join with their email and gets their own private picks
                  link, one entry per email. Players who lose their link use the same page to get it re-sent.
                </p>
                {isCommissioner && (
                  <NdJoinSettings
                    ndPoolId={ndPool.id}
                    poolStatus={poolStatus}
                    selfJoinEnabled={ndPool.self_join_enabled}
                    allowMidseasonJoin={ndPool.allow_midseason_join}
                  />
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No slug set. Add one to enable player links.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Standings</CardTitle>
          </CardHeader>
          <CardContent>
            {standings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            ) : (
              <ol className="divide-y text-sm">
                {standings.slice(0, 15).map((r) => {
                  const e = byId.get(r.entryId)!
                  return (
                    <li key={r.entryId} className="flex items-center justify-between py-1.5">
                      <span className="flex items-center gap-2">
                        <span className="w-6 tabular-nums text-muted-foreground">{r.tied ? `T${r.rank}` : r.rank}</span>
                        <span className="truncate">{e.display_name ?? e.email.split('@')[0]}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{r.points}</span>
                    </li>
                  )
                })}
              </ol>
            )}
            {standings.length > 15 && (
              <p className="mt-2 text-xs text-muted-foreground">Showing top 15 of {standings.length}.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
