/**
 * @fileoverview Pool Creation Wizard Page
 * @route /create-pool
 * @auth Requires authentication
 * @layout Dashboard layout with header/nav
 *
 * @description
 * Multi-step wizard for creating new pools. Supports NFL Playoff Squares
 * and PGA Major Championship pool types with global event linking for
 * auto-scoring.
 *
 * @url_params
 * - step: Current step number
 * - orgId: Pre-selected organization (when coming from org page)
 * - sport: Selected sport (nfl/pga)
 * - poolType: Selected pool type (playoff_squares/golf)
 * - mode: Squares mode (full_playoff/single_game)
 * - eventId: Selected global event
 *
 * @features
 * - Smart org selection (skipped if user has only one org)
 * - Sport and pool type selection
 * - Event picker with upcoming events from global events table
 * - Type-specific pool settings
 * - Review and create with global events integration
 */
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WizardContainer } from '@/components/pool-wizard/wizard-container'

export default async function CreatePoolPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's org memberships (only orgs where they can create pools - admin role)
  const { data: orgMemberships } = await supabase
    .from('org_memberships')
    .select(`
      org_id,
      role,
      organizations (
        id,
        name
      )
    `)
    .eq('user_id', user.id)
    .eq('role', 'admin') // Only admins can create pools

  // If user has no orgs where they can create pools, redirect to dashboard
  if (!orgMemberships || orgMemberships.length === 0) {
    redirect('/dashboard')
  }

  // Get preselected org from URL if provided
  const params = await searchParams
  const preselectedOrgId = typeof params.orgId === 'string' ? params.orgId : undefined

  // Validate preselected org is one of user's admin orgs
  const validPreselectedOrgId = preselectedOrgId && orgMemberships.some(m => m.org_id === preselectedOrgId)
    ? preselectedOrgId
    : undefined

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Create Pool</h1>
        <p className="text-muted-foreground">
          Set up a new pool for your organization
        </p>
      </div>

      <Suspense fallback={<WizardSkeleton />}>
        <WizardContainer
          userOrgMemberships={orgMemberships.map(m => ({
            org_id: m.org_id,
            role: m.role,
            organizations: m.organizations as { id: string; name: string },
          }))}
          preselectedOrgId={validPreselectedOrgId}
        />
      </Suspense>
    </div>
  )
}

function WizardSkeleton() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg border p-6 space-y-6">
        {/* Progress skeleton */}
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
              {i < 5 && <div className="flex-1 h-1 mx-2 bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="space-y-4 pt-8">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="h-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
