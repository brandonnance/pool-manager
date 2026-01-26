/**
 * @fileoverview Admin Supabase client factory
 * @module lib/supabase/admin
 *
 * @description
 * Creates a Supabase client using the service role key for admin operations
 * that need to bypass RLS. ONLY use in trusted server-side contexts.
 *
 * @security
 * - Uses service role key (bypasses RLS)
 * - NEVER expose to client-side code
 * - ALWAYS verify super admin status before using
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

/**
 * Create a Supabase client with service role (admin) privileges
 * Use only for trusted admin operations in server-side code
 * @returns Typed Supabase client with full database access
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
