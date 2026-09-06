/**
 * NFL Desperation email templates. Server-only.
 * Matches the look of the golf confirmation email.
 */
import { POOL_TIMEZONE } from './schedule'

export const FROM = 'BN Pools <noreply@pools.brandon-nance.com>'

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://pools.brandon-nance.com'
}

export function entryUrl(slug: string, token: string): string {
  return `${appUrl()}/desperation/${slug}/e/${token}`
}

/** Escape text for safe interpolation into email HTML (body text and attribute values). */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmt(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    timeZone: POOL_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function shell(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    ${inner}
  </div>
  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">BN Pools - pools.brandon-nance.com</p>
</body></html>`
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">${label}</a>`
}

export function inviteEmail(opts: {
  poolName: string
  url: string
  firstKickoffAt?: string | null
  lockAt?: string | null
}): { subject: string; html: string } {
  const { url, firstKickoffAt, lockAt } = opts
  const poolName = esc(opts.poolName)
  const timing = firstKickoffAt && lockAt
    ? `<div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 0 0 24px 0; font-size: 14px; color: #374151;">
        <div style="margin-bottom: 6px;"><strong>First game:</strong> ${fmt(firstKickoffAt)}</div>
        <div><strong>All remaining picks lock:</strong> ${fmt(lockAt)}</div>
      </div>`
    : ''
  return {
    subject: `Your ${poolName} link`,
    html: shell(`
      <h1 style="color: #111827; margin: 0 0 8px 0; font-size: 24px;">${poolName}</h1>
      <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px;">How desperate are you willing to get?</p>
      <p style="color: #374151; font-size: 15px; line-height: 1.5; margin: 0 0 20px 0;">
        This is your personal link for the season. It opens your picks and only your picks — no password needed.
        <strong>Bookmark it.</strong> You'll use it every week.
      </p>
      ${timing}
      ${button(url, 'Make My Picks')}
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">
        Don't share this link. Anyone who has it can see and change your picks.
        If you lose it, go to the pool page and enter your email to get it re-sent.
      </p>
    `),
  }
}

export function resendLinkEmail(opts: { poolName: string; url: string }): { subject: string; html: string } {
  const poolName = esc(opts.poolName)
  return {
    subject: `Your ${opts.poolName} link`,
    html: shell(`
      <h1 style="color: #111827; margin: 0 0 24px 0; font-size: 22px;">Here's your link</h1>
      <p style="color: #374151; font-size: 15px; line-height: 1.5; margin: 0 0 20px 0;">
        Your personal ${poolName} link is below. Bookmark it this time — we won't judge.
      </p>
      ${button(opts.url, 'Open My Picks')}
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0;">
        Didn't ask for this? Someone typed your email on the pool page. Nothing has changed; you can ignore it.
      </p>
    `),
  }
}
