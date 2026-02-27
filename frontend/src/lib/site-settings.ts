import { createClient } from '@/lib/supabase/client'

export interface PoolTypes {
  bowl_buster: boolean
  squares: boolean
  golf: boolean
  march_madness: boolean
}

export interface SquaresGameTemplate {
  name: string
  round: string
  display_order: number
}

/** @deprecated Use SquaresGameTemplate instead */
export type NflPlayoffGame = SquaresGameTemplate

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
    return { bowl_buster: true, squares: true, golf: true, march_madness: true }
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
function getDefaultNflPlayoffGames(): SquaresGameTemplate[] {
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

/**
 * Returns the game template for a given squares event type.
 */
export function getGamesTemplateForEventType(eventType: string): SquaresGameTemplate[] {
  switch (eventType) {
    case 'march_madness':
      return getDefaultMmTournamentGames()
    case 'nfl_playoffs':
    default:
      return getDefaultNflPlayoffGames()
  }
}

/**
 * Default March Madness tournament games template (63 games).
 * R64: 32, R32: 16, S16: 8, E8: 4, F4: 2, Final: 1
 */
function getDefaultMmTournamentGames(): SquaresGameTemplate[] {
  const games: SquaresGameTemplate[] = []
  let order = 1

  // Round of 64 — 32 games
  for (let i = 1; i <= 32; i++) {
    games.push({ name: `R64 Game ${i}`, round: 'mm_r64', display_order: order++ })
  }

  // Round of 32 — 16 games
  for (let i = 1; i <= 16; i++) {
    games.push({ name: `R32 Game ${i}`, round: 'mm_r32', display_order: order++ })
  }

  // Sweet 16 — 8 games
  for (let i = 1; i <= 8; i++) {
    games.push({ name: `Sweet 16 Game ${i}`, round: 'mm_s16', display_order: order++ })
  }

  // Elite 8 — 4 games
  for (let i = 1; i <= 4; i++) {
    games.push({ name: `Elite 8 Game ${i}`, round: 'mm_e8', display_order: order++ })
  }

  // Final Four — 2 games
  games.push({ name: 'Final Four 1', round: 'mm_f4', display_order: order++ })
  games.push({ name: 'Final Four 2', round: 'mm_f4', display_order: order++ })

  // Championship
  games.push({ name: 'Championship', round: 'mm_final', display_order: order++ })

  return games
}
