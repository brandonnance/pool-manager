/**
 * Client-safe formatting helpers for NFL Desperation UI.
 * Game times render in the viewer's local zone; the lock rule is always stated in CT.
 */
import { triangular } from '@/lib/desperation/scoring'

export function fmtKickoff(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function fmtKickoffLong(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

export function fmtLockCT(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' CT'
}

/** "2h 14m", "45m", "0:32" (under a minute), or "" if past */
export function fmtCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return ''
  const s = Math.floor(msRemaining / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`
  return `0:${sec.toString().padStart(2, '0')}`
}

export function pointsLabel(n: number): string {
  const p = triangular(n)
  return `${p} pt${p === 1 ? '' : 's'}`
}

/** Period label for a live game */
export function fmtPeriod(period: number | null, clock: string | null): string {
  if (!period) return ''
  const label = period <= 4 ? `Q${period}` : period === 5 ? 'OT' : `OT${period - 4}`
  return clock ? `${label} ${clock}` : label
}
