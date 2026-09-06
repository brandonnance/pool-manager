/**
 * NFL Desperation — CLI schedule sync (operator fallback).
 *
 * Imports/refreshes nd_weeks + nd_games for a season from ESPN using the
 * same mapping code as the app. The dashboard "Load schedule" button is the
 * normal path; use this when you need to run it from a terminal.
 *
 * Usage (from frontend/):
 *   npx tsx scripts/nd-sync-schedule.ts [seasonYear] [week ...]
 *   npx tsx scripts/nd-sync-schedule.ts 2026            # all 18 weeks
 *   npx tsx scripts/nd-sync-schedule.ts 2026 1 2        # weeks 1–2 only
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { mapEspnEvent, computeWeekLockAt, REGULAR_SEASON_WEEKS } from '../src/lib/desperation/schedule'
import { fetchEspnWeek } from '../src/lib/desperation/espn'

function loadEnv() {
  const txt = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

async function main() {
  loadEnv()
  const [, , yearArg, ...weekArgs] = process.argv
  const seasonYear = Number(yearArg ?? new Date().getFullYear())
  const weeks = weekArgs.length ? weekArgs.map(Number) : Array.from({ length: REGULAR_SEASON_WEEKS }, (_, i) => i + 1)

  const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  for (const week of weeks) {
    const board = await fetchEspnWeek(seasonYear, week)
    const mapped = (board.events ?? []).map((e) => mapEspnEvent(e, seasonYear, week)).filter((g): g is NonNullable<typeof g> => !!g)
    if (mapped.length === 0) {
      console.log(`week ${week}: no games from ESPN`)
      continue
    }
    const kickoffs = mapped.map((g) => g.kickoff_at)
    const lockAt = computeWeekLockAt(kickoffs)
    const first = kickoffs.reduce((a, b) => (a < b ? a : b))
    const last = kickoffs.reduce((a, b) => (a > b ? a : b))

    const { error: wErr } = await admin.from('nd_weeks').upsert(
      { season_year: seasonYear, week_number: week, lock_at: lockAt.toISOString(), first_kickoff_at: first, last_kickoff_at: last },
      { onConflict: 'season_year,week_number' }
    )
    if (wErr) throw new Error(`week ${week} nd_weeks: ${wErr.message}`)

    const now = new Date().toISOString()
    const { error: gErr } = await admin
      .from('nd_games')
      .upsert(mapped.map((g) => ({ ...g, last_synced_at: now })), { onConflict: 'season_year,espn_game_id' })
    if (gErr) throw new Error(`week ${week} nd_games: ${gErr.message}`)

    console.log(`week ${String(week).padStart(2)}: ${mapped.length} games, lock ${lockAt.toISOString()}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
