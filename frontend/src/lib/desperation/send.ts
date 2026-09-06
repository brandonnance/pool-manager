/**
 * Outbound email for NFL Desperation. Server-only.
 * Templates live in ./emails; this module does the sending and bookkeeping.
 */
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { FROM, entryUrl, inviteEmail, resendLinkEmail } from './emails'
import { getWeeks } from './server'
import { pickCurrentWeek } from './schedule'

type Admin = SupabaseClient<Database>

export interface InviteTarget {
  id: string
  email: string
  access_token: string
}

/** Email each target their private link and stamp invite_sent_at. Returns how many went out. */
export async function sendInviteEmails(
  admin: Admin,
  poolName: string,
  slug: string,
  seasonYear: number,
  targets: InviteTarget[]
): Promise<number> {
  if (targets.length === 0) return 0
  const resend = new Resend(process.env.RESEND_API_KEY)
  const weeks = await getWeeks(admin, seasonYear)
  const current = pickCurrentWeek(weeks)

  let sent = 0
  for (const t of targets) {
    const { subject, html } = inviteEmail({
      poolName,
      url: entryUrl(slug, t.access_token),
      firstKickoffAt: current?.first_kickoff_at,
      lockAt: current?.lock_at,
    })
    const { error } = await resend.emails.send({ from: FROM, to: t.email, subject, html })
    if (error) {
      console.error('[nd/send] invite error', t.email, error)
      continue
    }
    sent++
    await admin.from('nd_entries').update({ invite_sent_at: new Date().toISOString() }).eq('id', t.id)
  }
  return sent
}

/** Re-send an existing player's link and stamp invite_sent_at. Errors are logged, never thrown. */
export async function sendResendLinkEmail(
  admin: Admin,
  poolName: string,
  slug: string,
  entry: { id: string; email: string; access_token: string }
): Promise<boolean> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { subject, html } = resendLinkEmail({ poolName, url: entryUrl(slug, entry.access_token) })
  const { error } = await resend.emails.send({ from: FROM, to: entry.email, subject, html })
  if (error) {
    console.error('[nd/send] resend-link error', entry.email, error)
    return false
  }
  await admin.from('nd_entries').update({ invite_sent_at: new Date().toISOString() }).eq('id', entry.id)
  return true
}
