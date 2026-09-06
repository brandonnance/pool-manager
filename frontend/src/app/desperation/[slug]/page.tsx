/**
 * @fileoverview NFL Desperation public landing page
 * @route /desperation/[slug]
 * @auth Public
 *
 * @description
 * The one link the commissioner shares. When joining is open, anyone can enter
 * an email (one entry per email) and receive their private picks link. The same
 * form re-sends the link to players already in the pool. Nothing about the
 * pool's entries or picks is shown here.
 */
import { notFound } from 'next/navigation'
import { Flame } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getJoinState } from '@/lib/desperation/server'
import { joinClosedMessage } from '@/lib/desperation/join'
import { fmtLockCT } from '@/components/desperation/format'
import { JoinForm } from '@/components/desperation/join-form'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function DesperationLandingPage({ params }: PageProps) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: ndPool } = await admin.from('nd_pools').select('*').eq('public_slug', slug).maybeSingle()
  if (!ndPool) notFound()

  const { data: pool } = await admin.from('pools').select('name, status').eq('id', ndPool.pool_id).single()
  if (!pool) notFound()

  const join = await getJoinState(admin, ndPool, pool.status)
  const startWeek = join.open && join.joinWeek ? join.weeks.find((w) => w.week_number === join.joinWeek) ?? null : null

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <Flame className="size-6" />
        </div>
        <h1 className="text-2xl font-bold">{pool.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">How desperate are you willing to get?</p>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        {join.open ? (
          <>
            <h2 className="font-semibold">Join the pool</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a private link for your picks. Already in? Use the same email and
              we&apos;ll re-send yours.
            </p>
            <JoinForm slug={slug} mode="join" />
            {startWeek && (
              <div className="mt-4 space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <div>
                  You&apos;d start with <span className="font-medium text-foreground">Week {startWeek.week_number}</span>.
                </div>
                {startWeek.first_kickoff_at && <div>First game: {fmtLockCT(startWeek.first_kickoff_at)}</div>}
                <div>All picks lock: {fmtLockCT(startWeek.lock_at)}</div>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="font-semibold">Lost your link?</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              Your picks live at a private link that was emailed to you. Enter your email and we&apos;ll send it again.
            </p>
            <JoinForm slug={slug} mode="resend" />
          </>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {join.open ? 'One entry per person. Your link is private — don’t share it.' : joinClosedMessage(join.reason)}
      </p>
    </main>
  )
}
