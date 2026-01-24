# Pool Platform Upgrade Plan (Global Events + Shared Scoring)

## Current Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Schema + Feature Flags | ✅ COMPLETE | All migrations applied, types regenerated |
| Phase 2: Worker Infrastructure | ✅ COMPLETE | Edge Functions deployed, golf polling live |
| Phase 3: Shadow Mode | ✅ COMPLETE | Legacy sync working, 0 mismatches verified |
| Phase 4: Shadow Comparison | 🔲 NOT STARTED | Optional logging/alerting |
| Phase 5: Controlled Cutover | 🔲 NOT STARTED | Switch UI to read from event_state |
| Pool Creation Wizard | 🔲 NOT STARTED | Can be done in parallel |

**Last Updated:** January 2025 (The American Express tournament successfully polling)

---

## Purpose

This document captures the agreed-upon architecture and rollout plan for upgrading the pool platform to support:
- Shared, global event data (games & tournaments)
- A single backend worker per event (no browser required)
- Smart event discovery (auto ESPN ID, auto golf field import)
- Org-isolated pools with shared scoring inputs
- Zero disruption to the existing live NFL squares pool

This is the central planning and execution reference for continued development.

---

## Current Stack (Baseline)

- **Frontend:** Next.js
- **Deploy:** Vercel
- **Database/Auth:** Supabase (Postgres + RLS)
- **Domain/DNS:** Cloudflare → Vercel
- **Live scoring (today):** Browser-driven polling by commissioner

Constraints:
- ~~Dev and prod currently share the same Supabase tables~~ **Resolved:** Separate dev Supabase project configured
- There is an active live NFL squares pool that must not break

---

## High-Level Goals

1. Eliminate browser-dependent live scoring
2. Ensure only ONE upstream poll per event, regardless of pool count
3. Preserve strict org-level data isolation for pools
4. Allow global sharing of *event facts* (scores, status)
5. Support multiple sports:
   - NFL
   - NCAA Football
   - NCAA Basketball
   - PGA (via SlashGolf API)
6. Roll out safely without impacting existing live pools

---

## Core Design Principle

**Separate "Global Event Facts" from "Org-Specific Pool Logic."**

- Events (games/tournaments) are global and shared
- Pools reference events but apply their own rules
- One worker updates event state
- Pools derive scoring from shared state

---

## Key Decisions (Resolved)

1. **Worker hosting**: Supabase Edge Functions (included in plan, no extra cost)

2. **Backfill strategy**: Yes - create event records for existing ESPN-linked sq_games

3. **Scoring strategy**: Option A - Compute on Read (MVP)

4. **event_state payload schema** - Team sports structure:
   ```json
   {
     "home_score": 21, "away_score": 14,
     "home_team": "Chiefs", "away_team": "Bills",
     "period": 3, "clock": "8:42",
     "quarter_scores": { "q1": {"home": 7, "away": 7} }
   }
   ```

---

## Phase 1: Schema + Feature Flags ✅ COMPLETE

### Database Migrations (Additive Only)

**Status:** All migrations applied to production via Supabase MCP.

```sql
-- 1. events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL CHECK (sport IN ('nfl', 'ncaa_fb', 'ncaa_bb', 'pga')),
  event_type TEXT NOT NULL CHECK (event_type IN ('team_game', 'golf_tournament')),
  provider TEXT NOT NULL CHECK (provider IN ('espn', 'slashgolf', 'manual')),
  provider_event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'final', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sport, provider, provider_event_id)
);

-- 2. event_state table
CREATE TABLE event_state (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  payload JSONB NOT NULL,
  last_provider_update_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. event_milestones table
CREATE TABLE event_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. worker_leases table
CREATE TABLE worker_leases (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  leased_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_poll_at TIMESTAMPTZ
);

-- 5. golf_tournaments table (new global version)
CREATE TABLE golf_tournaments_global (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  field_status TEXT DEFAULT 'unknown' CHECK (field_status IN ('unknown', 'pending', 'set', 'locked')),
  field_last_checked_at TIMESTAMPTZ,
  field_imported_at TIMESTAMPTZ
);

-- 6. golf_field table
CREATE TABLE golf_field (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  golfer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, golfer_id)
);

-- 7. Feature flags + nullable event_id on existing tables
INSERT INTO site_settings (key, value) VALUES
('global_events_config', '{"enabled": false, "shadow_mode": false}'::jsonb);

ALTER TABLE sq_games ADD COLUMN event_id UUID REFERENCES events(id);
ALTER TABLE sq_pools ADD COLUMN scoring_source TEXT DEFAULT 'legacy' CHECK (scoring_source IN ('legacy', 'global'));

-- 8. Backfill: Create event records for existing ESPN-linked games
INSERT INTO events (sport, event_type, provider, provider_event_id, name, start_time, status)
SELECT
  'nfl',
  'team_game',
  'espn',
  sg.espn_game_id,
  sg.game_name,
  sg.kickoff_at,
  sg.status
FROM sq_games sg
WHERE sg.espn_game_id IS NOT NULL
ON CONFLICT (sport, provider, provider_event_id) DO NOTHING;

-- Link sq_games to their new event records
UPDATE sq_games sg
SET event_id = e.id
FROM events e
WHERE e.provider = 'espn'
  AND e.provider_event_id = sg.espn_game_id
  AND sg.espn_game_id IS NOT NULL;
```

### RLS Policies for Global Tables

```sql
-- Events readable by all authenticated users
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select" ON events FOR SELECT TO authenticated USING (true);

ALTER TABLE event_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_state_select" ON event_state FOR SELECT TO authenticated USING (true);

-- Writes via service role only (worker uses service key)
-- No INSERT/UPDATE policies = only service role can write
```

### Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/lib/global-events/config.ts` | Feature flag reader from site_settings |
| `frontend/src/lib/global-events/types.ts` | Event/EventState TypeScript types |
| `frontend/src/app/api/events/resolve/route.ts` | Find or create event by provider ID |
| `frontend/src/app/api/events/[id]/state/route.ts` | Get current event state |

---

## Phase 2: Worker Infrastructure ✅ COMPLETE

### Worker Hosting: Supabase Edge Functions

Using Edge Functions (included in Supabase plan) for:
- More granular scheduling (every 10-15 seconds during live games)
- Direct database access without HTTP overhead
- No additional hosting cost

### Files Created

| File | Purpose | Status |
|------|---------|--------|
| `supabase/functions/worker-tick/index.ts` | Scheduled function - finds events needing polls | ✅ Deployed |
| `supabase/functions/poll-event/index.ts` | Poll single event, update event_state | ✅ Deployed |
| `supabase/functions/_shared/supabase-client.ts` | Shared service client creation | ✅ Created |
| `supabase/functions/_shared/types.ts` | Shared types and polling logic | ✅ Created |
| `supabase/functions/_shared/providers/espn.ts` | ESPN API normalization | ✅ Created |
| `supabase/functions/_shared/providers/slashgolf.ts` | SlashGolf API normalization | ✅ Created |
| `supabase/functions/_shared/legacy-sync.ts` | Sync event_state to legacy tables | ✅ Created |
| `frontend/src/lib/global-events/config.ts` | Feature flag reader from site_settings | ✅ Created |
| `frontend/src/lib/global-events/types.ts` | Event/EventState TypeScript types | ✅ Created |

### Implementation Notes

- **pg_cron scheduling**: Configured via Supabase Dashboard SQL Editor
  ```sql
  SELECT cron.schedule('worker-tick', '* * * * *', $$
    SELECT net.http_post(
      url := 'https://kszdeybgqfnmblgtpuki.supabase.co/functions/v1/worker-tick',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$);
  ```
- **RapidAPI Key**: Set in Supabase Edge Function secrets (`RAPIDAPI_KEY`)
- **Advisory locks**: Use `pg_try_advisory_lock` / `pg_advisory_unlock` RPC functions
- **worker-tick has its own internal pollEvent**: Does NOT call poll-event HTTP endpoint

### Edge Function Scheduling

Configure via Supabase Dashboard or CLI:
```bash
supabase functions deploy worker-tick --schedule "*/1 * * * *"  # Every minute
```

For live games, the tick function spawns poll-event calls at higher frequency.

### Polling Intervals

| Event State | Interval |
|-------------|----------|
| Pre-game (>1 hour) | 15 min |
| Pre-game (<1 hour) | 5 min |
| In-progress | 15 sec |
| Halftime/slow | 30 sec |
| Final | Stop polling |

### Concurrency Control: PostgreSQL Advisory Locks

```sql
-- Acquire lock before polling
SELECT pg_try_advisory_lock(hashtext('event:' || event_id::text))

-- Release after poll completes
SELECT pg_advisory_unlock(hashtext('event:' || event_id::text))
```

---

## Phase 3: Shadow Mode ✅ COMPLETE

- Worker polls ESPN/SlashGolf and writes to `event_state`
- Legacy browser polling continues writing to `sq_games`
- Both systems run in parallel with no behavior change
- **NEW:** Worker also syncs to legacy `gp_golfer_results` table for golf pools

### Legacy Sync Implementation

The `legacy-sync.ts` module syncs golf tournament data from `event_state` to `gp_golfer_results`:

**Key ID Mappings:**
- `events.provider_event_id` → `gp_tournaments.external_tournament_id`
- `event_state.payload.leaderboard[].player_id` → `gp_golfers.external_player_id`
- `gp_golfers.id` → `gp_golfer_results.golfer_id`

**Important:** `gp_golfer_results` has no `updated_at` trigger - must set explicitly in upserts.

### Validation Queries

```sql
-- Compare legacy vs new for golf
SELECT
  gr.position as legacy_pos,
  (es.payload->'leaderboard'->0->>'position') as global_pos,
  gr.to_par as legacy_to_par,
  ((es.payload->'leaderboard'->0->>'to_par')::int) as global_to_par,
  gr.total_score as legacy_total,
  gr.updated_at
FROM gp_golfer_results gr
JOIN gp_tournaments t ON t.id = gr.tournament_id
JOIN events e ON e.provider_event_id = t.external_tournament_id AND e.provider = 'slashgolf'
JOIN event_state es ON es.event_id = e.id
ORDER BY gr.updated_at DESC
LIMIT 10;

-- Count mismatches (should be 0)
SELECT COUNT(*) as mismatches
FROM gp_golfer_results gr
JOIN gp_golfers g ON g.id = gr.golfer_id
JOIN gp_tournaments t ON t.id = gr.tournament_id
JOIN events e ON e.provider_event_id = t.external_tournament_id
JOIN event_state es ON es.event_id = e.id
CROSS JOIN LATERAL (
  SELECT elem->>'player_id' as player_id,
         elem->>'to_par' as to_par,
         elem->>'position' as position
  FROM jsonb_array_elements(es.payload->'leaderboard') elem
  WHERE elem->>'player_id' = g.external_player_id
) lb
WHERE gr.to_par != (lb.to_par)::int
   OR gr.position != lb.position;

-- Result: 0 mismatches ✅
```

### Feature Flag Status

```sql
-- Current setting in production
SELECT value FROM site_settings WHERE key = 'global_events_config';
-- Returns: {"enabled": true, "shadow_mode": true}
```

---

## Phase 4: Shadow Comparison 🔲 OPTIONAL

**Status:** Not started. May be skipped since Phase 3 validation showed 0 mismatches.

- Add logging for discrepancies between legacy and global scores
- Alert if mismatch rate > 1%
- Fix any normalization bugs before cutover

**Note:** This phase is optional since the Phase 3 validation query confirmed 0 mismatches between global event_state and legacy gp_golfer_results. Skip to Phase 5 if confident.

---

## Phase 5: Controlled Cutover 🔲 NOT STARTED

1. Test on a demo/new pool first
2. Switch `scoring_source = 'global'` per-pool
3. UI reads from `event_state` instead of `sq_games`
4. Legacy polling can be disabled per-pool

```sql
-- Cutover a single pool
UPDATE sq_pools SET scoring_source = 'global' WHERE pool_id = 'specific-pool-uuid';
```

### Rollback

```sql
-- Revert to legacy scoring
UPDATE sq_pools SET scoring_source = 'legacy' WHERE pool_id = 'specific-pool-uuid';
```

---

## Smart Event Resolution

### Team Sports (ESPN)

When a commissioner creates a pool:
1. User selects league + teams + optional date/week
2. Backend calls `/api/events/resolve` to find or create event
3. If found → auto-link to existing event
4. If not found → query ESPN once, create new event + event_state

Result: Subsequent orgs auto-reuse the same event record.

### Golf (SlashGolf)

Worker behavior:
- Poll for upcoming tournaments
- Detect when field is set (field_status transitions)
- Import field into `golf_field` table
- Mark tournament as selectable

Pool creation UI:
- Only tournaments that:
  - have not started
  - have field imported

Each pool defines its own golfer tiers (existing gp_tier_assignments pattern).

---

## Pool Creation Wizard 🔲 NOT STARTED

Replace the current modal-based pool creation with a step-by-step wizard that integrates with global events.

**Note:** This can be developed in parallel with Phase 5 since it's independent UI work.

### Entry Points

- Dashboard "Create Pool" button → launches wizard (user selects org first)
- Org page "Create Pool" button → launches wizard (org pre-selected)

### Wizard Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Select Sport                                            │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │   NFL   │ │  NCAA   │ │  NCAA   │ │   PGA   │ │  Other  │    │
│ │ 🏈      │ │Football │ │  BBall  │ │  ⛳     │ │  (future)│    │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Select Pool Type (filtered by sport + admin settings)   │
│                                                                 │
│ NFL selected → Shows:                                           │
│   • Playoff Squares                                             │
│                                                                 │
│ PGA selected → Shows:                                           │
│   • Major Championship Pool (best 4 of 6)                       │
│                                                                 │
│ NCAA Football → Shows:                                          │
│   • Bowl Buster                                                 │
│   • (future: single game squares)                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Select Event (Smart Suggestions)                        │
│                                                                 │
│ "Which game is this pool for?"                                  │
│                                                                 │
│ Suggested Events:        [Search: _______________]              │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ ⚡ Chiefs vs Bills - AFC Championship                    │    │
│ │    Jan 26, 2025 @ 3:00 PM  •  Already tracked           │    │
│ └─────────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │    Eagles vs Commanders - NFC Championship              │    │
│ │    Jan 26, 2025 @ 6:30 PM  •  Already tracked           │    │
│ └─────────────────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ + Create custom event (manual scoring)                  │    │
│ └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│ Note: Events from ESPN are auto-tracked. You can also create   │
│ a manual event if your game isn't listed.                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Pool Settings (varies by pool type)                     │
│                                                                 │
│ For Squares:                                                    │
│   • Pool name                                                   │
│   • Scoring mode (quarter/score_change/every_score)             │
│   • Payout structure                                            │
│   • Public access settings                                      │
│                                                                 │
│ For Golf:                                                       │
│   • Pool name                                                   │
│   • Tier point minimum                                          │
│   • Picks lock time                                             │
│   • Public entries toggle                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Review & Create                                         │
│                                                                 │
│ Summary of selections, confirm and create pool                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sport → Pool Type Mapping

| Sport | Available Pool Types |
|-------|---------------------|
| NFL | Playoff Squares |
| NCAA Football | Bowl Buster |
| NCAA Basketball | March Madness Blind Draw |
| PGA | Major Championship Pool |

Pool types are further filtered by `site_settings.enabled_pool_types`.

### Event Picker Behavior

1. **Fetch upcoming events** from `events` table filtered by sport
2. **Show "Already tracked"** badge for events that have `event_state` records
3. **Search/filter** by team name, event name, or date
4. **Prevent duplicates**: If user tries to create a manual event that matches an existing `(sport, provider, provider_event_id)`, show error
5. **"Create custom"** option for events not in ESPN/SlashGolf (e.g., local tournaments)

### Event Discovery API

```typescript
// GET /api/events/upcoming?sport=nfl&limit=10
// Returns events for the sport, sorted by start_time

interface UpcomingEventsResponse {
  events: Array<{
    id: string
    name: string
    start_time: string
    status: 'scheduled' | 'in_progress' | 'final'
    provider: 'espn' | 'slashgolf' | 'manual'
    has_state: boolean  // true if event_state exists
    metadata: {
      home_team?: string
      away_team?: string
      // etc.
    }
  }>
}
```

### Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/app/(dashboard)/create-pool/page.tsx` | Wizard container page |
| `frontend/src/components/pool-wizard/sport-step.tsx` | Step 1: Sport selection |
| `frontend/src/components/pool-wizard/pool-type-step.tsx` | Step 2: Pool type selection |
| `frontend/src/components/pool-wizard/event-step.tsx` | Step 3: Event picker with smart suggestions |
| `frontend/src/components/pool-wizard/settings-step.tsx` | Step 4: Pool-type-specific settings |
| `frontend/src/components/pool-wizard/review-step.tsx` | Step 5: Review and create |
| `frontend/src/app/api/events/upcoming/route.ts` | API for event discovery |

### Scoring Isolation

Each pool applies its own scoring rules to the shared `event_state`:

```
Global event_state (shared):
{
  "home_score": 24, "away_score": 21,
  "quarter_scores": { "q1": {...}, "q2": {...}, ... }
}
         ↓
Pool A (Squares - quarter scoring):
  → Winners at Q1, Q2, Q3, Final

Pool B (Squares - every score wins):
  → Winner on every score change

Pool C (Squares - score change):
  → Winner when either team's last digit changes
```

All pools consume the same upstream data, apply their own rules.

---

## Critical Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/squares/live-scoring-control.tsx` | Add conditional for `scoring_source` to read from event_state |
| `frontend/src/app/api/squares/sync-score/route.ts` | Extract ESPN normalization logic for reuse in worker |
| `frontend/src/lib/slashgolf/client.ts` | Reuse in worker provider |
| `frontend/src/lib/site-settings.ts` | Add GlobalEventsConfig type |
| `frontend/src/types/database.ts` | Regenerate after migrations |
| `frontend/src/components/pools/create-pool-button.tsx` | Update to launch wizard instead of modal |
| `frontend/src/app/(dashboard)/dashboard/page.tsx` | Add "Create Pool" button linking to wizard |

---

## Safety Guarantees

### Absolute Rule
**The existing live NFL squares pool must not break.**

### Safeguards
- All changes are additive (no DROP, no ALTER existing columns)
- Feature flags default to OFF
- Legacy path remains default until explicit per-pool cutover
- Rollback = disable feature flag or reset `scoring_source`
- Per-pool cutover, not all-or-nothing

---

## Verification Checklist

### Phase 1 Verification ✅
1. [x] Run migrations via Supabase MCP (`apply_migration`)
2. [x] Regenerate TypeScript types (`generate_typescript_types`)
3. [x] Verify backfill: `SELECT COUNT(*) FROM events WHERE provider = 'espn'`
4. [x] Verify sq_games.event_id populated for ESPN-linked games
5. [x] Test `/api/events/resolve` endpoint manually
6. [x] Test `/api/events/[id]/state` endpoint

### Phase 2 Verification ✅
7. [x] Deploy Edge Function `worker-tick`
8. [x] Verify it runs on schedule (check Supabase logs)
9. [x] Verify event_state populates for active events (golf tournament confirmed)

### Phase 3 Verification ✅
10. [x] Enable shadow mode in site_settings
11. [x] Compare scores match legacy using validation query (0 mismatches)
12. [ ] Cutover test pool, verify UI works
13. [ ] Monitor for discrepancies in production

### Phase 4+ Verification (Not Started)
14. [ ] Add discrepancy logging (optional)
15. [ ] Set up alerts for mismatch rate > 1% (optional)

### Phase 5 Verification (Not Started)
16. [ ] Cutover test pool, verify UI works
17. [ ] Switch scoring_source = 'global' per-pool
18. [ ] Disable legacy polling for cutover pools

### Pool Creation Wizard Verification (Not Started)
19. [ ] Wizard accessible from dashboard and org pages
20. [ ] Sport selection filters pool types correctly
21. [ ] Event picker shows upcoming events from `events` table
22. [ ] "Already tracked" badge appears for events with `event_state`
23. [ ] Search/filter works in event picker
24. [ ] Duplicate event creation is prevented
25. [ ] Pool-specific settings render correctly per pool type
26. [ ] Pool creation completes and links to selected event

---

## Development Environment (CURRENT SETUP)

A complete dev environment is configured and operational. This section documents the current state.

### Current Status: FULLY CONFIGURED

- [x] Separate dev Supabase project created (free tier)
- [x] Git `develop` branch created and pushed
- [x] Vercel environment variables configured for Preview deployments
- [x] Production schema synced to dev database (41 tables)
- [x] Production data cloned to dev database (users, pools, games, etc.)

### Git Workflow

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production | bnpools.com (Vercel Production) |
| `develop` | Development/testing | Preview URLs (Vercel Preview) |

**Workflow:**
1. Create feature branches from `develop`
2. Merge to `develop` for testing on preview deployments
3. When verified, merge `develop` → `main` for production

### Supabase Projects

| Environment | Project Ref | URL |
|-------------|-------------|-----|
| Production | `kszdeybgqfnmblgtpuki` | https://kszdeybgqfnmblgtpuki.supabase.co |
| Development | `bhfpercjszukzcodskia` | https://bhfpercjszukzcodskia.supabase.co |

The dev database is a **free tier project** on a separate Supabase organization (no monthly cost).

**Dev Database Password:** `mqh3JDB*wqg9xeu0cyd`

### Vercel Environment Variables

Environment variables are configured per deployment type:
- **Production deployments** (`main` branch) → Production Supabase credentials
- **Preview deployments** (`develop` and feature branches) → Dev Supabase credentials

Variables configured:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### MCP Configuration

The `.mcp.json` file is configured for **production** (to protect the live pool):
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "...", "--project-ref", "kszdeybgqfnmblgtpuki"]
    }
  }
}
```

For dev work:
- Use Vercel preview deployments (auto-connects to dev Supabase)
- Use Supabase CLI linked to dev project for direct SQL

### Syncing Schema to Dev

When schema changes are applied to production via MCP, sync to dev:

```bash
# 1. Link to production and dump schema
supabase link --project-ref kszdeybgqfnmblgtpuki
supabase db dump --linked -s public -f schema_dump.sql

# 2. Link to dev and apply
supabase link --project-ref bhfpercjszukzcodskia
cp schema_dump.sql supabase/migrations/YYYYMMDDHHMMSS_sync.sql
supabase db push --include-all

# 3. Link back to production
supabase link --project-ref kszdeybgqfnmblgtpuki
```

### Syncing Data to Dev

To clone production data to dev (requires Docker Desktop running):

```bash
# 1. Link to production and dump data
supabase link --project-ref kszdeybgqfnmblgtpuki
supabase db dump --linked --data-only -f data_dump.sql

# 2. Apply to dev via Docker (since psql isn't installed locally)
supabase link --project-ref bhfpercjszukzcodskia
docker run --rm --network host \
  -v "$(pwd)/data_dump.sql:/data_dump.sql" \
  public.ecr.aws/supabase/postgres:17.6.1.063 \
  psql "postgresql://postgres:mqh3JDB%2Awqg9xeu0cyd@db.bhfpercjszukzcodskia.supabase.co:5432/postgres" \
  -f /data_dump.sql

# 3. Link back to production
supabase link --project-ref kszdeybgqfnmblgtpuki
```

### Tools Required

- **Docker Desktop** - Required for schema/data sync operations
- **Supabase CLI** - Already installed and authenticated (`supabase login` completed)

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Upstream provider instability | Exponential backoff + caching |
| Cost explosion from polling | Shared polling + adaptive intervals |
| RLS errors on new tables | Isolate new tables, test policies |
| Concurrency bugs | Single-runner enforcement via advisory locks |
| Worker failures | Lease expiry allows automatic takeover |

---

## Guiding Principle

> *Additive, gated, and reversible.*

No feature is allowed to risk the live pool without a rollback path.

---

## Next Steps (Choose Your Path)

With Phases 1-3 complete, here are the recommended next steps:

### Option A: Phase 4 - Shadow Comparison (Optional)

Add logging/alerting for production monitoring:
- Log any discrepancies between global and legacy scores
- Alert if mismatch rate exceeds threshold
- This is **optional** since Phase 3 validation showed 0 mismatches

### Option B: Phase 5 - Controlled Cutover

Switch pools to read from `event_state` directly:
1. Create a test/demo pool
2. Set `scoring_source = 'global'` on that pool
3. Update UI components to read from `event_state` when `scoring_source = 'global'`
4. Test thoroughly before rolling out to other pools

**Files to modify:**
- `frontend/src/components/squares/live-scoring-control.tsx` - Add conditional for scoring_source
- `frontend/src/components/golf/leaderboard.tsx` - Read from event_state when enabled

### Option C: Pool Creation Wizard (Can Run in Parallel)

Build the new pool creation wizard that integrates with global events:
1. Create wizard container page
2. Build step components (sport → pool type → event → settings → review)
3. Integrate with `/api/events/upcoming` for event discovery
4. This can be developed in parallel with Phase 5

**Recommended order:** Start with the Pool Creation Wizard since it provides user-facing value while the current golf pool continues working with legacy sync.

---

## Git Commits (Implementation History)

| Commit | Description |
|--------|-------------|
| `c9e4522` | Add dev environment setup and platform upgrade plan |
| `5cd05a0` | Add Phase 3 shadow mode legacy sync for golf tournaments |

---

End of document.
