/**
 * @fileoverview Global Events Module
 *
 * Central export for the global events system.
 */

// Configuration
export {
  getGlobalEventsConfig,
  getGlobalEventsConfigServer,
  isGlobalEventsEnabled,
  isShadowModeActive,
  type GlobalEventsConfig,
} from './config'

// Types
export {
  type Sport,
  type EventType,
  type Provider,
  type EventStatus,
  type Event,
  type EventState,
  type EventStatePayload,
  type TeamGamePayload,
  type GolfTournamentPayload,
  type GolfLeaderboardEntry,
  type EventMilestone,
  type TeamGameMilestoneType,
  type GolfMilestoneType,
  type WorkerLease,
  type GolfTournamentGlobal,
  type GolfFieldEntry,
  POLLING_INTERVALS,
  getPollingInterval,
} from './types'
