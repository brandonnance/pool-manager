'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SuperAdminJoinOrgButtonProps {
  orgId: string
  orgName: string
}

export function SuperAdminJoinOrgButton({ orgId, orgName }: SuperAdminJoinOrgButtonProps) {
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

    // Insert as admin
    const { error: insertError } = await supabase
      .from('org_memberships')
      .insert({
        org_id: orgId,
        user_id: user.id,
        role: 'admin'
      })

    if (insertError) {
      setError(insertError.message)
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
