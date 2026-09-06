/**
 * ESPN NFL scoreboard fetcher (server-only usage).
 * Same hidden endpoint the squares pool uses; regular season = seasontype=2.
 */
import type { EspnScoreboard } from './schedule'

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

export function espnScoreboardUrl(seasonYear: number, week: number): string {
  return `${BASE}?seasontype=2&week=${week}&dates=${seasonYear}`
}

/** Give up on ESPN after this long so a slow upstream can't hang a page render. */
const ESPN_TIMEOUT_MS = 8_000

export async function fetchEspnWeek(seasonYear: number, week: number): Promise<EspnScoreboard> {
  const res = await fetch(espnScoreboardUrl(seasonYear, week), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(ESPN_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} ${res.statusText} for ${seasonYear} week ${week}`)
  }
  return (await res.json()) as EspnScoreboard
}
