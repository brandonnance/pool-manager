# Golf Major Pools - Technical Specification

## Overview

A tiered golf major pool system for PGA majors (Masters, PGA Championship, US Open, The Open). Participants select 6 golfers across commissioner-defined tiers, and scoring uses "best 4 of 6" with missed cut penalties.

---

## Implementation Status

### COMPLETE - Core MVP

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Database | COMPLETE | 8 gp_* tables, RLS policies, helper functions |
| Phase 2: Infrastructure | COMPLETE | Site settings, pool creation, routing |
| Phase 3: Demo Mode | COMPLETE | 50 mock golfers, simulate rounds, seed data |
| Phase 4: Commissioner Tools | COMPLETE | Tournament setup, tier editor |
| Phase 5: Pick Sheet | COMPLETE | 6-golfer selection with tier validation |
| Phase 6: Standings | COMPLETE | Best 4 of 6, score-to-par display |

### Remaining Work

| Feature | Status | Priority |
|---------|--------|----------|
| Manual score entry page | NOT STARTED | Medium |
| Public standings URL | NOT STARTED | Low |
| Sportradar live sync | NOT STARTED | Low (demo works) |

### Recently Completed (This Session)

| Feature | Status | Notes |
|---------|--------|-------|
| Manage Entries | COMPLETE | `/golf/entries` - Commissioner can view/edit all entries |
| Golfer Info Popover | COMPLETE | Hover card (desktop) + tap icon (mobile) with photo, country, OWGR, tier, status |
| Empty Tier Hiding | COMPLETE | Tier 0 section hidden when no golfers assigned |
| Duplicate Entry Fix | COMPLETE | Fixed race condition + added DB unique constraint |

---

## Key Files Reference

### API Routes

```
frontend/src/app/api/golf/
├── demo/route.ts              # POST: seed, simulate, reset demo data
└── standings/route.ts         # GET: calculate standings with best 4 of 6
```

### Pages

```
frontend/src/app/(dashboard)/pools/[id]/golf/
├── setup/page.tsx             # Tournament setup, demo controls
├── tiers/page.tsx             # Tier editor (0-6 assignment)
└── picks/page.tsx             # Pick sheet UI
```

### Components

```
frontend/src/components/golf/
├── golf-standings.tsx         # Expandable standings with golfer details
└── golf-standings-wrapper.tsx # Client wrapper with auto-refresh
```

### Libraries

```
frontend/src/lib/golf/
├── demo-data.ts               # 50 demo golfers with suggested tiers
├── scoring.ts                 # calculateGolferScore, calculateEntryScore, formatScoreToPar
├── types.ts                   # GolferWithTier, EntryStanding, etc.
└── validation.ts              # validateRoster (6 golfers, min tier points)

frontend/src/lib/sportradar/
├── client.ts                  # API client (singleton)
└── types.ts                   # Sportradar response types
```

### Pool Detail Page

```
frontend/src/app/(dashboard)/pools/[id]/page.tsx
# Lines ~262-670: Golf pool section
# - Tournament info card
# - GolfStandingsWrapper
# - Commissioner tools sidebar
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

---

## Tier System

### Point Values
- **Tier 0**: 0 points (rare, elite golfers)
- **Tier 1**: 1 point
- **Tier 2**: 2 points
- **Tier 3**: 3 points
- **Tier 4**: 4 points
- **Tier 5**: 5 points
- **Tier 6**: 6 points

### Tier Point Rules
- Minimum tier points: **Configurable per pool** (default: 21)
- No maximum tier points
- Example valid roster: T1 + T1 + T4 + T5 + T5 + T6 = 22 points ✓
- Example invalid roster: T1 + T1 + T2 + T3 + T3 + T4 = 14 points ✗

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
// Calculates based on rounds actually played
const roundsPlayed = countRoundsPlayed(golfer)  // 1-4
const effectivePar = parPerRound * roundsPlayed // e.g., 72 * 2 = 144
const scoreToPar = totalScore - effectivePar    // e.g., 140 - 144 = -4
```

---

## Data Model

### Tables (gp_* prefix)

```
gp_golfers
├── id (uuid, PK)
├── name (text)
├── sportradar_player_id (text, unique, nullable)
├── country (text)
├── headshot_url (text)
├── owgr_rank (integer)

gp_tournaments
├── id (uuid, PK)
├── name (text)
├── sportradar_tournament_id (text, unique, nullable)
├── start_date, end_date (date)
├── par (integer, default 72)           # Added for score-to-par
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
├── user_id (uuid, FK)
├── entry_name (text)
├── entry_number (integer)
├── created_by (uuid, FK, nullable)  -- for proxy entries
├── submitted_at (timestamptz)
├── UNIQUE(pool_id, user_id, entry_number)  -- prevents duplicate entries

gp_entry_picks
├── id (uuid, PK)
├── entry_id (uuid, FK)
├── golfer_id (uuid, FK)
├── UNIQUE(entry_id, golfer_id)

gp_golfer_results
├── id (uuid, PK)
├── tournament_id (uuid, FK)
├── golfer_id (uuid, FK)
├── round_1, round_2, round_3, round_4 (integer, nullable)
├── made_cut (boolean)
├── position (text)
├── total_score (integer)
├── UNIQUE(tournament_id, golfer_id)
```

---

## Demo Mode

### How It Works

1. **Seed Data** (`POST /api/golf/demo` with `action: 'seed'`)
   - Creates "Demo Masters 2025" tournament
   - Adds 50 golfers from `demo-data.ts`
   - Links tournament to pool
   - Sets demo_mode = true

2. **Simulate Round** (`POST /api/golf/demo` with `action: 'simulate'`)
   - Generates realistic scores (normal distribution around par)
   - Applies cut after round 2 (bottom ~40% miss cut)
   - Updates tournament status

3. **Reset** (`POST /api/golf/demo` with `action: 'reset'`)
   - Clears all results
   - Resets tournament status to 'upcoming'

### Demo Golfers (50 total)

Tiers are pre-suggested in `demo-data.ts`:
- Tier 0: Scheffler
- Tier 1: Rory, Rahm, Koepka, etc.
- Tier 2-6: Distributed across skill levels

---

## API Reference

### GET /api/golf/standings?poolId=xxx

Returns:
```typescript
{
  standings: [{
    entryId: string
    entryName: string | null
    userName: string | null
    userId: string
    rank: number
    tied: boolean
    score: number | null  // Sum of best 4
    golferScores: [{
      golferId: string
      golferName: string
      tier: number
      round1: number | null
      round2: number | null
      round3: number | null
      round4: number | null
      totalScore: number
      madeCut: boolean
      counted: boolean  // true if in best 4
    }]
  }],
  parPerRound: number,  // e.g., 72
  totalPar: number      // e.g., 288
}
```

### POST /api/golf/demo

Body:
```typescript
{
  poolId: string
  action: 'seed' | 'simulate' | 'reset'
}
```

---

## UI Components

### Golf Standings (`golf-standings.tsx`)

- Expandable rows showing all 6 golfers
- "Counted (Best 4)" and "Dropped (Worst 2)" sections
- Color-coded tier badges
- Score-to-par with green/red coloring
- CUT badge for missed cut golfers
- "You" badge for current user's entries

### Pick Sheet (`picks/page.tsx`)

- Golfers grouped by tier (0-6), empty tiers hidden
- Click to add/remove from roster
- Running tier point total
- Validation: exactly 6 golfers, minimum points
- Submit creates entry + picks
- **Golfer Info**: Hover card (desktop) or tap info icon (mobile) shows:
  - Photo (placeholder if none)
  - Country with flag icon
  - OWGR ranking
  - Tier badge with points
  - Field status (WITHDRAWN/MISSED CUT/DQ if applicable)

### Manage Entries (`entries/page.tsx`)

- Table of all entries with user info
- Shows pick count and completion status
- Edit button opens slide-in sheet
- Commissioner can modify any user's picks
- Same tier validation as pick sheet

### Tier Editor (`tiers/page.tsx`)

- All golfers in tournament field
- Select tier 0-6 from dropdown
- Bulk save assignments
- Filter by name

---

## Environment Variables

```
# Sportradar (not yet used - demo mode works without it)
SPORTRADAR_API_KEY=xxx
SPORTRADAR_BASE_URL=https://api.sportradar.com/golf/production/pga/v3
```

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
- [x] Verify score-to-par display (after fix)
- [ ] Multiple entries per user
- [x] Proxy entry management (commissioner can edit any entry via /golf/entries)
- [ ] Public standings URL

---

## Known Issues / Future Work

1. **Manual score entry**: `/golf/scores` page returns 404
2. **Public URL**: No `/view/[slug]` route for sharing standings
3. **Sportradar live sync**: API client exists but not integrated
4. **Pick locking**: Lock time not enforced server-side (demo mode bypasses)

---

## File Paths for Quick Reference

| Purpose | Path |
|---------|------|
| Pool detail (golf section) | `frontend/src/app/(dashboard)/pools/[id]/page.tsx` |
| Tournament setup | `frontend/src/app/(dashboard)/pools/[id]/golf/setup/page.tsx` |
| Tier editor | `frontend/src/app/(dashboard)/pools/[id]/golf/tiers/page.tsx` |
| Pick sheet | `frontend/src/app/(dashboard)/pools/[id]/golf/picks/page.tsx` |
| Manage entries | `frontend/src/app/(dashboard)/pools/[id]/golf/entries/page.tsx` |
| Standings component | `frontend/src/components/golf/golf-standings.tsx` |
| Standings wrapper | `frontend/src/components/golf/golf-standings-wrapper.tsx` |
| Standings API | `frontend/src/app/api/golf/standings/route.ts` |
| Demo API | `frontend/src/app/api/golf/demo/route.ts` |
| Scoring utilities | `frontend/src/lib/golf/scoring.ts` |
| Validation | `frontend/src/lib/golf/validation.ts` |
| Types | `frontend/src/lib/golf/types.ts` |
| Demo data | `frontend/src/lib/golf/demo-data.ts` |
| Sportradar client | `frontend/src/lib/sportradar/client.ts` |
| Database types | `frontend/src/types/database.ts` |
