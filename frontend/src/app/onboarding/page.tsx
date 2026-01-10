/**
 * @fileoverview Onboarding Wizard Page
 * @route /onboarding
 * @auth Requires authentication (redirects to login if not)
 * @layout Standalone (no dashboard layout)
 *
 * @description
 * Four-step wizard for new users to set up their first organization and pool.
 * Guides users through creating an org, pool, adding games, and generating
 * an invite link. State is maintained via URL search params.
 *
 * @steps
 * 1. Organization: Create a new organization (user becomes admin)
 * 2. Pool: Create first pool (Bowl Buster or Squares)
 * 3. Games: Add bowl games (skipped for Squares)
 * 4. Invite: Generate and copy invite link
 *
 * @url_params
 * - step: Current step number (1-4)
 * - orgId: Created org ID (from step 1)
 * - poolId: Created pool ID (from step 2)
 * - poolType: Selected pool type
 *
 * @features
 * - Visual progress indicator
 * - Pool type selection (Bowl Buster, Squares)
 * - Auto-generates invite link with 7-day expiry
 * - Skip to dashboard option
 * - Squares pools skip the games step
 */
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Available pool types during onboarding */
type PoolType = 'bowl_buster' | 'playoff_squares'

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

const STEPS = [
  { number: 1, title: 'Organization', description: 'Name your group' },
  { number: 2, title: 'Pool', description: 'Create your first pool' },
  { number: 3, title: 'Games', description: 'Add bowl games' },
  { number: 4, title: 'Invite', description: 'Share with friends' },
]

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentStep = parseInt(searchParams.get('step') || '1')
  const orgId = searchParams.get('orgId') || ''
  const poolId = searchParams.get('poolId') || ''
  const poolType = (searchParams.get('poolType') || 'bowl_buster') as PoolType

  // Step 1: Org state
  const [orgName, setOrgName] = useState('')

  // Step 2: Pool state
  const [poolName, setPoolName] = useState('')
  const [selectedPoolType, setSelectedPoolType] = useState<PoolType>('bowl_buster')

  // Step 4: Invite state
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  // Shared state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate invite link when reaching step 4
  useEffect(() => {
    if (currentStep === 4 && poolId && !inviteLink) {
      generateInviteLink()
    }
  }, [currentStep, poolId])

  const generateInviteLink = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const token = generateToken()

    // Create a join link
    const { error: linkError } = await supabase
      .from('join_links')
      .insert({
        pool_id: poolId,
        token,
        created_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })

    if (!linkError) {
      const baseUrl = window.location.origin
      setInviteLink(`${baseUrl}/join/${token}`)
    }
  }

  const updateStep = (step: number, params: Record<string, string> = {}) => {
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.set('step', step.toString())
    Object.entries(params).forEach(([key, value]) => {
      newParams.set(key, value)
    })
    router.push(`/onboarding?${newParams.toString()}`)
  }

  // Step 1: Create Organization
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    // Create org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName })
      .select()
      .single()

    if (orgError) {
      setError(orgError.message)
      setIsLoading(false)
      return
    }

    // Add creator as admin
    const { error: memberError } = await supabase
      .from('org_memberships')
      .insert({
        org_id: org.id,
        user_id: user.id,
        role: 'admin'
      })

    if (memberError) {
      setError(memberError.message)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    updateStep(2, { orgId: org.id })
  }

  // Step 2: Create Pool
  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    // Create pool
    const { data: pool, error: poolError } = await supabase
      .from('pools')
      .insert({
        name: poolName,
        org_id: orgId,
        type: selectedPoolType,
        status: 'draft',
        created_by: user.id
      })
      .select()
      .single()

    if (poolError) {
      setError(poolError.message)
      setIsLoading(false)
      return
    }

    // For Playoff Squares, create sq_pool
    if (selectedPoolType === 'playoff_squares') {
      const { error: sqError } = await supabase
        .from('sq_pools')
        .insert({
          pool_id: pool.id,
          reverse_scoring: true,
          mode: 'full_playoff',
        })

      if (sqError) {
        setError(sqError.message)
        setIsLoading(false)
        return
      }
    }

    setIsLoading(false)

    // Skip games step for playoff_squares
    if (selectedPoolType === 'playoff_squares') {
      updateStep(4, { poolId: pool.id, poolType: selectedPoolType })
    } else {
      updateStep(3, { poolId: pool.id, poolType: selectedPoolType })
    }
  }

  // Step 3: Skip games (go to invite)
  const handleSkipGames = () => {
    updateStep(4)
  }

  // Step 3: Go to games page
  const handleAddGames = () => {
    router.push(`/pools/${poolId}/games?onboarding=true`)
  }

  // Step 4: Copy invite link
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Step 4: Finish onboarding
  const handleFinish = () => {
    router.push(`/pools/${poolId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      step.number < currentStep
                        ? 'bg-green-500 text-white'
                        : step.number === currentStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step.number < currentStep ? '✓' : step.number}
                  </div>
                  <span className="mt-2 text-xs text-gray-600 hidden sm:block">{step.title}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-full h-1 mx-2 ${
                      step.number < currentStep ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                    style={{ width: '60px' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card>
          {/* Step 1: Organization */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle>Create Your Organization</CardTitle>
                <CardDescription>
                  An organization groups your pools together. You can invite members and create multiple pools.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateOrg}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="orgName">Organization Name</Label>
                      <Input
                        id="orgName"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g., Family Pool Group, Office Football Pool"
                        required
                        autoFocus
                      />
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button type="submit" className="w-full" disabled={isLoading || !orgName.trim()}>
                      {isLoading ? 'Creating...' : 'Continue'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}

          {/* Step 2: Pool */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle>Create Your First Pool</CardTitle>
                <CardDescription>
                  Choose a pool type and give it a name.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreatePool}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Pool Type</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPoolType('bowl_buster')}
                          className={`p-4 rounded-lg border text-left transition-all ${
                            selectedPoolType === 'bowl_buster'
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium">Bowl Buster</div>
                          <div className="text-sm text-gray-500 mt-1">Pick bowl game winners</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPoolType('playoff_squares')}
                          className={`p-4 rounded-lg border text-left transition-all ${
                            selectedPoolType === 'playoff_squares'
                              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium">Squares</div>
                          <div className="text-sm text-gray-500 mt-1">10x10 squares grid</div>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="poolName">Pool Name</Label>
                      <Input
                        id="poolName"
                        value={poolName}
                        onChange={(e) => setPoolName(e.target.value)}
                        placeholder={selectedPoolType === 'bowl_buster' ? 'Bowl Pool 2024' : 'Super Bowl Squares 2025'}
                        required
                      />
                    </div>

                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <Button type="submit" className="w-full" disabled={isLoading || !poolName.trim()}>
                      {isLoading ? 'Creating...' : 'Continue'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}

          {/* Step 3: Add Games (Bowl Buster only) */}
          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle>Add Bowl Games</CardTitle>
                <CardDescription>
                  Add the bowl games you want in your pool. You can always add more later.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      You can add games now or skip this step and add them later from the pool management page.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={handleSkipGames}>
                      Skip for Now
                    </Button>
                    <Button className="flex-1" onClick={handleAddGames}>
                      Add Games
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 4: Invite */}
          {currentStep === 4 && (
            <>
              <CardHeader>
                <CardTitle>Invite Friends</CardTitle>
                <CardDescription>
                  Share this link with people you want to join your pool.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inviteLink ? (
                    <>
                      <div className="space-y-2">
                        <Label>Invite Link</Label>
                        <div className="flex gap-2">
                          <Input
                            value={inviteLink}
                            readOnly
                            className="font-mono text-sm"
                          />
                          <Button onClick={handleCopyLink} variant="outline">
                            {copied ? 'Copied!' : 'Copy'}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          This link expires in 7 days. You can create more links later.
                        </p>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-800 font-medium">
                          You're all set!
                        </p>
                        <p className="text-sm text-green-700 mt-1">
                          Your pool is ready. Share the invite link and start adding games.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      Generating invite link...
                    </div>
                  )}

                  <Button className="w-full" onClick={handleFinish}>
                    Go to My Pool
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Skip link */}
        {currentStep < 4 && (
          <div className="text-center mt-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip setup and go to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}
