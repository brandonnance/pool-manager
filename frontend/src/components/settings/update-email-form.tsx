'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface UpdateEmailFormProps {
  currentEmail: string
}

export function UpdateEmailForm({ currentEmail }: UpdateEmailFormProps) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!email.trim()) {
      setError('Email cannot be empty')
      return
    }

    if (email === currentEmail) {
      setError('New email must be different from your current email')
      return
    }

    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` }
    )

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setEmail('')
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
          <AlertDescription>
            A confirmation email has been sent to your new email address. Please check your inbox and click the link to confirm the change.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentEmail">Current email</Label>
        <Input
          id="currentEmail"
          type="email"
          value={currentEmail}
          disabled
          className="max-w-md bg-muted"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newEmail">New email address</Label>
        <Input
          id="newEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="newemail@example.com"
          className="max-w-md"
        />
      </div>

      <Button type="submit" disabled={loading || !email.trim()}>
        {loading ? 'Sending...' : 'Update email'}
      </Button>
    </form>
  )
}
