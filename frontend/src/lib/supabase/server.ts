/**
 * @fileoverview Server-side Supabase client factory
 * @module lib/supabase/server
 *
 * @description
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Uses cookie-based session management via @supabase/ssr.
 *
 * @usage
 * ```ts
 * const supabase = await createClient()
 * const { data: { user } } = await supabase.auth.getUser()
 * ```
 *
 * @security
 * - Uses anon key (RLS policies enforced)
 * - Session read from cookies automatically
 * - Cookie writes may fail in Server Components (handled gracefully)
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

/**
 * Create a Supabase client for server-side use
 * Must be called within a request context (Server Component, Route Handler, etc.)
 * @returns Typed Supabase client with Database schema
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
