/**
 * @fileoverview Global Events Feature Configuration
 *
 * Reads the global_events_config from site_settings to control
 * the rollout of the new global events system.
 */

import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createClient as createServerClient } from '@/lib/supabase/server'

export interface GlobalEventsConfig {
  /** Master switch - when false, all global events functionality is disabled */
  enabled: boolean
  /** When true, workers poll and update event_state but UI still reads from legacy tables */
  shadow_mode: boolean
}

const DEFAULT_CONFIG: GlobalEventsConfig = {
  enabled: false,
  shadow_mode: false,
}

/**
 * Fetches the global events configuration from site_settings (browser client).
 * Falls back to disabled config if the call fails.
 */
export async function getGlobalEventsConfig(): Promise<GlobalEventsConfig> {
  const supabase = createBrowserClient()

  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'global_events_config')
    .single()

  if (error || !data) {
    console.error('Error fetching global_events_config:', error)
    return DEFAULT_CONFIG
  }

  return data.value as GlobalEventsConfig
}

/**
 * Fetches the global events configuration from site_settings (server client).
 * Falls back to disabled config if the call fails.
 */
export async function getGlobalEventsConfigServer(): Promise<GlobalEventsConfig> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'global_events_config')
    .single()

  if (error || !data) {
    console.error('Error fetching global_events_config:', error)
    return DEFAULT_CONFIG
  }

  return data.value as GlobalEventsConfig
}

/**
 * Checks if global events are fully enabled (not just shadow mode).
 */
export function isGlobalEventsEnabled(config: GlobalEventsConfig): boolean {
  return config.enabled && !config.shadow_mode
}

/**
 * Checks if shadow mode is active (workers run but UI uses legacy).
 */
export function isShadowModeActive(config: GlobalEventsConfig): boolean {
  return config.enabled && config.shadow_mode
}
