import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClientLib } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  findBestReplacement,
  getAffectedEntries,
  replacePick,
  ensureEditToken,
  type AffectedEntry,
  type Golfer,
} from '@/lib/golf/withdrawal'

function createAdminClient() {
  return createAdminClientLib<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { poolId, golferId } = await request.json()

    if (!poolId || !golferId) {
      return NextResponse.json({ error: 'Missing poolId or golferId' }, { status: 400 })
    }

    // Verify user is commissioner
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check pool membership
    const { data: pool } = await supabase
      .from('pools')
      .select('id, name, org_id')
      .eq('id', poolId)
      .single()

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 })
    }

    const { data: poolMembership } = await supabase
      .from('pool_memberships')
      .select('role')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .single()

    const { data: orgMembership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', pool.org_id)
      .eq('user_id', user.id)
      .single()

    const isCommissioner = poolMembership?.role === 'commissioner' || orgMembership?.role === 'admin'

    if (!isCommissioner) {
      return NextResponse.json({ error: 'Must be commissioner' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Get golf pool config
    const { data: gpPool } = await adminClient
      .from('gp_pools')
      .select('id, tournament_id, picks_lock_at, public_slug')
      .eq('pool_id', poolId)
      .single()

    if (!gpPool || !gpPool.tournament_id) {
      return NextResponse.json({ error: 'Golf pool not configured' }, { status: 400 })
    }

    // Get golfer info
    const { data: golfer } = await adminClient
      .from('gp_golfers')
      .select('id, name, country, owgr_rank')
      .eq('id', golferId)
      .single()

    if (!golfer) {
      return NextResponse.json({ error: 'Golfer not found' }, { status: 404 })
    }

    // Mark golfer as withdrawn in tournament field
    const { error: updateError } = await adminClient
      .from('gp_tournament_field')
      .update({ status: 'withdrawn' })
      .eq('tournament_id', gpPool.tournament_id)
      .eq('golfer_id', golferId)

    if (updateError) {
      console.error('Failed to update tournament field:', updateError)
      return NextResponse.json({ error: 'Failed to mark golfer as withdrawn' }, { status: 500 })
    }

    // Get the tier for this golfer
    const { data: tierAssignment } = await adminClient
      .from('gp_tier_assignments')
      .select('tier_value')
      .eq('pool_id', gpPool.id)
      .eq('golfer_id', golferId)
      .single()

    const tier = tierAssignment?.tier_value ?? 5

    // Get all affected entries
    const affectedEntries = await getAffectedEntries(adminClient, gpPool.id, poolId, golferId)

    if (affectedEntries.length === 0) {
      return NextResponse.json({
        success: true,
        message: `${golfer.name} marked as withdrawn. No entries affected.`,
        affectedCount: 0,
        replacements: [],
      })
    }

    // Get tournament name for emails
    const { data: tournament } = await adminClient
      .from('gp_tournaments')
      .select('name')
      .eq('id', gpPool.tournament_id)
      .single()

    const results: AffectedEntry[] = []

    // Process each affected entry
    for (const entry of affectedEntries) {
      // Find best replacement (excluding all golfers already on this entry)
      const replacement = await findBestReplacement(
        adminClient,
        gpPool.id,
        gpPool.tournament_id,
        tier,
        entry.golferIds // Excludes all golfers on this entry including withdrawn one
      )

      if (replacement) {
        // Replace the pick
        const replaceResult = await replacePick(adminClient, entry.entryId, golferId, replacement.id)

        if (!replaceResult.success) {
          console.error(`Failed to replace pick for entry ${entry.entryId}:`, replaceResult.error)
          continue
        }

        // Ensure edit token exists for this entry
        const editToken = await ensureEditToken(adminClient, entry.entryId, gpPool.picks_lock_at)

        results.push({
          entryId: entry.entryId,
          entryName: entry.entryName,
          participantName: entry.participantName,
          participantEmail: entry.participantEmail,
          userId: entry.userId,
          withdrawnGolfer: golfer as Golfer,
          replacementGolfer: replacement,
          tier,
          editToken,
        })

        // Send notification email
        const emailTo = entry.participantEmail
        if (emailTo) {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pools.brandon-nance.com'
          const leaderboardUrl = gpPool.public_slug
            ? `${baseUrl}/pools/golf/${gpPool.public_slug}`
            : `${baseUrl}/pools/${poolId}/golf`

          try {
            await resend.emails.send({
              from: 'BN Pools <noreply@pools.brandon-nance.com>',
              to: emailTo,
              subject: `[${pool.name}] Golfer Withdrawal - Entry Updated`,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
                  <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                      <h1 style="color: #92400e; margin: 0 0 8px 0; font-size: 20px;">Golfer Withdrawal Notice</h1>
                      <p style="color: #a16207; margin: 0; font-size: 14px;">${tournament?.name || 'Golf Tournament'}</p>
                    </div>

                    <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                      <strong>${golfer.name}</strong> has withdrawn from the tournament.
                    </p>

                    <p style="color: #374151; font-size: 15px; line-height: 1.6;">
                      Your entry <strong>"${entry.entryName}"</strong> has been automatically updated:
                    </p>

                    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
                      <div style="display: flex; align-items: center; margin-bottom: 12px;">
                        <span style="display: inline-block; background-color: #ef4444; color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-right: 12px;">REMOVED</span>
                        <span style="color: #6b7280; text-decoration: line-through;">${golfer.name}</span>
                      </div>
                      <div style="display: flex; align-items: center;">
                        <span style="display: inline-block; background-color: #22c55e; color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-right: 12px;">ADDED</span>
                        <span style="color: #374151; font-weight: 500;">${replacement.name}</span>
                        <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">(Tier ${tier})</span>
                      </div>
                    </div>

                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                      The replacement was automatically selected as the best available golfer in the same tier (by OWGR ranking). If you'd prefer a different golfer, please contact the pool commissioner.
                    </p>

                    <a href="${leaderboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 500; font-size: 14px; margin-top: 16px;">
                      View Leaderboard
                    </a>
                  </div>

                  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
                    BN Pools - pools.brandon-nance.com
                  </p>
                </body>
                </html>
              `,
            })
          } catch (emailErr) {
            console.error(`Failed to send email to ${emailTo}:`, emailErr)
          }
        }
      } else {
        // No replacement available
        results.push({
          entryId: entry.entryId,
          entryName: entry.entryName,
          participantName: entry.participantName,
          participantEmail: entry.participantEmail,
          userId: entry.userId,
          withdrawnGolfer: golfer as Golfer,
          replacementGolfer: null,
          tier,
          editToken: null,
        })
      }
    }

    const successCount = results.filter(r => r.replacementGolfer !== null).length
    const failedCount = results.filter(r => r.replacementGolfer === null).length

    return NextResponse.json({
      success: true,
      message: `${golfer.name} marked as withdrawn. ${successCount} entries updated${failedCount > 0 ? `, ${failedCount} entries need manual review (no replacement available)` : ''}.`,
      affectedCount: results.length,
      replacements: results.map(r => ({
        entryName: r.entryName,
        participantName: r.participantName,
        replacement: r.replacementGolfer?.name ?? 'No replacement available',
        tier: r.tier,
      })),
    })
  } catch (error) {
    console.error('Process withdrawal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
