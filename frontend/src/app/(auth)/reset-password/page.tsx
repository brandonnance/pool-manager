/**
 * @fileoverview Reset password page
 * @route /reset-password
 * @auth Requires valid password reset session (from email link)
 * @layout Auth layout (centered card with BN Pools branding)
 *
 * @description
 * Password update page accessed via email reset link.
 * User must have a valid session from clicking the password reset email.
 * Updates password via Supabase Auth updateUser API.
 *
 * @features
 * - New password input with confirmation
 * - Password validation (min 6 chars, match check)
 * - Supabase updateUser API call
 * - Redirect to dashboard on success with message
 * - Error handling for invalid sessions or weak passwords
 *
 * @flow
 * 1. User arrives from /auth/callback after clicking reset email
 * 2. User enters and confirms new password
 * 3. Supabase updates the password
 * 4. User redirected to /dashboard?message=password-updated
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Reset password page - Client Component
 * Handles password update after user clicks reset link from email.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Redirect to dashboard with success message
    router.push('/dashboard?message=password-updated')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Enter your new password below.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Updating...' : 'Update password'}
      </Button>

      <div className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:text-primary/80">
          Back to login
        </Link>
      </div>
    </form>
  )
}
