# BN Pools - Future Pool Types Roadmap

## Current State
- **Bowl Buster** - Complete and live at pools.brandon-nance.com
  - Bowl game picks with margin-of-victory scoring
  - CFP bracket picker
  - Demo mode for testing

---

## Pool Type #1: NFL Playoff Squares

### Status: IMPLEMENTED

### Overview
Classic 10x10 squares grid for NFL playoff games. Players claim squares, numbers are randomly assigned after grid is full, and winners are determined by the last digit of each team's score.

### Implemented Features
- [x] 10x10 grid with visual ownership display
- [x] Click-to-claim squares (members can claim/unclaim before numbers locked)
- [x] Commissioner can assign/reassign squares to any member
- [x] Random number generation for row/column axes
- [x] Configurable max squares per player
- [x] Reverse scoring option (both forward and reverse winners)
- [x] Halftime scoring for Super Bowl
- [x] 13 NFL playoff games pre-structured (Wild Card, Divisional, Conference, Super Bowl)
- [x] Color-coded winners by round:
  - Wild Card: Amber
  - Divisional: Emerald
  - Conference: Red
  - Super Bowl Halftime: Violet
  - Super Bowl Final: Purple
- [x] Commissioner score entry for each game
- [x] Automatic winner calculation based on score digits
- [x] Payout leaderboard showing total winnings per player
- [x] Team labels on grid axes
- [x] Grid legend showing all colors
- [x] Your squares highlighted in sky blue

### Database Schema (Implemented)
- `sq_pools` - Pool configuration (reverse_scoring, max_squares_per_player, numbers_locked, row_numbers, col_numbers, mode)
- `sq_squares` - Individual square ownership
- `sq_games` - Games with scores, round, status
- `sq_winners` - Winner records with win_type and payout

### Future Enhancements
- [ ] Animated number reveal when commissioner locks grid
- [ ] Live score API integration
- [ ] "Current winning square" highlight during live games
- [ ] Push notifications when your square wins

---

## Pool Type #2: Single Game Squares (Super Bowl Squares)

### Status: MOSTLY IMPLEMENTED

### Overview
Same 10x10 grid mechanics as NFL Playoff Squares, but for a single game with more granular scoring options.

### Scoring Mode A: Every Score Change - IMPLEMENTED
- [x] Game starts 0-0 with automatic first winner
- [x] Every score change during game creates winners
- [x] Forward winner (green) and reverse winner (red) for each score
- [x] Both forward + reverse shown with diagonal gradient split
- [x] Score change log with newest first
- [x] Commissioner can add score changes via dialog
- [x] Validation: scores cannot decrease
- [x] Validation: only one team can score at a time
- [x] Validation: score must change from previous entry
- [x] Delete score change with cascade warning
- [x] Final score winners highlighted in purple/fuchsia
- [x] Final Score Winners card with prominent display
- [x] Payout leaderboard

### Scoring Mode B: Quarter Scoring (Traditional) - NOT TESTED
- [x] Database and UI support exists
- [x] Q1, Halftime, Q3, Final score entry
- [ ] Needs end-to-end testing

### Color Scheme (Score Change Mode)
| State | Color |
|-------|-------|
| Forward winner | Emerald/Green |
| Reverse winner | Rose/Red |
| Both forward + reverse | Green/Rose diagonal gradient |
| Final forward | Purple |
| Final reverse | Fuchsia |
| Final both | Purple/Fuchsia diagonal gradient |

### Database Additions (Implemented)
- `sq_pools.mode` - 'full_playoff' or 'single_game'
- `sq_pools.scoring_mode` - 'quarter' or 'score_change'
- `sq_pools.q1_payout`, `halftime_payout`, `q3_payout`, `final_payout`
- `sq_pools.per_change_payout`, `final_bonus_payout`
- `sq_score_changes` - Track all score changes with order
- Win types: 'score_change', 'score_change_reverse', 'score_change_final', 'score_change_final_reverse', 'q1', 'q1_reverse', 'q3', 'q3_reverse'

### Remaining Work
- [ ] Test quarter scoring mode end-to-end
- [ ] Verify payout calculations are correct
- [ ] Consider live score API integration

---

## Pool Type #3: March Madness Blind Draw

### Status: DESIGNED, NOT IMPLEMENTED

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

## Pool Type #4: NFL Survivor (Future)

### Status: NOT DESIGNED

*To be designed - Pick one team per week, can't reuse, eliminated on loss*

---

## Pool Type #5: Weekly Pick'em (Future)

### Status: NOT DESIGNED

*To be designed - Pick winners each week, straight up or against spread*

---

## Implementation Priority
1. **NFL Playoff Squares** - DONE
2. **Single Game Squares** - DONE (needs quarter mode testing)
3. **March Madness Blind Draw** - March timing, spread-based advancement
4. **NFL Survivor** - September timing, simple mechanics
5. **Weekly Pick'em** - Anytime, most flexible
