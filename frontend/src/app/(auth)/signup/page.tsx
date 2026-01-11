/**
 * @fileoverview Signup page
 * @route /signup
 * @auth Public (unauthenticated users only)
 * @layout Auth layout (centered card with BN Pools branding)
 *
 * @description
 * New user registration page with email/password signup.
 * Creates a Supabase auth user and corresponding profile.
 * Redirects authenticated users to dashboard.
 *
 * @features
 * - Email/password registration form
 * - Display name input
 * - Password confirmation
 * - Error handling with validation messages
 * - "Already have an account?" link to login
 * - Redirect preservation (for join links, etc.)
 *
 * @components
 * - SignupForm: Client component with form logic and Supabase auth
 */
import { Suspense } from 'react'
import { SignupForm } from '@/components/auth/signup-form'

/**
 * Signup page - wraps SignupForm in Suspense for searchParams access
 */
export default function SignupPage() {
  return (
    <Suspense fallback={<div className="mt-8 text-center text-gray-500">Loading...</div>}>
      <SignupForm />
    </Suspense>
  )
}
