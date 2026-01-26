/**
 * Pool Creation Wizard Types
 *
 * Shared types for the multi-step pool creation wizard.
 */

// Sports supported in the wizard
export type Sport = 'nfl' | 'pga'

// Pool types available per sport
export type PoolType = 'playoff_squares' | 'golf'

// Squares-specific modes
export type SquaresMode = 'full_playoff' | 'single_game'
export type ScoringMode = 'quarter' | 'score_change'

// Wizard step numbers
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

// URL search params for wizard state
export interface WizardParams {
  step: string
  orgId?: string
  sport?: Sport
  poolType?: PoolType
  eventId?: string
  mode?: SquaresMode
}

// Organization membership for org selection step
export interface OrgMembership {
  org_id: string
  role: string
  organizations: {
    id: string
    name: string
  }
}

// Event from the events table
export interface UpcomingEvent {
  id: string
  sport: string
  event_type: string
  provider: string
  provider_event_id: string
  name: string
  start_time: string | null
  status: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// NFL Playoff Squares settings
export interface SquaresSettings {
  name: string
  seasonLabel: string
  reverseScoring: boolean
  publicSlug: string
  // Single game mode only
  scoringMode: ScoringMode
  gameName: string
  homeTeam: string
  awayTeam: string
}

// PGA Golf Pool settings
export interface GolfSettings {
  name: string
  seasonLabel: string
  minTierPoints: number
  picksLockAt: string
  publicEntriesEnabled: boolean
}

// Combined settings type
export type PoolSettings = SquaresSettings | GolfSettings

// Step definitions for progress indicator
export interface WizardStepDef {
  number: number
  title: string
  description: string
}

// Default wizard steps (may be filtered based on conditions)
export const WIZARD_STEPS: WizardStepDef[] = [
  { number: 1, title: 'Organization', description: 'Select your organization' },
  { number: 2, title: 'Sport', description: 'Choose a sport' },
  { number: 3, title: 'Pool Type', description: 'Select pool type' },
  { number: 4, title: 'Event', description: 'Pick an event' },
  { number: 5, title: 'Settings', description: 'Configure your pool' },
  { number: 6, title: 'Review', description: 'Review and create' },
]

// Sport to pool type mapping
export const SPORT_POOL_TYPES: Record<Sport, PoolType[]> = {
  nfl: ['playoff_squares'],
  pga: ['golf'],
}

// Pool type display info
export const POOL_TYPE_INFO: Record<PoolType, { name: string; description: string }> = {
  playoff_squares: {
    name: 'Squares',
    description: '10x10 grid betting pool for NFL games',
  },
  golf: {
    name: 'Major Championship Pool',
    description: 'Pick golfers across tiers to compete in a PGA tournament',
  },
}

// Sport display info
export const SPORT_INFO: Record<Sport, { name: string; description: string; icon: string }> = {
  nfl: {
    name: 'NFL',
    description: 'NFL Playoffs',
    icon: '🏈',
  },
  pga: {
    name: 'PGA',
    description: 'PGA Major Championships',
    icon: '⛳',
  },
}

// Default settings
export const DEFAULT_SQUARES_SETTINGS: SquaresSettings = {
  name: '',
  seasonLabel: '',
  reverseScoring: true,
  publicSlug: '',
  scoringMode: 'quarter',
  gameName: '',
  homeTeam: '',
  awayTeam: '',
}

export const DEFAULT_GOLF_SETTINGS: GolfSettings = {
  name: '',
  seasonLabel: '',
  minTierPoints: 100,
  picksLockAt: '',
  publicEntriesEnabled: false,
}

// Helper to generate slug from name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
}

// Helper to validate slug format
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3 && slug.length <= 50
}
