# BN Pools - Pool Types Roadmap

## Current State

### Live Pool Types

- **Bowl Buster** - Complete and live at pools.brandon-nance.com
  - Bowl game picks with margin-of-victory scoring
  - CFP bracket picker
  - Demo mode for testing

- **NFL Playoff Squares** - Complete and live
  - 10x10 grid with visual ownership display
  - Random number generation
  - 13 NFL playoff games pre-structured
  - Color-coded winners by round

- **Single Game Squares** - Complete and live
  - Score change mode with forward/reverse winners
  - Quarter scoring mode (needs testing)

- **Golf Major Pools** - Complete and live (can be disabled via admin settings)
  - Tiered golfer picks (6 golfers, best 4 of 6 scoring)
  - Public entry system (no account required)
  - Live scoring via Slash Golf API
  - Elite tier for commissioner-designated players
  - See [golf-pools.md](golf-pools.md) for full documentation

---

## Pool Type: March Madness Blind Draw

### Status: PLANNED - See [blind-draw.md](blind-draw.md) for full implementation plan

### Overview
64-player pool where each player is randomly assigned one NCAA tournament team. Advancement is based on **covering the spread**, not just winning. The twist: you always inherit the WINNING team, so even underdogs have a fair shot.

### Core Mechanics
- **Entry Limit**: Exactly 64 players, 1 entry per person
- **Team Assignment**: Random draw after First Four completes (64 teams → 64 players)
- **Advancement Rule**: Whoever's team COVERS the spread advances
- **Team Inheritance**: Advancing player takes ownership of the WINNING team

### Spread-Based Advancement Examples

**Matchup**: Auburn vs Georgia, Georgia favored by 10 (-10)

| Game Result | Who Covers? | Who Advances | Their Team Going Forward |
|-------------|-------------|--------------|--------------------------|
| Georgia wins by 12 | Georgia covers | Georgia owner | Georgia |
| Georgia wins by 7 | Auburn covers (beat spread) | Auburn owner | Georgia (winner) |
| Auburn wins 65-60 | Auburn covers | Auburn owner | Auburn |

**Key insight**: Because advancement is spread-based, a 16-seed owner has ~50% chance to advance if spreads are accurate. But if they advance via cover (opponent doesn't cover), they inherit the winning team for future rounds.

### Tournament Flow
1. **First Four** (Play-in): Not included, wait for field of 64
2. **Round of 64**: 64 players → 32 advance
3. **Round of 32**: 32 players → 16 advance
4. **Sweet 16**: 16 players → 8 advance (payouts begin)
5. **Elite 8**: 8 players → 4 advance
6. **Final Four**: 4 players → 2 advance
7. **Championship**: 2 players → 1 winner

### Payout Structure (% of pot, TBD)
| Round | Players Remaining | Payout |
|-------|-------------------|--------|
| Sweet 16 | 16 | X% each |
| Elite 8 | 8 | Y% each |
| Final Four | 4 | Z% each |
| Runner-up | 1 | A% |
| Champion | 1 | B% |

### Database Schema (Proposed)

```sql
-- Blind draw pool configuration
CREATE TABLE mm_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  entry_fee DECIMAL(10,2),
  sweet16_payout_pct DECIMAL(5,2),
  elite8_payout_pct DECIMAL(5,2),
  final4_payout_pct DECIMAL(5,2),
  runnerup_payout_pct DECIMAL(5,2),
  champion_payout_pct DECIMAL(5,2),
  teams_assigned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Teams in the tournament (64 teams after First Four)
CREATE TABLE mm_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mm_pool_id UUID REFERENCES mm_pools(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  seed INTEGER NOT NULL, -- 1-16
  region TEXT NOT NULL, -- 'East', 'West', 'South', 'Midwest'
  eliminated BOOLEAN DEFAULT false,
  eliminated_round TEXT -- 'R64', 'R32', 'S16', 'E8', 'F4', 'FINAL'
);

-- Player entries (1 per player, max 64)
CREATE TABLE mm_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mm_pool_id UUID REFERENCES mm_pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  current_team_id UUID REFERENCES mm_teams(id), -- Changes if they inherit winner
  original_team_id UUID REFERENCES mm_teams(id), -- Their initial random draw
  eliminated BOOLEAN DEFAULT false,
  eliminated_round TEXT,
  payout DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(mm_pool_id, user_id)
);

-- Games with spreads
CREATE TABLE mm_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mm_pool_id UUID REFERENCES mm_pools(id) ON DELETE CASCADE,
  round TEXT NOT NULL, -- 'R64', 'R32', 'S16', 'E8', 'F4', 'FINAL'
  home_team_id UUID REFERENCES mm_teams(id),
  away_team_id UUID REFERENCES mm_teams(id),
  spread DECIMAL(4,1), -- Negative = home favored, e.g., -10.5
  home_score INTEGER,
  away_score INTEGER,
  status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, final
  game_time TIMESTAMPTZ,
  winner_team_id UUID REFERENCES mm_teams(id),
  spread_winner_team_id UUID REFERENCES mm_teams(id) -- Team that covered
);
```

### Complexity Notes
- Need to handle spread ties (push) - typically goes to favorite?
- Commissioner needs to enter spreads before each round (or pull from API)
- Team ownership transfer needs clear visual indication

---

## Pool Type: NFL Survivor (Future)

### Status: NOT DESIGNED

*To be designed - Pick one team per week, can't reuse, eliminated on loss*

---

## Pool Type: Weekly Pick'em (Future)

### Status: NOT DESIGNED

*To be designed - Pick winners each week, straight up or against spread*

---

## Implementation Priority
1. **Bowl Buster** - DONE
2. **NFL Playoff Squares** - DONE
3. **Single Game Squares** - DONE (needs quarter mode testing)
4. **Golf Major Pools** - DONE (live, toggleable via admin)
5. **March Madness Blind Draw** - March timing, spread-based advancement
6. **NFL Survivor** - September timing, simple mechanics
7. **Weekly Pick'em** - Anytime, most flexible
