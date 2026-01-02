'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface UpdateProfileFormProps {
  currentDisplayName: string
}

export function UpdateProfileForm({ currentDisplayName }: UpdateProfileFormProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(currentDisplayName)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!displayName.trim()) {
      setError('Display name cannot be empty')
      return
    }

    setLoading(true)

    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in to update your profile')
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>Your display name has been updated.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your name"
          className="max-w-md"
        />
      </div>

      <Button type="submit" disabled={loading || displayName === currentDisplayName}>
        {loading ? 'Saving...' : 'Save changes'}
      </Button>
    </form>
  )
}
