import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Create admin client for server-side operations
function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { entryId, poolId, email, participantName, editToken, editTokenExpiresAt } = await request.json()

    if (!entryId || !poolId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get pool info
    const { data: pool } = await supabase
      .from('pools')
      .select('name')
      .eq('id', poolId)
      .single()

    // Get entry info
    const { data: entry } = await supabase
      .from('gp_entries')
      .select('entry_name')
      .eq('id', entryId)
      .single()

    // Get picks with golfer names
    const { data: picks } = await supabase
      .from('gp_entry_picks')
      .select(`
        golfer_id,
        gp_golfers!inner(name)
      `)
      .eq('entry_id', entryId)

    // Get gp_pool to find tournament
    const { data: gpPool } = await supabase
      .from('gp_pools')
      .select('id, tournament_id, public_slug')
      .eq('pool_id', poolId)
      .single()

    // Get tournament name
    let tournamentName = 'Golf Tournament'
    if (gpPool?.tournament_id) {
      const { data: tournament } = await supabase
        .from('gp_tournaments')
        .select('name')
        .eq('id', gpPool.tournament_id)
        .single()
      if (tournament) {
        tournamentName = tournament.name
      }
    }

    // Get tier assignments for picked golfers
    const golferIds = picks?.map(p => p.golfer_id) || []
    const { data: tierAssignments } = golferIds.length > 0 && gpPool?.id
      ? await supabase
          .from('gp_tier_assignments')
          .select('golfer_id, tier_value')
          .eq('pool_id', gpPool.id)
          .in('golfer_id', golferIds)
      : { data: [] }

    const tierMap = new Map(
      (tierAssignments ?? []).map(t => [t.golfer_id, t.tier_value])
    )

    // Format golfer list with tiers, sorted by tier
    const golferList = (picks ?? [])
      .map(p => {
        const golfer = p.gp_golfers as unknown as { name: string }
        const tier = tierMap.get(p.golfer_id) ?? 5
        return {
          name: golfer?.name || 'Unknown',
          tier,
        }
      })
      .sort((a, b) => a.tier - b.tier)

    // Build the entry URL using public slug
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pools.brandon-nance.com'
    const entryUrl = gpPool?.public_slug
      ? `${baseUrl}/pools/golf/${gpPool.public_slug}`
      : `${baseUrl}/pools/${poolId}/golf/picks`

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: 'BN Pools <noreply@pools.brandon-nance.com>',
      to: email,
      subject: `Entry Confirmed: ${pool?.name || 'Golf Pool'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="color: #111827; margin: 0 0 8px 0; font-size: 24px;">Entry Confirmed!</h1>
            <p style="color: #6b7280; margin: 0 0 24px 0; font-size: 14px;">${tournamentName}</p>

            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h2 style="color: #374151; margin: 0 0 4px 0; font-size: 18px;">${pool?.name || 'Golf Pool'}</h2>
              <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">${entry?.entry_name || 'Your Entry'}</p>
              ${participantName ? `<p style="color: #9ca3af; margin: 0; font-size: 12px;">Submitted by: ${participantName}</p>` : ''}
            </div>

            <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 16px;">Your Picks:</h3>
            <ul style="margin: 0 0 24px 0; padding-left: 20px; list-style: none;">
              ${golferList.map(g => `<li style="color: #4b5563; padding: 4px 0;"><span style="display: inline-block; background-color: #e5e7eb; color: #374151; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-right: 8px;">T${g.tier}</span>${g.name}</li>`).join('')}
            </ul>

            <a href="${entryUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
              View Leaderboard
            </a>

            <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
              Bookmark this link! Once the tournament starts, you can track your entry on the live leaderboard.
            </p>
          </div>

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
            BN Pools - pools.brandon-nance.com
          </p>
        </body>
        </html>
      `,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email confirmation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
