/**
 * @fileoverview Login page
 * @route /login
 * @auth Public (unauthenticated users only)
 * @layout Auth layout (centered card with BN Pools branding)
 *
 * @description
 * User authentication page with email/password login.
 * Redirects authenticated users to dashboard.
 * Supports redirect parameter for post-login navigation (e.g., join links).
 *
 * @features
 * - Email/password login form
 * - Error handling with user-friendly messages
 * - "Forgot password" link
 * - "Sign up" link for new users
 * - Redirect preservation (for join links, etc.)
 *
 * @components
 * - LoginForm: Client component with form logic and Supabase auth
 */
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'

/**
 * Login page - wraps LoginForm in Suspense for searchParams access
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mt-8 text-center text-gray-500">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
