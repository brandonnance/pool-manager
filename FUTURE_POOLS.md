# BN Pools - Future Pool Types Roadmap

## Current State
- **Bowl Buster** ✅ Complete and live at pools.brandon-nance.com
  - Bowl game picks with margin-of-victory scoring
  - CFP bracket picker
  - Demo mode for testing

---

## Pool Type #1: NFL Playoff Squares

### Overview
Classic 10x10 squares grid for NFL playoff games. Players claim squares, numbers are randomly assigned after grid is full, and winners are determined by the last digit of each team's score.

### Core Mechanics
- **Grid**: 10x10 = 100 squares
- **Axes**: Rows = Home team score (last digit), Columns = Away team score (last digit)
- **Number Assignment**: Random 0-9 assigned to each axis AFTER all squares are claimed
- **Winning**: Match the last digit of each team's final score to find winning square

### Configuration Options
| Setting | Default | Description |
|---------|---------|-------------|
| Max squares per player | Unlimited | Optional limit on squares per person |
| Reverse scoring | On | Both (H=3,A=7) and (H=7,A=3) win |
| Halftime scoring | Super Bowl only | Pay out at halftime for specific games |
| Grid view mode | Random | Toggle: "Random" (original positions) or "Ordered" (0-9 sorted) |

### Payout Structure
- Fixed payout per game for normal winner
- Fixed payout per game for reverse winner (if different square)
- Payout amounts increase by round:
  - Wild Card: $X
  - Divisional: $Y
  - Conference Championship: $Z
  - Super Bowl: $W (includes halftime payout)
- If same square wins both normal + reverse (e.g., 0-0, 5-5), that person gets both prizes

### NFL Playoff Structure
Games are pre-populated with the standard bracket (team names optional/cosmetic):
- **Wild Card Round**: 6 games (3 AFC, 3 NFC)
- **Divisional Round**: 4 games (2 AFC, 2 NFC)
- **Conference Championships**: 2 games (AFC, NFC)
- **Super Bowl**: 1 game (includes halftime payout)
- **Total**: 13 games

Commissioner can optionally add team names for display, but scoring works regardless.

### User Flow
1. **Commissioner creates pool** → Sets payout structure, reverse on/off
2. **Games auto-populate** → 13 playoff games with round labels
3. **Players join and claim squares** → Click on available squares in grid UI
4. **Grid fills up** → Commissioner locks grid and triggers number randomization
5. **Games play out** → Commissioner enters scores, system auto-determines winners
6. **Payouts tracked** → Show who won what per game

### Database Schema (Proposed)

```sql
-- Squares pool configuration
CREATE TABLE sq_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  reverse_scoring BOOLEAN DEFAULT true,
  max_squares_per_player INTEGER, -- NULL = unlimited
  numbers_locked BOOLEAN DEFAULT false,
  row_numbers INTEGER[], -- [0-9] shuffled, NULL until locked
  col_numbers INTEGER[], -- [0-9] shuffled, NULL until locked
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual squares ownership
CREATE TABLE sq_squares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sq_pool_id UUID REFERENCES sq_pools(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL CHECK (row_index >= 0 AND row_index <= 9),
  col_index INTEGER NOT NULL CHECK (col_index >= 0 AND col_index <= 9),
  user_id UUID REFERENCES auth.users(id),
  claimed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sq_pool_id, row_index, col_index)
);

-- Games included in the squares pool
CREATE TABLE sq_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sq_pool_id UUID REFERENCES sq_pools(id) ON DELETE CASCADE,
  game_name TEXT NOT NULL, -- "Chiefs vs Ravens - Divisional"
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  round TEXT, -- 'wild_card', 'divisional', 'conference', 'super_bowl'
  pays_halftime BOOLEAN DEFAULT false,
  halftime_home_score INTEGER,
  halftime_away_score INTEGER,
  status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, final
  game_time TIMESTAMPTZ,
  normal_payout DECIMAL(10,2),
  reverse_payout DECIMAL(10,2),
  halftime_payout DECIMAL(10,2)
);

-- Winners log
CREATE TABLE sq_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sq_game_id UUID REFERENCES sq_games(id) ON DELETE CASCADE,
  square_id UUID REFERENCES sq_squares(id),
  win_type TEXT NOT NULL, -- 'normal', 'reverse', 'halftime', 'halftime_reverse'
  payout DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### UI Components Needed
- **SquaresGrid** - 10x10 clickable grid showing ownership
- **SquareCell** - Individual square with owner name/initials, highlight on hover
- **NumbersOverlay** - Show row/column numbers after reveal
- **ClaimSquareButton** - Click to claim available square
- **GameScoreCard** - Show game, score, winning square highlighted
- **PayoutSummary** - Who won what across all games

### Key Features
- [ ] Visual grid with color-coded ownership (your squares highlighted in distinct color)
- [ ] Click-to-claim squares before numbers revealed
- [ ] Animated number reveal when commissioner locks grid
- [ ] Toggle: View grid in random order vs. sorted 0-9 order
- [ ] Won squares get special shading/highlight (cumulative across games)
- [ ] Leaderboard showing total winnings per player
- [ ] Manual score entry by commissioner

### Future Enhancements
- [ ] Live score API integration
- [ ] "Current winning square" highlight during live games
- [ ] Push notifications when your square wins

---

## Pool Type #2: Single Game Squares (Super Bowl Squares)

### Overview
Same 10x10 grid mechanics as NFL Playoff Squares, but for a single game with more granular scoring options.

### Scoring Options (Commissioner Picks One)

#### Option A: Every Score Change
- Game starts 0-0 → automatic first winner (forward + reverse if enabled)
- Every score change during the game creates a winner
- Forward winner gets set payout
- Reverse winner gets set payout (if enabled)
- Final score winner gets remaining pot after all payouts

**Example flow:**
| Score | Forward Winner | Reverse Winner |
|-------|---------------|----------------|
| 0-0 (start) | 0-0 square | 0-0 square |
| 7-0 | 7-0 square | 0-7 square |
| 7-3 | 7-3 square | 3-7 square |
| 14-3 | 4-3 square | 3-4 square |
| ... | ... | ... |
| Final: 31-17 | 1-7 square (BIG payout) | 7-1 square |

#### Option B: Quarter Scoring (Traditional)
- **End of Q1**: Forward + Reverse winners
- **Halftime**: Forward + Reverse winners
- **End of Q3**: Forward + Reverse winners
- **Final Score**: Forward + Reverse winners (includes OT)

**Payout structure**: Commissioner sets payout per quarter (can be equal or escalating)

### Configuration Options
| Setting | Default | Description |
|---------|---------|-------------|
| Scoring mode | Quarter | "Every Score Change" or "Quarter Scoring" |
| Reverse scoring | On | Pay reverse winners |
| Per-change payout | $X | (Score Change mode) Fixed payout per score change |
| Final score bonus | Remainder | (Score Change mode) What's left after payouts |
| Q1 payout | $X | (Quarter mode) |
| Halftime payout | $X | (Quarter mode) |
| Q3 payout | $X | (Quarter mode) |
| Final payout | $X | (Quarter mode) |

### Database Additions
```sql
-- Extends sq_pools for single game mode
ALTER TABLE sq_pools ADD COLUMN scoring_mode TEXT DEFAULT 'quarter'; -- 'quarter' or 'score_change'
ALTER TABLE sq_pools ADD COLUMN per_change_payout DECIMAL(10,2);
ALTER TABLE sq_pools ADD COLUMN final_bonus_payout DECIMAL(10,2);

-- For score change mode, track all score changes
CREATE TABLE sq_score_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sq_game_id UUID REFERENCES sq_games(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  change_order INTEGER NOT NULL, -- 1, 2, 3...
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### UI Additions
- **Scoring mode selector** in pool creation
- **Live score change log** for "Every Score Change" mode
- **Quarter score entry** for traditional mode
- **Running payout tracker** showing cumulative winnings

---

## Pool Type #3: March Madness Blind Draw

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

### Configuration Options
| Setting | Default | Description |
|---------|---------|-------------|
| Entry fee | $X | Cost per entry |
| Sweet 16 payout % | TBD | % of pot for reaching Sweet 16 |
| Elite 8 payout % | TBD | % of pot for reaching Elite 8 |
| Final Four payout % | TBD | % of pot for reaching Final Four |
| Runner-up payout % | TBD | % of pot for runner-up |
| Champion payout % | TBD | % of pot for champion |

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

### UI Components Needed
- **BlindDrawGrid** - Show all 64 players and their current teams
- **BracketView** - Standard tournament bracket with spread info
- **TeamCard** - Team with seed, owner, and elimination status
- **SpreadEntry** - Commissioner enters game spreads
- **ResultsEntry** - Commissioner enters final scores
- **PayoutTracker** - Who has cashed and for how much

### Key Features
- [ ] Random team assignment (triggered by commissioner after First Four)
- [ ] Visual bracket showing ownership and spreads
- [ ] Team inheritance when advancing via non-cover
- [ ] Automatic advancement calculation based on spread
- [ ] Round-by-round payout distribution
- [ ] "My Journey" view showing your team history

### Complexity Notes
- Need to handle spread ties (push) - typically goes to favorite?
- Commissioner needs to enter spreads before each round (or pull from API)
- Team ownership transfer needs clear visual indication

---

## Pool Type #4: NFL Survivor (Future)

*To be designed - Pick one team per week, can't reuse, eliminated on loss*

---

## Pool Type #5: Weekly Pick'em (Future)

*To be designed - Pick winners each week, straight up or against spread*

---

## Implementation Priority
1. **NFL Playoff Squares** - January timing, unique visual UI
2. **Single Game Squares** - Super Bowl timing, shares grid UI with #1
3. **March Madness Blind Draw** - March timing, spread-based advancement
4. **NFL Survivor** - September timing, simple mechanics
5. **Weekly Pick'em** - Anytime, most flexible
