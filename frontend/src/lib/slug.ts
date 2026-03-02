import { createClient } from '@/lib/supabase/client'

/** Format raw input into a valid slug (lowercase alphanumeric + hyphens) */
export function formatSlugInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '')
}

/** Validate a slug string. Returns an error message or null if valid. */
export function validateSlugFormat(slug: string): string | null {
  if (!slug) return 'Please enter a valid slug'
  if (slug.length < 3) return 'Slug must be at least 3 characters'
  if (slug.length > 50) return 'Slug must be 50 characters or less'
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Slug can only contain lowercase letters, numbers, and hyphens'
  return null
}

/** Generate a slug from a display name */
export function generateSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

/** Check if a slug is available in the given table */
export async function checkSlugAvailability(
  slug: string,
  table: 'sq_pools' | 'mm_pools' | 'gp_pools',
  currentSlug?: string
): Promise<boolean | null> {
  if (!slug || slug.length < 3) return null
  if (slug === currentSlug) return true

  const supabase = createClient()
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('public_slug', slug)
    .maybeSingle()

  if (error) return null
  return data === null
}

/** URL prefix map for each pool type's public pages */
const PUBLIC_URL_PREFIXES: Record<string, string> = {
  sq_pools: '/view/',
  mm_pools: '/view/mm/',
  gp_pools: '/pools/golf/',
}

/** Build the full public URL for a slug */
export function getPublicUrl(slug: string, table: 'sq_pools' | 'mm_pools' | 'gp_pools'): string {
  const prefix = PUBLIC_URL_PREFIXES[table]
  return `${typeof window !== 'undefined' ? window.location.origin : ''}${prefix}${slug}`
}
