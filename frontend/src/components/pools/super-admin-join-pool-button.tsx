'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SuperAdminJoinPoolButtonProps {
  poolId: string
  orgId: string
  hasOrgMembership: boolean
}

export function SuperAdminJoinPoolButton({ poolId, orgId, hasOrgMembership }: SuperAdminJoinPoolButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleJoin = async () => {
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setIsLoading(false)
      return
    }

    // If not already an org member, add as admin
    if (!hasOrgMembership) {
      const { error: orgError } = await supabase
        .from('org_memberships')
        .insert({
          org_id: orgId,
          user_id: user.id,
          role: 'admin'
        })

      if (orgError) {
        setError(`Failed to join org: ${orgError.message}`)
        setIsLoading(false)
        return
      }
    }

    // Add as pool commissioner (approved status)
    const { error: poolError } = await supabase
      .from('pool_memberships')
      .insert({
        pool_id: poolId,
        user_id: user.id,
        role: 'commissioner',
        status: 'approved'
      })

    if (poolError) {
      setError(`Failed to join pool: ${poolError.message}`)
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleJoin}
        disabled={isLoading}
        variant="default"
        size="sm"
      >
        {isLoading ? 'Joining...' : 'Join as Super Admin'}
      </Button>
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
