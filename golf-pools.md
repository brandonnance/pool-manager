# Golf Pools Feature

## Overview

Golf pools allow users to pick 6 golfers for a PGA Tour tournament. Each golfer is assigned to a tier (1-6) where the tier value equals the point cost. Users must meet a minimum tier point requirement (default: 21 points) which forces strategic diversity in player selection.

**Tier System:**
- Tier 0 = Elite (manual assignment only, never auto-assigned)
- Tier 1 = 1 point (Top 15 OWGR)
- Tier 2 = 2 points (OWGR 16-40)
- Tier 3 = 3 points (OWGR 41-75)
- Tier 4 = 4 points (OWGR 76-125)
- Tier 5 = 5 points (OWGR 126-200)
- Tier 6 = 6 points (OWGR 201+ or unranked)

With 6 picks and 21 minimum points, users can't just pick all favorites.

## Data Source: Slash Golf API

**NOT using Sportradar** - too expensive ($1k/month). Using Slash Golf API via RapidAPI ($20/month).

API capabilities:
- Tournament schedules and field data
- Live leaderboard/scoring
- OWGR (Official World Golf Rankings) for auto-tiering
- Player profiles

Client: `/frontend/src/lib/slashgolf/client.ts`

## Database Schema (gp_* tables)

| Table | Purpose |
|-------|---------|
| `gp_golfers` | Master golfer table with `external_player_id` (Slash Golf player ID) |
| `gp_tournaments` | Tournament definitions with `external_tournament_id` |
| `gp_pools` | Golf-specific pool config (links to base `pools` table) |
| `gp_tournament_field` | Which golfers are in which tournament |
| `gp_tier_assignments` | Commissioner-assigned tiers per pool (tier_value 0-6) |
| `gp_entries` | User entries (can have multiple per user) |
| `gp_entry_picks` | 6 golfer picks per entry |
| `gp_golfer_results` | Round-by-round scores (round_1 through round_4) |

## Current Status

### Completed
- [x] Database schema for golf pools
- [x] Slash Golf API integration (replaced Sportradar)
- [x] Tournament import from API
- [x] Tournament field loading
- [x] Tier assignments page UI
- [x] Auto-tier API endpoint using OWGR rankings
- [x] Renamed legacy `sportradar_player_id` → `external_player_id`
- [x] Renamed legacy `sportradar_tournament_id` → `external_tournament_id`
- [x] TypeScript types regenerated

### In Progress
- [ ] **Testing auto-tier with Sony Open** - Need to verify the Auto-Assign (OWGR) button works correctly

### Not Started
- [ ] Entry submission UI
- [ ] Picks validation (tier point minimum)
- [ ] Live scoring integration
- [ ] Standings/leaderboard

## Key Files

| File | Purpose |
|------|---------|
| `/frontend/src/app/api/golf/auto-tier/route.ts` | Auto-assign tiers based on OWGR |
| `/frontend/src/app/api/golf/tournaments/route.ts` | Import tournaments and load field |
| `/frontend/src/app/api/golf/demo/route.ts` | Demo mode data seeding |
| `/frontend/src/app/(dashboard)/pools/[id]/golf/tiers/page.tsx` | Tier assignment UI |
| `/frontend/src/lib/slashgolf/client.ts` | Slash Golf API client |
| `/frontend/src/lib/golf/types.ts` | Golf-specific TypeScript types |
| `/frontend/src/lib/golf/scoring.ts` | Scoring calculation logic |

## Auto-Tier Flow

1. Commissioner clicks "Auto-Assign (OWGR)" button on tiers page
2. API fetches tournament field from `gp_tournament_field` joined with `gp_golfers`
3. API calls Slash Golf to get current OWGR rankings
4. Matches golfers by `external_player_id` to get their rank
5. Assigns tier based on TIER_RANGES (see route.ts)
6. Upserts to `gp_tier_assignments` table
7. Also updates `owgr_rank` in `gp_golfers` for reference

**Important:** Tier 0 is NEVER auto-assigned - it's reserved for manual "Elite" designation.

## Testing (Sony Open - January 2025)

Target tournament for testing the golf pools feature. Steps:
1. Create a golf pool
2. Import Sony Open tournament from Slash Golf API
3. Load tournament field
4. Test Auto-Assign (OWGR) button
5. Verify tier assignments look correct

## Recent Changes (January 2025)

- Renamed all `sportradar_*` columns to `external_*` to be API-agnostic
- Migrations applied:
  - `rename_sportradar_to_external_player_id`
  - `rename_sportradar_tournament_id`
- Updated all code references in API routes and types
