'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Users, Copy, Check, Send, Loader2, Search, MoreHorizontal, Ban, RotateCcw, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { NdDashboardEntry } from '@/lib/data/desperation'

interface Props {
  ndPoolId: string
  publicSlug: string | null
  entries: NdDashboardEntry[]
  seasonTotals: Record<string, number>
  appOrigin: string
}

type View = 'all' | 'never_opened' | 'disabled'
type EntryStatus = 'disabled' | 'not_sent' | 'never_opened' | 'opened'

/** Where a player stands with their invite. "Opened" means they've loaded their private link at least once. */
function statusOf(e: NdDashboardEntry): EntryStatus {
  if (!e.active) return 'disabled'
  if (e.last_seen_at) return 'opened'
  if (e.invite_sent_at) return 'never_opened'
  return 'not_sent'
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function nameOf(e: NdDashboardEntry): string {
  return e.display_name ?? e.email.split('@')[0]
}

export function NdEntriesCard({ ndPoolId, publicSlug, entries, seasonTotals, appOrigin }: Props) {
  const router = useRouter()
  const [raw, setRaw] = useState('')
  const [sendInvites, setSendInvites] = useState(true)
  const [importing, setImporting] = useState(false)
  const [resending, setResending] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [view, setView] = useState<View>('all')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<NdDashboardEntry[] | null>(null)

  const linkFor = (token: string) => (publicSlug ? `${appOrigin}/desperation/${publicSlug}/e/${token}` : null)

  const parsedCount = useMemo(
    () => new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes('@'))).size,
    [raw]
  )

  const counts = useMemo(() => {
    const c = { active: 0, disabled: 0, neverOpened: 0 }
    for (const e of entries) {
      const s = statusOf(e)
      if (s === 'disabled') c.disabled++
      else {
        c.active++
        if (s === 'never_opened') c.neverOpened++
      }
    }
    return c
  }, [entries])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return entries.filter((e) => {
      const s = statusOf(e)
      if (view === 'never_opened' && s !== 'never_opened') return false
      if (view === 'disabled' && s !== 'disabled') return false
      if (q && !(e.email.includes(q) || (e.display_name ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [entries, filter, view])

  const importEmails = async () => {
    const emails = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    if (emails.length === 0) return
    setImporting(true)
    try {
      const res = await fetch('/api/desperation/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ndPoolId, emails, sendInvites }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      toast.success(`${data.created} added, ${data.skipped} already in pool${sendInvites ? `, ${data.sent} invites sent` : ''}`)
      setRaw('')
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const resend = async (id: string) => {
    setResending(id)
    try {
      const res = await fetch('/api/desperation/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ndPoolId, resendTo: [id] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success(data.sent ? 'Invite sent' : 'Send failed — check logs')
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setResending(null)
    }
  }

  const copy = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error('Copy failed')
    }
  }

  const setActive = async (targets: NdDashboardEntry[], active: boolean) => {
    setBusy(true)
    try {
      const res = await fetch('/api/desperation/entries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ndPoolId, entryIds: targets.map((t) => t.id), active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success(active ? `${data.updated} re-enabled` : `${data.updated} disabled`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (targets: NdDashboardEntry[]) => {
    setBusy(true)
    try {
      const res = await fetch('/api/desperation/entries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ndPoolId, entryIds: targets.map((t) => t.id) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success(`${data.deleted} removed`)
      setPendingDelete(null)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const ViewChip = ({ v, label, n }: { v: View; label: string; n: number }) => (
    <Button
      type="button"
      size="sm"
      variant={view === v ? 'secondary' : 'ghost'}
      className="h-7 px-2 text-xs"
      onClick={() => setView(v)}
    >
      {label} <span className="ml-1 tabular-nums text-muted-foreground">{n}</span>
    </Button>
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" /> Entries
        </CardTitle>
        <div className="flex items-center gap-2">
          {counts.disabled > 0 && <span className="text-xs text-muted-foreground">+{counts.disabled} disabled</span>}
          <Badge variant="secondary">{counts.active}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!publicSlug && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
            Set a pool URL slug before inviting — links are built from it.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="nd-emails" className="text-sm">Add players by email</Label>
          <Textarea
            id="nd-emails"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'one@example.com\ntwo@example.com\nor comma-separated'}
            rows={4}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sendInvites} onCheckedChange={(v) => setSendInvites(v === true)} />
              Send invite emails now
            </label>
            <Button size="sm" onClick={importEmails} disabled={importing || parsedCount === 0 || !publicSlug}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Add {parsedCount > 0 ? parsedCount : ''} {parsedCount === 1 ? 'player' : 'players'}
            </Button>
          </div>
        </div>

        {entries.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-40 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="h-9 pl-8 text-sm" />
              </div>
              <div className="flex items-center gap-1">
                <ViewChip v="all" label="All" n={entries.length} />
                <ViewChip v="never_opened" label="Never opened" n={counts.neverOpened} />
                {counts.disabled > 0 && <ViewChip v="disabled" label="Disabled" n={counts.disabled} />}
              </div>
            </div>

            {view === 'never_opened' && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span>Invited, but never opened their link. Typos and no-shows end up here.</span>
                {filtered.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" disabled={busy} onClick={() => setPendingDelete(filtered)}>
                    <Trash2 className="size-3.5" /> Remove all {filtered.length} shown
                  </Button>
                )}
              </div>
            )}

            <div className="max-h-[28rem] overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/70 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Player</th>
                    <th className="px-3 py-2 text-right font-medium">Pts</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => {
                    const url = linkFor(e.access_token)
                    const status = statusOf(e)
                    return (
                      <tr key={e.id} className={cn('border-t', !e.active && 'text-muted-foreground')}>
                        <td className="px-3 py-1.5">
                          <div className={cn('font-medium', !e.active && 'line-through')}>{nameOf(e)}</div>
                          <div className="text-xs text-muted-foreground">
                            {e.email}
                            {e.joined_week > 1 && <span> · joined Wk {e.joined_week}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{seasonTotals[e.id] ?? 0}</td>
                        <td className="px-3 py-1.5 text-xs">
                          {status === 'opened' && <span className="text-emerald-700">Opened</span>}
                          {status === 'never_opened' && (
                            <span className="text-amber-700">
                              Never opened{e.invite_sent_at && <span className="text-muted-foreground"> · sent {fmtDay(e.invite_sent_at)}</span>}
                            </span>
                          )}
                          {status === 'not_sent' && <span className="text-muted-foreground">Not invited</span>}
                          {status === 'disabled' && <span className="text-muted-foreground">Disabled</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex justify-end gap-1">
                            {url && e.active && (
                              <Button size="icon" variant="ghost" className="size-7" onClick={() => copy(e.id, url)} aria-label="Copy link">
                                {copied === e.id ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                              </Button>
                            )}
                            {e.active && (
                              <Button size="icon" variant="ghost" className="size-7" onClick={() => resend(e.id)} disabled={resending === e.id || !publicSlug} aria-label="Resend invite">
                                {resending === e.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="size-7" aria-label="More" disabled={busy}>
                                  <MoreHorizontal className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {e.active ? (
                                  <DropdownMenuItem onClick={() => setActive([e], false)}>
                                    <Ban className="size-4" /> Disable
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => setActive([e], true)}>
                                    <RotateCcw className="size-4" /> Re-enable
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete([e])}>
                                  <Trash2 className="size-4" /> Remove…
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">Nobody matches.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Disable keeps a player&apos;s history but shuts off their link and hides them from the board. Remove deletes them for good.
            </p>
          </div>
        )}
      </CardContent>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {pendingDelete?.length === 1 ? nameOf(pendingDelete[0]) : `${pendingDelete?.length ?? 0} players`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.length > 1 && pendingDelete.length <= 5 && (
                <span className="block mb-2">{pendingDelete.map(nameOf).join(', ')}</span>
              )}
              Their entries, picks, and points are deleted for good. If they might come back, disable them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(ev) => { ev.preventDefault(); if (pendingDelete) remove(pendingDelete) }}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
