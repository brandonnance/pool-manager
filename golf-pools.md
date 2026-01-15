# Golf Major Pools - Technical Specification

## Overview

A tiered golf major pool system for PGA majors (Masters, PGA Championship, US Open, The Open). Participants select 6 golfers across commissioner-defined tiers, and scoring uses "best 4 of 6" with missed cut penalties.

---

## Implementation Status

### COMPLETE - Core MVP + Public Entries

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Database | COMPLETE | 8 gp_* tables, RLS policies, helper functions |
| Phase 2: Infrastructure | COMPLETE | Site settings, pool creation, routing |
| Phase 3: Demo Mode | COMPLETE | 50 mock golfers, simulate rounds, seed data |
| Phase 4: Commissioner Tools | COMPLETE | Tournament setup, tier editor |
| Phase 5: Pick Sheet | COMPLETE | 6-golfer selection with tier validation |
| Phase 6: Standings | COMPLETE | Best 4 of 6, score-to-par display |
| Phase 7: Public Entries | COMPLETE | Public URL, entry form, leaderboard |
| Phase 8: Live Scoring | COMPLETE | Slash Golf API sync with rate limiting |

### Recently Completed

| Feature | Status | Notes |
|---------|--------|-------|
| Public Entry System | COMPLETE | `/pools/golf/[slug]` - No account required |
| Public Leaderboard | COMPLETE | Same URL shows leaderboard after lock |
| Live Score Sync | COMPLETE | `/api/golf/sync-scores` - Manual sync from Slash Golf API |
| Smart Rate Limiting | COMPLETE | 5-minute cooldown, tournament hours indicator |
| Tie Ranking Fix | COMPLETE | All tied entries show "T1" (not just 1 for first) |
| Entry Name Validation | COMPLETE | Prevented duplicates via email+entry_name check |
| **To-Par Scoring Fix** | COMPLETE | Uses `to_par` consistently (not stroke totals) |
| **Detailed Golfer Display** | COMPLETE | POS, GOLFER, TOT, THR, R1-R4 columns |
| **Round Status Display** | COMPLETE | "F" for finished, "CUT" for missed cuts, hole # for in-progress |
| **Search Preserves Rankings** | COMPLETE | Filtering doesn't change entry positions |
| **Dropped Golfer Shading** | COMPLETE | Red background for bottom 2 golfers in public view |
| **Tier Badges in Public View** | COMPLETE | Color-coded tier numbers next to golfer names |

---

## Data Source: Slash Golf API

**NOT using Sportradar** - too expensive ($1k/month). Using Slash Golf API via RapidAPI.

### Pricing Tiers

| Plan | Calls/month | Price |
|------|-------------|-------|
| Free | 250 | $0 |
| Pro | 2,000 | $20 |
| Ultra | 20,000 | $50 |
| Mega | Unlimited | $100 |

### Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| GET /schedule | Tournament list for a year |
| GET /tournament | Player field (entry list) |
| GET /leaderboard | Live scores |
| GET /stats | World rankings (OWGR) |
| GET /players | Player search |

### API Response Format

The Slash Golf API returns data in **MongoDB Extended JSON format**. Key differences:
- Dates: `{ "$date": { "$numberLong": "1736467200000" } }`
- Numbers: `{ "$numberInt": "100000" }` or `{ "$numberLong": "..." }`

Our client includes helper functions to parse these:
- `parseMongoDate()` - Converts to ISO date string
- `parseMongoNumber()` - Converts to JavaScript number

### Environment Variables

```
# Slash Golf API (via RapidAPI)
RAPIDAPI_KEY=your_api_key_here
```

---

## Tier System

### Point Values
- **Tier 0**: 0 points (rare, elite golfers - manual assignment only)
- **Tier 1**: 1 point (Top 15 OWGR)
- **Tier 2**: 2 points (OWGR 16-40)
- **Tier 3**: 3 points (OWGR 41-75)
- **Tier 4**: 4 points (OWGR 76-125)
- **Tier 5**: 5 points (OWGR 126-200)
- **Tier 6**: 6 points (OWGR 201+ or unranked)

### Tier Point Rules
- Minimum tier points: **Configurable per pool** (default: 21)
- No maximum tier points
- With 6 picks and 21 minimum points, users can't just pick all favorites
- Example valid roster: T1 + T1 + T4 + T5 + T5 + T6 = 22 points
- Example invalid roster: T1 + T1 + T2 + T3 + T3 + T4 = 14 points

### Auto-Tier Flow (OWGR)

1. Commissioner clicks "Auto-Assign (OWGR)" button on tiers page
2. API fetches tournament field from `gp_tournament_field` joined with `gp_golfers`
3. API calls Slash Golf `/stats` endpoint with `statId: '186'` (OWGR)
4. Parses MongoDB Extended JSON format
5. Matches golfers by `external_player_id` to get their rank
6. Assigns tier based on TIER_RANGES (see route.ts)
7. Upserts to `gp_tier_assignments` table
8. Also updates `owgr_rank` in `gp_golfers` for reference

**Important:** Tier 0 is NEVER auto-assigned - it's reserved for manual "Elite" designation.

---

## Scoring System

### Per-Golfer Score Calculation

```typescript
// From lib/golf/scoring.ts
if (madeCut) {
  score = R1 + R2 + R3 + R4
} else {
  score = R1 + R2 + 80 + 80  // Missed cut penalty
}
```

### Entry Score Calculation (Best 4 of 6)

```typescript
// From lib/golf/scoring.ts
1. Calculate all 6 golfer scores
2. Sort ascending (lowest first)
3. Sum the best 4 (lowest) scores
4. Discard the worst 2 scores
```

### Score to Par Display

```typescript
// Uses `to_par` directly from Slash Golf API
// This is consistent whether golfer is mid-round or finished
const toPar = result?.to_par ?? 0  // e.g., -6, 0, +3

// Format for display
function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E'
  if (toPar > 0) return `+${toPar}`
  return toPar.toString()  // e.g., "-6"
}
```

**Important:** We store both `total_score` (stroke total) and `to_par` (relative to par) in `gp_golfer_results`. The UI always uses `to_par` for display, as it's the standard golf scoring format.

---

## Data Model

### Tables (gp_* prefix)

```
gp_golfers
├── id (uuid, PK)
├── name (text)
├── external_player_id (text, unique, nullable)  # Slash Golf player ID
├── country (text)
├── headshot_url (text)
├── owgr_rank (integer)

gp_tournaments
├── id (uuid, PK)
├── name (text)
├── external_tournament_id (text, unique, nullable)  # Slash Golf tournament ID
├── start_date, end_date (date)
├── par (integer, default 72)
├── cut_round (integer, default 2)
├── status (upcoming/in_progress/completed)
├── venue, course_name (text)

gp_pools
├── id (uuid, PK)
├── pool_id (uuid, FK → pools, unique)
├── tournament_id (uuid, FK → gp_tournaments, nullable)
├── min_tier_points (integer, default 21)
├── picks_lock_at (timestamptz)
├── demo_mode (boolean, default false)
├── public_slug (text, unique)
├── public_entries_enabled (boolean, default false)

gp_tournament_field
├── id (uuid, PK)
├── tournament_id (uuid, FK)
├── golfer_id (uuid, FK)
├── status (active/withdrawn/cut/dq)
├── UNIQUE(tournament_id, golfer_id)

gp_tier_assignments
├── id (uuid, PK)
├── pool_id (uuid, FK → gp_pools)
├── golfer_id (uuid, FK)
├── tier_value (integer, 0-6)
├── UNIQUE(pool_id, golfer_id)

gp_entries
├── id (uuid, PK)
├── pool_id (uuid, FK → pools)
├── user_id (uuid, FK, nullable)  # NULL for public entries
├── entry_name (text)
├── entry_number (integer)
├── participant_name (text, nullable)  # For public entries
├── participant_email (text, nullable)  # For public entries
├── verified (boolean, default false)
├── submitted_at (timestamptz)

gp_entry_picks
├── id (uuid, PK)
├── entry_id (uuid, FK)
├── golfer_id (uuid, FK)
├── UNIQUE(entry_id, golfer_id)

gp_golfer_results
├── id (uuid, PK)
├── tournament_id (uuid, FK)
├── golfer_id (uuid, FK)
├── round_1, round_2, round_3, round_4 (integer, nullable)  # Stroke totals
├── made_cut (boolean)
├── position (text)  # "1", "T2", "-" etc.
├── total_score (integer)  # Total strokes
├── to_par (integer)  # Score relative to par (-6, 0, +3)
├── thru (integer, nullable)  # Holes completed: 1-18, or null
├── UNIQUE(tournament_id, golfer_id)
```

---

## Key Files Reference

### API Routes

```
frontend/src/app/api/golf/
├── auto-tier/route.ts         # POST: Auto-assign tiers based on OWGR
├── demo/route.ts              # POST: seed, simulate, reset demo data
├── standings/route.ts         # GET: calculate standings with best 4 of 6
├── sync-scores/route.ts       # POST: Sync live scores from Slash Golf API
└── tournaments/route.ts       # GET: fetch tournaments, POST: import tournament
```

### Pages

```
frontend/src/app/(dashboard)/pools/[id]/golf/
├── setup/page.tsx             # Tournament setup, live scoring, demo controls
├── tiers/page.tsx             # Tier editor (0-6 assignment)
├── picks/page.tsx             # Pick sheet UI (authenticated)
└── entries/page.tsx           # Commissioner entry management

frontend/src/app/pools/golf/
└── [slug]/page.tsx            # Public entry form OR leaderboard (based on lock time)
```

### Components

```
frontend/src/components/golf/
├── golf-standings.tsx             # Expandable standings with golfer details
├── golf-standings-wrapper.tsx     # Client wrapper with auto-refresh
├── golf-public-entry-form.tsx     # Public pick sheet form
├── golf-public-leaderboard.tsx    # Public leaderboard after lock
└── gp-public-entries-card.tsx     # Commissioner URL management card
```

### Libraries

```
frontend/src/lib/golf/
├── demo-data.ts               # 50 demo golfers with suggested tiers
├── scoring.ts                 # calculateGolferScore, calculateEntryScore, formatScoreToPar
├── types.ts                   # GolferWithTier, EntryStanding, etc.
└── validation.ts              # validateRoster (6 golfers, min tier points)

frontend/src/lib/slashgolf/
├── client.ts                  # Slash Golf API client (singleton)
└── types.ts                   # Slash Golf response types & helpers
```

---

## Core Features

| Feature | Description |
|---------|-------------|
| **Tiered Picks** | Golfers assigned to tiers 0-6 by commissioner |
| **6-Golfer Roster** | Each entry selects exactly 6 golfers |
| **Tier Point Minimum** | Configurable minimum (default 21), no maximum |
| **Best 4 of 6 Scoring** | Lowest 4 golfer scores count, worst 2 dropped |
| **Missed Cut Penalty** | R1 + R2 + 80 + 80 for golfers who miss cut |
| **Multiple Entries** | Members can create multiple entries per pool |
| **Score to Par** | Shows -5, +3, E based on rounds played |
| **Demo Mode** | Test mode with mock tournament data |
| **Public Entries** | No account required for public pool entries |
| **Live Scoring** | Manual sync from Slash Golf API with rate limiting |

---

## Public Entry System

### URL Behavior
- **Before lock**: `/pools/golf/[slug]` shows pick sheet form
- **After lock**: Same URL shows public leaderboard

### Features
- Name, email, entry name fields (no account required)
- One-time submission (no edits after save)
- Multiple entries per person allowed
- Countdown timer to lock time
- Blocking modal when lock time passes
- Commissioner can edit/delete entries
- Verified toggle per entry for payment tracking

### Privacy
- Public leaderboard shows Entry Name only (not real name)
- Commissioner sees all details

---

## Live Scoring

### Sync Button Features
- 5-minute cooldown between syncs (prevents API abuse)
- Tournament hours indicator (7am-9pm local time)
- Last sync time display
- Graceful handling when no leaderboard data available

### Score Calculation
- Rounds 1-4 stored as actual strokes
- "thru" field shows holes completed (or 18 for finished)
- Missed cut penalty: R1 + R2 + 80 + 80
- Position tracking from API

---

## UI Components

### Golf Standings (`golf-standings.tsx`)

- Expandable rows showing all 6 golfers
- "Counted (Best 4)" and "Dropped (Worst 2)" sections with opacity difference
- Table-style layout with columns: POS, GOLFER, TOT, THR, R1, R2, R3, R4
- Color-coded tier badges (1-6) with OWGR-based coloring
- Score-to-par with green (under) / red (over) coloring
- THR column: "F" for finished, "CUT" for missed cut, hole # for in-progress
- Missed cut penalty: Shows "80" in red for R3/R4 columns
- "You" badge for current user's entries
- Tied entries show "T" prefix (T1, T3, etc.)

### Pick Sheet (`picks/page.tsx`)

- Golfers grouped by tier (0-6), empty tiers hidden
- Click to add/remove from roster
- Running tier point total
- Validation: exactly 6 golfers, minimum points
- Golfer Info: Hover card (desktop) or tap icon (mobile) shows:
  - Photo (placeholder if none)
  - Country with flag icon
  - OWGR ranking
  - Tier badge with points
  - Field status (WITHDRAWN/MISSED CUT/DQ if applicable)

### Tier Editor (`tiers/page.tsx`)

- All golfers in tournament field
- Select tier 0-6 from dropdown
- Auto-Assign (OWGR) button for bulk assignment
- Bulk save assignments
- Filter by name

### Public Entry Form (`golf-public-entry-form.tsx`)

- Horizontal tier rows with color-coded sections
- Countdown timer to lock time
- Name, email, entry name fields
- Real-time tier point validation
- Blocking modal when lock passes

### Public Leaderboard (`golf-public-leaderboard.tsx`)

- Expandable entry rows showing all 6 picks
- Entry name only (privacy - no real names shown)
- Golfers sorted by score (best first) within each entry
- Bottom 2 golfers (dropped) shown with red background shading
- Table-style layout: POS, GOLFER (with tier badge), TOT, THR, R1-R4
- THR column: "F" for finished, "CUT" for missed cut, hole # for in-progress
- Color-coded tier badges matching commissioner view
- Tied entries show "T" prefix (T1, T3, etc.)
- Search filter preserves original rankings
- Mobile-responsive design

---

## Testing Checklist

- [x] Create golf pool from org page
- [x] Seed demo tournament
- [x] Configure tiers (all golfers assigned)
- [x] Make picks (6 golfers, meet minimum points)
- [x] Simulate round 1, verify standings update
- [x] Simulate through round 4
- [x] Verify cut penalty (+80/+80)
- [x] Verify best 4 of 6 scoring
- [x] Verify score-to-par display
- [x] Multiple entries per user
- [x] Proxy entry management (commissioner can edit)
- [x] Import tournament from Slash Golf API
- [x] Auto-tier using OWGR rankings
- [x] Public entry URL
- [x] Public leaderboard after lock
- [x] Live score sync from Slash Golf API
- [x] Rate limiting for API calls

---

## File Paths for Quick Reference

| Purpose | Path |
|---------|------|
| Pool detail (golf section) | `frontend/src/app/(dashboard)/pools/[id]/page.tsx` |
| Tournament setup | `frontend/src/app/(dashboard)/pools/[id]/golf/setup/page.tsx` |
| Tier editor | `frontend/src/app/(dashboard)/pools/[id]/golf/tiers/page.tsx` |
| Pick sheet | `frontend/src/app/(dashboard)/pools/[id]/golf/picks/page.tsx` |
| Manage entries | `frontend/src/app/(dashboard)/pools/[id]/golf/entries/page.tsx` |
| Public entry/leaderboard | `frontend/src/app/pools/golf/[slug]/page.tsx` |
| Standings component | `frontend/src/components/golf/golf-standings.tsx` |
| Standings wrapper | `frontend/src/components/golf/golf-standings-wrapper.tsx` |
| Public entry form | `frontend/src/components/golf/golf-public-entry-form.tsx` |
| Public leaderboard | `frontend/src/components/golf/golf-public-leaderboard.tsx` |
| Standings API | `frontend/src/app/api/golf/standings/route.ts` |
| Sync scores API | `frontend/src/app/api/golf/sync-scores/route.ts` |
| Auto-tier API | `frontend/src/app/api/golf/auto-tier/route.ts` |
| Demo API | `frontend/src/app/api/golf/demo/route.ts` |
| Tournaments API | `frontend/src/app/api/golf/tournaments/route.ts` |
| Slash Golf client | `frontend/src/lib/slashgolf/client.ts` |
| Slash Golf types | `frontend/src/lib/slashgolf/types.ts` |
| Scoring utilities | `frontend/src/lib/golf/scoring.ts` |
| Validation | `frontend/src/lib/golf/validation.ts` |
| Types | `frontend/src/lib/golf/types.ts` |
| Demo data | `frontend/src/lib/golf/demo-data.ts` |
| Database types | `frontend/src/types/database.ts` |
