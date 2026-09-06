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
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
