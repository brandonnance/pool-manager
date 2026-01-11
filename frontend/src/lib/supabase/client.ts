/**
 * @fileoverview Browser-side Supabase client factory
 * @module lib/supabase/client
 *
 * @description
 * Creates a Supabase client for use in Client Components ('use client').
 * Uses browser storage for session persistence via @supabase/ssr.
 *
 * @usage
 * ```ts
 * const supabase = createClient()
 * const { data, error } = await supabase.from('pools').select('*')
 * ```
 *
 * @security
 * - Uses anon key (RLS policies enforced)
 * - Session stored in browser cookies/localStorage
 * - Safe to call multiple times (returns new client instance)
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

/**
 * Create a Supabase client for browser-side use
 * Call this in Client Components or event handlers
 * @returns Typed Supabase client with Database schema
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
