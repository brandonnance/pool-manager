/**
 * @fileoverview Provider exports for Global Events
 */

export {
  fetchESPNScoreboard,
  fetchESPNGame,
  fetchAllESPNGames,
  normalizeESPNEvent,
  toTeamGamePayload,
  type ESPNGameData,
} from './espn'

export {
  SlashGolfWorkerClient,
  normalizeLeaderboard,
  getGolfEventStatus,
  fetchGolfTournamentState,
  fetchUpcomingTournaments,
  fetchTournamentField,
  type GolfTournamentInfo,
  type GolfFieldPlayer,
} from './slashgolf'
