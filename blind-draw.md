# March Madness Blind Draw - Implementation Plan

> **Pool Type #3** from [FUTURE_POOLS.md](FUTURE_POOLS.md)
> **Status:** PLANNED - Ready to implement
> **Target:** March 2025 (or later)

---

## Overview

A 64-player pool where each player is randomly assigned one NCAA tournament team. Advancement is based on **covering the spread**, not just winning. The advancing player inherits the **winning team** for subsequent rounds.

**Key Design Decision:** Reuse `bb_teams` as master team list with a junction table (`mm_pool_teams`) for pool-specific data (seed, region, eliminated status).

---

## Core Mechanics

- **Entry Limit**: Exactly 64 players, 1 entry per person
- **Team Assignment**: Random draw after First Four completes (64 teams → 64 players)
- **Advancement Rule**: Whoever's team COVERS the spread advances
- **Team Inheritance**: Advancing player takes ownership of the WINNING team

### Spread-Based Advancement Example

**Matchup**: Auburn vs Georgia, Georgia favored by 10 (-10)

| Game Result | Who Covers? | Who Advances | Their Team Going Forward |
|-------------|-------------|--------------|--------------------------|
| Georgia wins by 12 | Georgia covers | Georgia owner | Georgia |
| Georgia wins by 7 | Auburn covers (beat spread) | Auburn owner | Georgia (winner) |
| Auburn wins 65-60 | Auburn covers | Auburn owner | Auburn |

**Key insight**: Because advancement is spread-based, a 16-seed owner has ~50% chance to advance if spreads are accurate. But if they advance via cover (opponent doesn't cover), they inherit the winning team for future rounds.

---

## Merge Strategy

This implementation is **merge-friendly**:
- All new tables use `mm_*` prefix (isolated)
- New components in `components/march-madness/` (no conflicts)
- New routes in `pools/[id]/march-madness/` (isolated)
- Only 3 integration points need modification (easy conflict resolution)

---

## Phase 1: Database Schema

Single migration creating all tables:

### Tables to Create

| Table | Purpose |
|-------|---------|
| `mm_pools` | Pool config (payout percentages, draw status, push rule) |
| `mm_pool_teams` | Junction: pool + bb_teams + seed + region + eliminated status |
| `mm_entries` | User entries with current_team and original_team tracking |
| `mm_games` | Matchups with spreads, scores, entry assignments |
| `mm_entry_payouts` | Track payouts per round |

### Key Schema Details

**mm_pool_teams** (links to existing bb_teams):
```sql
mm_pool_id UUID REFERENCES mm_pools(id)
team_id UUID REFERENCES bb_teams(id)
seed INTEGER (1-16)
region TEXT ('East', 'West', 'South', 'Midwest')
eliminated BOOLEAN
external_team_id TEXT  -- SportsDataIO team ID for API sync
```

**mm_entries** (team ownership tracking):
```sql
current_team_id UUID  -- Changes when inheriting winner
original_team_id UUID -- Initial random draw (for display)
eliminated BOOLEAN
eliminated_round TEXT
total_payout DECIMAL
```

**mm_games** (spread-based advancement):
```sql
higher_seed_team_id, lower_seed_team_id UUID
spread DECIMAL (negative = higher seed favored)
higher_seed_score, lower_seed_score INTEGER
winning_team_id UUID          -- Straight-up winner
spread_covering_team_id UUID  -- Who covered the spread
higher_seed_entry_id, lower_seed_entry_id UUID  -- Entry assignments
advancing_entry_id UUID       -- Entry that advances
external_game_id TEXT         -- SportsDataIO game ID for API sync
scheduled_time TIMESTAMPTZ
last_synced_at TIMESTAMPTZ
```

**mm_pools** (pool config):
```sql
pool_id UUID REFERENCES pools(id)
tournament_year INTEGER
draw_completed BOOLEAN
draw_completed_at TIMESTAMPTZ
sweet16_payout_pct, elite8_payout_pct, final4_payout_pct DECIMAL
runnerup_payout_pct, champion_payout_pct DECIMAL
push_rule TEXT ('favorite_advances', 'underdog_advances', 'coin_flip')
auto_sync_enabled BOOLEAN DEFAULT false
last_bracket_sync, last_odds_sync TIMESTAMPTZ
```

### Database Trigger

Create `mm_process_game_result()` trigger on mm_games that:
1. Calculates spread cover when game becomes final
2. Marks losing entry as eliminated
3. Transfers winning team to advancing entry
4. Updates `mm_entries.current_team_id`

---

## Phase 2: Site Settings & Types

### Files to Modify

1. **[site-settings.ts](frontend/src/lib/site-settings.ts)** - Add to PoolTypes interface:
```typescript
march_madness: boolean
```

2. **site_settings table** - Enable pool type:
```sql
UPDATE site_settings SET value = jsonb_set(value, '{march_madness}', 'true')
WHERE key = 'enabled_pool_types';
```

3. **pools.type CHECK constraint** - Add `'march_madness'` to allowed types

4. **Regenerate types** - Run `mcp__supabase__generate_typescript_types`

---

## Phase 3: Pool Creation

### File to Modify

**[create-pool-button.tsx](frontend/src/components/pools/create-pool-button.tsx)**

Changes:
1. Add `'march_madness'` to `PoolType` union (line 26)
2. Add button in pool type selector grid (after golf, ~line 374):
```tsx
{enabledPoolTypes?.march_madness && (
  <button onClick={() => setPoolType('march_madness')} ...>
    <div className="font-medium">March Madness</div>
    <div className="text-xs text-muted-foreground">64-player blind draw</div>
  </button>
)}
```
3. Add creation block after golf (after line 227):
```typescript
if (poolType === 'march_madness') {
  await supabase.from('mm_pools').insert({
    pool_id: pool.id,
    tournament_year: new Date().getFullYear(),
  })
}
```
4. Update `enabledCount` calculation (line 322-324)

---

## Phase 4: Pool Detail Page

### File to Modify

**[pools/[id]/page.tsx](frontend/src/app/(dashboard)/pools/[id]/page.tsx)**

Add conditional block for March Madness (follows golf pattern):

1. Data fetching (~line 263):
```typescript
let mmPoolData = null, mmEntriesData = [], mmGamesData = []
if (pool.type === 'march_madness') {
  // Fetch mm_pools, mm_entries, mm_games, mm_pool_teams
}
```

2. Conditional rendering (~line 500+):
```tsx
{pool.type === 'march_madness' && mmPoolData && (
  <MarchMadnessContent ... />
)}
```

---

## Phase 5: New Components

### Directory: `frontend/src/components/march-madness/`

| Component | Purpose |
|-----------|---------|
| `march-madness-content.tsx` | Main wrapper (shows setup vs active state) |
| `bracket-view.tsx` | Visual tournament bracket |
| `standings-table.tsx` | Entry standings (alive vs eliminated) |
| `team-draw-display.tsx` | Show team assignments |
| `game-card.tsx` | Individual game display |
| `enter-score-dialog.tsx` | Commissioner score entry |
| `enter-spread-dialog.tsx` | Commissioner spread entry |
| `random-draw-button.tsx` | Trigger random team assignment |
| `team-selector.tsx` | Select 64 teams from bb_teams |

---

## Phase 6: New Pages

### Directory: `frontend/src/app/(dashboard)/pools/[id]/march-madness/`

| Route | Purpose |
|-------|---------|
| `setup/page.tsx` | Add 64 teams, assign seeds/regions, configure payouts |
| `entries/page.tsx` | View entries, trigger random draw |
| `bracket/page.tsx` | Full tournament bracket view |
| `games/page.tsx` | Commissioner: enter spreads and scores |

---

## Phase 7: Library & API Routes

### Library: `frontend/src/lib/madness/`

```
lib/madness/
├── client.ts           # API client (follows slashgolf pattern)
├── types.ts            # API response types
├── sync.ts             # Sync logic (bracket, spreads, scores)
├── scoring.ts          # Spread cover calculations
├── demo-data.ts        # Mock data for testing
└── validation.ts       # Entry/bracket validation
```

### API Routes: `frontend/src/app/api/madness/`

| Route | Method | Purpose |
|-------|--------|---------|
| `draw/route.ts` | POST | Execute random team draw |
| `bracket/route.ts` | POST | Import bracket from API |
| `odds/route.ts` | POST | Fetch/update spreads |
| `scores/route.ts` | POST | Fetch live scores, mark games final |
| `demo/route.ts` | POST | Seed/simulate/reset demo data |

---

## Key Flows

### 1. Pool Setup Flow
1. Create pool → creates mm_pools record
2. Commissioner goes to `/march-madness/setup`
3. Select 64 teams from bb_teams (or import via API), assign seeds (1-16) and regions
4. Creates 64 mm_pool_teams records

### 2. Entry Collection
1. Activate pool (draft → open)
2. Members join, creates mm_entries (no team yet)
3. Max 64 entries enforced

### 3. Random Draw
1. Commissioner sees "64/64 entries - Ready to Draw"
2. Clicks draw button → API shuffles and assigns
3. Each entry gets current_team_id + original_team_id

### 4. Game Results (Spread-Based)
1. Commissioner enters spread before game (or API fetch)
2. Commissioner enters final score (or API sync)
3. Trigger calculates:
   - Straight-up winner (higher score)
   - Spread cover (adjusted score comparison)
4. Losing entry eliminated
5. Advancing entry inherits WINNING team

### 5. Payouts
- Sweet 16: 16 entries get sweet16_payout_pct each
- Elite 8: 8 entries get elite8_payout_pct each
- Final 4: 4 entries get final4_payout_pct each
- Runner-up: 1 entry gets runnerup_payout_pct
- Champion: 1 entry gets champion_payout_pct

---

## Phase 8: External API Integration (Automation)

### Goal: Zero-Touch Commissioner Experience

Once the pool is set up with 64 entries, the system can automatically:
1. Import bracket (teams, seeds, regions, matchups)
2. Fetch spreads before each game
3. Update live scores during games
4. Mark games final and trigger advancement

### API Providers (via RapidAPI)

| Provider | Data | Use Case |
|----------|------|----------|
| [The Odds API](https://the-odds-api.com/sports-odds-data/ncaa-basketball-odds.html) | Spreads, moneylines, totals | **Primary** - spread-based advancement |
| [SportsDataIO](https://sportsdata.io/ncaa-college-basketball-api) | Scores, schedules, stats, real-time | **Primary** - bracket data, live scores |

### Sync Strategy Options

#### Option A: Client-Side Polling (Simple)
- Commissioner dashboard polls `/api/madness/scores` every 60s during games
- Manual "Refresh Spreads" button fetches latest odds
- Pro: Simple, no infrastructure
- Con: Only works when commissioner has page open

#### Option B: Supabase Edge Function (Recommended)
- Cron job runs every 5 minutes during tournament
- Checks for games in progress, fetches scores
- Auto-marks games final when complete
- Pro: Fully automated
- Con: Slightly more complex setup

```typescript
// supabase/functions/madness-sync/index.ts
Deno.serve(async () => {
  // 1. Get all mm_pools with auto_sync_enabled
  // 2. For each, fetch games where status != 'final'
  // 3. Call SportsDataIO for live scores
  // 4. Update mm_games, trigger advancement
})
```

### Automation Levels

| Level | Bracket | Spreads | Scores | Advancement |
|-------|---------|---------|--------|-------------|
| **Manual** | Commissioner enters | Commissioner enters | Commissioner enters | DB trigger |
| **Semi-Auto** | API import | API fetch (manual trigger) | API fetch (manual) | DB trigger |
| **Full-Auto** | API import | Auto-fetch before tip | Edge function polls | DB trigger |

Commissioner can choose their level via `mm_pools.auto_sync_enabled`.

### Sync Flow Diagram

```
Tournament Announced
        │
        ▼
┌─────────────────────────────┐
│  POST /api/madness/bracket  │  ← Commissioner clicks "Import Bracket"
│  - Fetch 64 teams + seeds   │
│  - Create mm_pool_teams     │
│  - Create mm_games (empty)  │
└─────────────────────────────┘
        │
        ▼
    Entry Collection (64 players join)
        │
        ▼
    Random Draw (teams assigned)
        │
        ▼
┌─────────────────────────────┐
│   POST /api/madness/odds    │  ← Auto or manual before R64 starts
│   - Fetch spreads for R64   │
│   - Update mm_games.spread  │
└─────────────────────────────┘
        │
        ▼
    Games Begin
        │
        ▼
┌─────────────────────────────┐
│  Edge Function (every 5m)   │  ← Or client polling
│  - Fetch live scores        │
│  - Update mm_games          │
│  - Mark final when complete │
│  - DB trigger handles rest  │
└─────────────────────────────┘
        │
        ▼
    Repeat for R32, S16, E8, F4, Final
```

---

## Demo Mode

**Purpose:** Test full flow without live API / during off-season

**Actions:**
1. `seed` - Create mock bracket with 64 teams, realistic seeds
2. `simulate_round` - Generate scores for next round, apply spreads
3. `reset` - Clear all game results, restore to post-draw state

**Demo data includes:**
- 64 college basketball teams (reuse from bb_teams)
- Realistic seed matchups (1v16, 2v15, etc.)
- Spread generation based on seed differential
- Score simulation with upset probability

---

## Files Summary

### Existing Files to Modify
| File | Changes |
|------|---------|
| [create-pool-button.tsx](frontend/src/components/pools/create-pool-button.tsx) | Add march_madness type, creation logic |
| [pools/[id]/page.tsx](frontend/src/app/(dashboard)/pools/[id]/page.tsx) | Add conditional rendering |
| [site-settings.ts](frontend/src/lib/site-settings.ts) | Add march_madness to PoolTypes |

### New Files to Create
- 1 database migration (all mm_* tables + external ID columns)
- 10 new components in `components/march-madness/`
- 4 new pages in `pools/[id]/march-madness/`
- 6 library files in `lib/madness/` (client, types, sync, scoring, demo-data, validation)
- 5 API routes in `api/madness/` (draw, bracket, odds, scores, demo)

---

## Environment Variables

```env
# .env.local
RAPIDAPI_KEY=your_key_here
SPORTSDATA_NCAAB_HOST=api.sportsdata.io
ODDS_API_KEY=your_odds_api_key  # If using The Odds API directly
```

---

## Implementation Priority

For MVP, implement in this order:
1. **Manual mode** - Everything works with commissioner data entry
2. **Bracket import** - One-click bracket setup from API
3. **Spread fetch** - Pull odds before games
4. **Score sync** - Client-side polling for live games
5. **Edge function** - Full automation (post-MVP)

---

## Verification Plan

1. **Database**: Verify tables created with `mcp__supabase__list_tables`
2. **Pool Creation**: Create a march_madness pool, verify mm_pools record created
3. **Team Setup**: Add 64 teams (manual or API import), verify mm_pool_teams records
4. **Entry Collection**: Join pool, verify mm_entries created
5. **Random Draw**: Execute draw, verify teams assigned to entries
6. **Game Flow**: Enter spread → enter score → verify elimination and team transfer
7. **Payouts**: Verify payout records created at each round threshold
8. **API Sync**: Test bracket import, spread fetch, score sync endpoints
9. **Demo Mode**: Verify seed/simulate/reset cycle works end-to-end
