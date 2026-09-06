'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserRound, ArrowRight, Copy, Check, Loader2, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { NdDashboardEntry } from '@/lib/data/desperation'

interface Props {
  ndPoolId: string
  publicSlug: string | null
  /** The signed-in commissioner's entry in this pool, matched by email; null if they haven't joined */
  mine: NdDashboardEntry | null
  viewerEmail: string | null
  seasonPoints: number
  appOrigin: string
}

/**
 * Commissioner's own entry. The commissioner plays like everyone else — through a
 * private player link — so this card is just the shortcut: create the entry if
 * missing, otherwise open / copy the link.
 */
export function NdMyEntryCard({ ndPoolId, publicSlug, mine, viewerEmail, seasonPoints, appOrigin }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = mine && publicSlug ? `${appOrigin}/desperation/${publicSlug}/e/${mine.access_token}` : null

  const addMe = async () => {
    setAdding(true)
    try {
      const res = await fetch('/api/desperation/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ndPoolId, self: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not add your entry')
      toast.success('You are in. Open your picks below.')
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><UserRound className="size-4" /> My Entry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mine ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{mine.display_name ?? mine.email.split('@')[0]}</div>
                <div className="truncate text-xs text-muted-foreground">{mine.email}</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold tabular-nums leading-none">{seasonPoints}</div>
                <div className="text-xs text-muted-foreground">season pts</div>
              </div>
            </div>
            {url ? (
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <a href={url}><ArrowRight className="size-4" /> Open my picks</a>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy my link"
                  onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                >
                  {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Set a pool slug to enable your player link.</p>
            )}
            <p className="text-xs text-muted-foreground">
              You make and change picks on your player page, same as everyone else. It has a &ldquo;Back to pool admin&rdquo; link at the top while you&apos;re signed in. Save the link on your phone.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              You&apos;re not in the pool as a player yet.
              {viewerEmail && <> This will add <span className="font-medium text-foreground">{viewerEmail}</span> and give you a private picks link.</>}
            </p>
            <Button onClick={addMe} disabled={adding || !viewerEmail} className="w-full">
              {adding ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Add me as a player
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
