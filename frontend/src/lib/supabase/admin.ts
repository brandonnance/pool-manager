/**
 * @fileoverview Service-role Supabase client factory
 * @module lib/supabase/admin
 *
 * @description
 * Creates a Supabase client that bypasses RLS. Server-only — never import
 * from a client component. Used by route handlers and server components that
 * serve token-authenticated (non-auth-user) participants and must apply
 * visibility rules in code rather than via RLS.
 *
 * @security
 * - Uses SUPABASE_SERVICE_ROLE_KEY. Every caller is responsible for its own
 *   authorization check before reading or writing.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  // Fail with a message that names the variable: the generic supabase-js error
  // ("supabaseKey is required") is easy to misread in production logs.
  if (!url) throw new Error('createAdminClient: NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('createAdminClient: SUPABASE_SERVICE_ROLE_KEY is not set in this environment')
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
