'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Pencil, Check, Loader2, RefreshCw, ArrowRight, ArrowLeft } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { BoardPayload, Selection } from '@/lib/desperation/types'
import { LockCountdown } from './lock-countdown'
import { PicksPanel } from './picks-panel'
import { BoardPanel } from './board-panel'
import { StandingsPanel } from './standings-panel'
import { WeekNav } from './week-nav'

interface Props {
  token: string
  poolName: string
  entryName: string
  initial: BoardPayload
  /** Set when the viewer is signed in as a commissioner of this pool: link back to the dashboard. */
  adminHref?: string | null
}

const POLL_LIVE_MS = 30_000
const POLL_IDLE_MS = 120_000

export function PlayerApp({ token, poolName, entryName: initialName, initial, adminHref }: Props) {
  const [board, setBoard] = useState<BoardPayload>(initial)
  const [viewWeek, setViewWeek] = useState<number>(initial.week.week_number)
  const [picks, setPicks] = useState<Record<string, Selection>>(() => initial.entries.find((e) => e.isMe)?.picks ?? {})
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [tab, setTab] = useState<string>('picks')
  const [name, setName] = useState(initialName)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(initialName)
  const [savingName, setSavingName] = useState(false)
  const inflight = useRef<AbortController | null>(null)

  const isCurrentWeek = board.currentWeek === board.week.week_number
  const isNextOpenWeek = board.nextOpenWeek !== null && board.nextOpenWeek === board.week.week_number
  // Picks are editable on the current week, and on the next week once the current one has locked
  const isEditableWeek = isCurrentWeek || isNextOpenWeek
  const isPastWeek = board.currentWeek !== null && board.week.week_number < board.currentWeek

  // Clock tick for lock evaluation
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const fetchBoard = useCallback(async (week: number, opts: { silent?: boolean } = {}) => {
    inflight.current?.abort()
    const ac = new AbortController()
    inflight.current = ac
    if (!opts.silent) setRefreshing(true)
    try {
      const res = await fetch(`/api/desperation/board?token=${encodeURIComponent(token)}&week=${week}`, { signal: ac.signal, cache: 'no-store' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Failed to load')
      const data: BoardPayload = await res.json()
      setBoard(data)
      if (data.week.week_number === data.currentWeek || data.week.week_number === data.nextOpenWeek) {
        setPicks(data.entries.find((e) => e.isMe)?.picks ?? {})
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError' && !opts.silent) toast.error((e as Error).message)
    } finally {
      if (!opts.silent) setRefreshing(false)
    }
  }, [token])

  // Polling: fast when games are live/imminent, slow otherwise, paused when hidden
  useEffect(() => {
    const liveOrSoon = board.games.some((g) => {
      if (g.status === 'in_progress') return true
      if (g.status !== 'scheduled') return false
      const dt = new Date(g.kickoff_at).getTime() - Date.now()
      return dt > -4 * 3600_000 && dt < 10 * 60_000
    })
    const weekDone = board.week.status === 'final'
    if (weekDone) return
    const interval = liveOrSoon ? POLL_LIVE_MS : POLL_IDLE_MS
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchBoard(viewWeek, { silent: true })
    }, interval)
    const onVis = () => { if (document.visibilityState === 'visible') fetchBoard(viewWeek, { silent: true }) }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [board.games, board.week.status, viewWeek, fetchBoard])

  const changeWeek = (w: number) => {
    setViewWeek(w)
    fetchBoard(w)
  }

  const onPick = async (gameId: string, sel: Selection | null) => {
    const prev = picks
    // optimistic
    setPicks((p) => {
      const next = { ...p }
      if (sel === null) delete next[gameId]
      else next[gameId] = sel
      return next
    })
    setSaving((s) => new Set(s).add(gameId))
    try {
      const res = await fetch('/api/desperation/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, gameId, selection: sel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPicks(prev)
        if (data?.locked) {
          toast.error('That game just locked.')
          fetchBoard(viewWeek, { silent: true })
        } else {
          toast.error(data?.error ?? 'Could not save pick')
        }
        return
      }
      setPicks(data.picks ?? {})
    } catch {
      setPicks(prev)
      toast.error('Network error — pick not saved')
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(gameId); return n })
    }
  }

  const saveName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === name) { setEditingName(false); return }
    setSavingName(true)
    try {
      const res = await fetch('/api/desperation/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, displayName: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not save name')
      setName(data.displayName)
      setEditingName(false)
      fetchBoard(viewWeek, { silent: true })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingName(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-4 md:max-w-4xl">
      <header className="mb-4">
        {adminHref && (
          <Link href={adminHref} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Back to pool admin
          </Link>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold leading-tight">{poolName}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {editingName ? (
                <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); saveName() }}>
                  <Input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={40} className="h-7 w-44 text-sm" />
                  <Button type="submit" size="icon" variant="ghost" className="size-7" disabled={savingName} aria-label="Save name">
                    {savingName ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  </Button>
                </form>
              ) : (
                <button type="button" onClick={() => { setNameDraft(name); setEditingName(true) }} className="group inline-flex items-center gap-1 hover:text-foreground">
                  <span className="font-medium text-foreground">{name}</span>
                  <Pencil className="size-3 opacity-50 group-hover:opacity-100" />
                </button>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="secondary" className="text-sm">Week {board.week.week_number}</Badge>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => fetchBoard(viewWeek)} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} /> Refresh
            </Button>
          </div>
        </div>
        <LockCountdown week={board.week} games={board.games} className="mt-3" />
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="picks">Picks</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
        </TabsList>

        <TabsContent value="picks" className="mt-4 space-y-3">
          <WeekNav board={board} viewWeek={viewWeek} onChangeWeek={changeWeek} />
          {isPastWeek && (
            <p className="text-sm text-muted-foreground">Week {board.week.week_number} is over. These picks are read-only.</p>
          )}
          {isCurrentWeek && board.nextOpenWeek !== null && (
            <button
              type="button"
              onClick={() => changeWeek(board.nextOpenWeek!)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 text-left text-sm hover:bg-primary/10"
            >
              <span>
                <span className="font-medium">Week {board.week.week_number} is locked.</span>{' '}
                <span className="text-muted-foreground">Week {board.nextOpenWeek} is open for picks.</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-primary" />
            </button>
          )}
          {isNextOpenWeek && (
            <p className="text-sm text-muted-foreground">
              Week {board.week.week_number} is open early. Week {board.currentWeek} is still being played on the Board tab.
            </p>
          )}
          <PicksPanel
            week={board.week}
            games={board.games}
            picks={isEditableWeek ? picks : (board.entries.find((e) => e.isMe)?.picks ?? {})}
            saving={saving}
            now={now}
            onPick={onPick}
          />
        </TabsContent>

        <TabsContent value="board" className="mt-4">
          <BoardPanel board={board} viewWeek={viewWeek} now={now} onChangeWeek={changeWeek} />
        </TabsContent>

        <TabsContent value="standings" className="mt-4">
          <StandingsPanel board={board} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
