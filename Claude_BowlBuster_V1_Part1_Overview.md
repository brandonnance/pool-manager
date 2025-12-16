# BN Pools – Bowl Buster (V1) Build Brief for Claude (Part 1: Product + Architecture)

## Goal
Re-create the currently-running **NCAA Bowl Buster** pool in a modern web app (Supabase-backed) that is clearly better than the commissioner’s Excel workflow:
- clean player pick entry (bowls + CFP bracket UI)
- automatic locks (CFP locks before Round 1; bowls lock 5 minutes before kickoff)
- automatic scoring (margin-of-victory scoring)
- commissioner overrides (audited)
- join links + approvals
- standings that update automatically from live scores

## Scope (V1)
### Included
- Multi-tenant: Orgs, org memberships (user can belong to multiple orgs)
- Pools belong to orgs
- Users can request to join pools via invite link; commissioner approves
- **Bowl picks**: choose winner for each included bowl game
- **CFP bracket picks**: bracket UI (R1 → QF → SF → Final)
- Lock rules:
  - CFP: lock all CFP picks at `cfp_lock_at`
  - Bowls: lock each bowl at `kickoff_at - 5 minutes`
- Scoring rule per game:
  - pick winner → `+margin`
  - pick loser → `-margin`
  - margin = absolute point difference in final score
- Standings page for pool
- Commissioner admin:
  - create pool
  - add/edit included bowl games (may not include every bowl)
  - configure CFP bracket (select template + set Round 1 matchups)
  - approve join requests
  - override picks after lock
  - view audit log
- Automated score ingestion every X minutes (configurable), at least for games that are in this pool.

### Not included (for V1)
- Handling buy-ins/payouts
- Multi-entry per user (can add later)
- Advanced analytics, prop bets, vegas-based scoring, etc.

## Tech
- Frontend: Next.js (or whatever you prefer for Cloudflare Pages) + TypeScript
- Backend: Supabase (Auth + Postgres + RLS + Edge Functions/cron worker as needed)
- Hosting: separate repo deployed to Cloudflare Pages at `pool.brandon-nance.com`

## Pool type modeling (hybrid)
We use:
- **generic shared tables** for orgs, pools, memberships, audit logs
- **type-specific tables** for bowl buster: bowl games, picks, CFP bracket config/picks

## Entities & relationships (high level)
- `organizations` (tenant)
- `profiles` (app user profile)
- `org_memberships` (many-to-many: user ⇄ org; role includes commissioner)
- `pools` (belongs to org; has type = bowl_buster)
- `pool_memberships` (many-to-many: user ⇄ pool; status pending/approved/rejected)
- `join_links` (pool join token that creates pending membership)
- `audit_log` (immutable)

Bowl Buster module:
- `bb_teams` (or global `teams`)
- `bb_games` (real-world game metadata + external IDs + scores/status)
- `bb_pool_games` (which games are included in a specific pool)
- `bb_entries` (one entry per approved pool member)
- `bb_bowl_picks` (entry pick per bowl game)
- `bb_cfp_templates` (slot-based bracket definition per season format)
- `bb_cfp_pool_config` (pool’s chosen template + lock time + round-1 participants)
- `bb_cfp_entry_picks` (winner picks per slot for an entry)

## CFP Bracket UI approach (important)
- CFP is represented as a set of **slots** with dependency wiring (each slot’s participants come from winners of earlier slots).
- Store only **winner pick per slot** (`picked_team_id`).
- Derive later-round participants on the fly from earlier picks + template wiring.
- Scoring compares each slot’s picked winner vs actual winner once slot is tied to a real game and final.

## Locks (exact business rules)
- CFP:
  - `pools.settings.cfp_lock_at` (timestamp)
  - all `bb_cfp_entry_picks` become read-only after this time (except commissioner override)
- Bowls:
  - each included bowl has `kickoff_at` (from `bb_games`)
  - lock time = `kickoff_at - interval '5 minutes'`
  - `bb_bowl_picks` editable until lock time (except commissioner override)

## Scoring (exact)
For a finished game:
- `margin = abs(home_score - away_score)`
- if `picked_team_id == winner_team_id` ⇒ `+margin`
- else ⇒ `-margin`
Pool total score = sum of all scored games (bowls + CFP slots).

## Deliverable (V1 demo)
- A commissioner can run a pool with real users and see:
  - picks submitted and locked properly
  - automatic scoring updates as games finish
  - a standings leaderboard that refreshes
  - an audit trail of overrides
