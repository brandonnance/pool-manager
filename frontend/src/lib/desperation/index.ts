/**
 * NFL Desperation utilities — pure functions, unit-testable without React.
 */
export type * from './types'
export {
  triangular,
  deriveWinner,
  gameQualifies,
  isTerminal,
  isVoided,
  scoreWeek,
  entryWeekState,
  summarizeWeekScore,
  sumSeasonPoints,
  rankByPoints,
  type StandingRow,
  type WeekScoreSummary,
} from './scoring'
export {
  gameLockAt,
  canEditPick,
  isPickVisibleToOthers,
  isCountVisibleToOthers,
  isWeekLocked,
} from './visibility'
export {
  POOL_TIMEZONE,
  REGULAR_SEASON_WEEKS,
  zonedParts,
  zonedTimeToUtc,
  computeWeekLockAt,
  pickCurrentWeek,
  nextOpenWeek,
  maxPickableWeek,
  joinWeekFor,
  mapEspnStatus,
  mapEspnEvent,
  type MappedGame,
  type EspnEvent,
  type EspnScoreboard,
} from './schedule'
