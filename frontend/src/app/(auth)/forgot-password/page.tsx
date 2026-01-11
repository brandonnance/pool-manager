/**
 * @fileoverview Forgot password page
 * @route /forgot-password
 * @auth Public
 * @layout Auth layout (centered card with BN Pools branding)
 *
 * @description
 * Password recovery initiation page. Sends a password reset email
 * via Supabase Auth with a magic link that redirects to /reset-password.
 *
 * @features
 * - Email input for password reset request
 * - Supabase resetPasswordForEmail API call
 * - Success state with confirmation message
 * - Error handling for invalid emails
 * - Back to login link
 *
 * @flow
 * 1. User enters email and submits
 * 2. Supabase sends reset email with link to /auth/callback?next=/reset-password
 * 3. User clicks link, gets authenticated session
 * 4. Redirected to /reset-password to set new password
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Forgot password page - Client Component
 * Handles password reset email request via Supabase Auth.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="mt-8 space-y-6">
        <Alert>
          <AlertDescription>
            Check your email for a password reset link. It may take a few minutes to arrive.
          </AlertDescription>
        </Alert>
        <div className="text-center text-sm">
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <p className="text-sm text-muted-foreground text-center">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Sending...' : 'Send reset link'}
      </Button>

      <div className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:text-primary/80">
          Back to login
        </Link>
      </div>
    </form>
  )
}
