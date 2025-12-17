import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JoinPoolAction } from './join-action'

interface PageProps {
  params: Promise<{ token: string }>
}

interface ValidateResult {
  valid: boolean
  error?: string
  pool_id?: string
  pool_name?: string
  org_name?: string
}

export default async function JoinPage({ params }: PageProps) {
  const { token } = await params
  const supabase = await createClient()

  // Validate the token
  const { data, error } = await supabase.rpc('validate_join_link', { p_token: token })

  const result = data as ValidateResult | null

  if (error || !result || !result.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">
            {result?.error || 'This invite link is not valid.'}
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // User is logged in - show join action
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-blue-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Pool</h1>
          <p className="text-gray-600 mb-2">
            You&apos;ve been invited to join:
          </p>
          <p className="text-xl font-semibold text-gray-900 mb-1">{result.pool_name}</p>
          <p className="text-sm text-gray-500 mb-6">{result.org_name}</p>

          <JoinPoolAction token={token} poolId={result.pool_id!} />
        </div>
      </div>
    )
  }

  // User is not logged in - show login/signup options
  const callbackUrl = `/join/${token}`

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-4">
          <svg className="w-16 h-16 text-blue-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Join Pool</h1>
        <p className="text-gray-600 mb-2">
          You&apos;ve been invited to join:
        </p>
        <p className="text-xl font-semibold text-gray-900 mb-1">{result.pool_name}</p>
        <p className="text-sm text-gray-500 mb-6">{result.org_name}</p>

        <p className="text-gray-600 mb-4">
          Sign in or create an account to join this pool.
        </p>

        <div className="space-y-3">
          <Link
            href={`/login?next=${encodeURIComponent(callbackUrl)}`}
            className="block w-full px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Sign In
          </Link>
          <Link
            href={`/signup?next=${encodeURIComponent(callbackUrl)}`}
            className="block w-full px-6 py-3 text-sm font-medium text-blue-600 bg-white border border-blue-600 hover:bg-blue-50 rounded-md"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  )
}
