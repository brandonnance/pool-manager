import { createClient } from '@/lib/supabase/client'

export interface PoolTypes {
  bowl_buster: boolean
  playoff_squares: boolean
}

export interface NflPlayoffGame {
  name: string
  round: string
  display_order: number
}

/**
 * Fetches enabled pool types from site_settings via RPC.
 * Falls back to all enabled if the call fails.
 */
export async function getEnabledPoolTypes(): Promise<PoolTypes> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('get_enabled_pool_types')

  if (error || !data) {
    console.error('Error fetching pool types:', error)
    // Default to all enabled
    return { bowl_buster: true, playoff_squares: true }
  }

  return data as unknown as PoolTypes
}

/**
 * Fetches NFL playoff games template from site_settings.
 * Falls back to a default template if the call fails.
 */
export async function getNflPlayoffGamesTemplate(): Promise<NflPlayoffGame[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'nfl_playoff_games')
    .single()

  if (error || !data) {
    console.error('Error fetching NFL games template:', error)
    // Return default template
    return getDefaultNflPlayoffGames()
  }

  return data.value as unknown as NflPlayoffGame[]
}

/**
 * Default NFL playoff games template as fallback.
 */
function getDefaultNflPlayoffGames(): NflPlayoffGame[] {
  return [
    { name: 'Wild Card 1', round: 'wild_card', display_order: 1 },
    { name: 'Wild Card 2', round: 'wild_card', display_order: 2 },
    { name: 'Wild Card 3', round: 'wild_card', display_order: 3 },
    { name: 'Wild Card 4', round: 'wild_card', display_order: 4 },
    { name: 'Wild Card 5', round: 'wild_card', display_order: 5 },
    { name: 'Wild Card 6', round: 'wild_card', display_order: 6 },
    { name: 'Divisional 1', round: 'divisional', display_order: 7 },
    { name: 'Divisional 2', round: 'divisional', display_order: 8 },
    { name: 'Divisional 3', round: 'divisional', display_order: 9 },
    { name: 'Divisional 4', round: 'divisional', display_order: 10 },
    { name: 'AFC Championship', round: 'conference', display_order: 11 },
    { name: 'NFC Championship', round: 'conference', display_order: 12 },
    { name: 'Super Bowl', round: 'super_bowl', display_order: 13 },
  ]
}
