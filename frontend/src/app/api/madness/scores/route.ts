/**
 * @fileoverview March Madness Score Entry API Route
 * @route POST /api/madness/scores
 * @auth Requires commissioner role or super admin
 *
 * @description
 * Handles score entry for March Madness tournament games. Updates game scores
 * and status. When a game is marked as final, the DB trigger
 * `mm_process_game_result()` automatically handles all downstream effects:
 * spread cover calculation, entry elimination, team transfer, and next-round
 * game population.
 *
 * @request_body
 * - gameId: string - The mm_games.id to update
 * - higherSeedScore: number (optional) - Score for the higher seed
 * - lowerSeedScore: number (optional) - Score for the lower seed
 * - status: string (optional) - Game status (e.g., 'final')
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkSuperAdmin, checkOrgAdmin, checkPoolCommissioner } from '@/lib/permissions'

/**
 * POST handler for updating March Madness game scores
 *
 * @param request - Next.js request object containing game score data
 * @returns JSON response with success/error status and update details
 *
 * @flow
 * 1. Validate request (gameId required)
 * 2. Authenticate user
 * 3. Fetch game with pool info for permission check
 * 4. Verify user is commissioner (pool, org, or super admin)
 * 5. Build update object from provided scores/status
 * 6. Update the game record (trigger handles elimination, advancement, next round)
 */
export async function POST(request: NextRequest) {
  try {
    const {
      gameId,
      higherSeedScore,
      lowerSeedScore,
      status,
    } = await request.json()

    if (!gameId) {
      return NextResponse.json(
        { error: 'Missing gameId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get game with pool info (only need pool_id and org_id for permission check)
    const { data: game, error: gameError } = await supabase
      .from('mm_games')
      .select(`
        id,
        mm_pools!inner(
          pool_id,
          pools!inner(org_id)
        )
      `)
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      )
    }

    // Verify user is commissioner
    const [{ data: profile }, { data: orgMembership }, { data: poolMembership }] = await Promise.all([
      supabase.from('profiles').select('is_super_admin').eq('id', user.id).single(),
      supabase.from('org_memberships').select('role').eq('org_id', game.mm_pools.pools.org_id).eq('user_id', user.id).single(),
      supabase.from('pool_memberships').select('role').eq('pool_id', game.mm_pools.pool_id).eq('user_id', user.id).single(),
    ])

    const isSuperAdmin = checkSuperAdmin(profile)
    const isOrgAdmin = checkOrgAdmin(orgMembership, isSuperAdmin)
    const isPoolCommissioner = checkPoolCommissioner(poolMembership, isOrgAdmin)

    if (!isPoolCommissioner) {
      return NextResponse.json(
        { error: 'Only commissioners can enter scores' },
        { status: 403 }
      )
    }

    // Build update object — only scores and status.
    // The DB trigger mm_process_game_result() handles all downstream effects
    // when status changes to 'final': spread cover, elimination, team transfer,
    // and next-round game population.
    const updates: Record<string, unknown> = {}

    if (higherSeedScore !== undefined) {
      updates.higher_seed_score = higherSeedScore
    }
    if (lowerSeedScore !== undefined) {
      updates.lower_seed_score = lowerSeedScore
    }
    if (status) {
      updates.status = status
    }

    // Update game — trigger fires on status='final' and handles everything else
    const { error: updateError } = await supabase
      .from('mm_games')
      .update(updates)
      .eq('id', gameId)

    if (updateError) {
      console.error('Error updating game:', updateError)
      return NextResponse.json(
        { error: 'Failed to update game' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Score updated successfully',
      updates,
    })
  } catch (error) {
    console.error('Score update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
