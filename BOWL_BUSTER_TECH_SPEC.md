# Bowl Buster — Technical Spec for Future Re-implementation

> **Purpose**: This document captures the high-level mechanics of the Bowl Buster pool type before its code is removed. The code remains in git history. This spec is intentionally high-level — AI models and dev tooling will be significantly better by the time football season returns. Design the implementation fresh; use this only as a requirements reference.

---

## Pool Lifecycle

**States**: `draft` → `open` → `completed`

- **Draft**: Commissioner configures games, CFP bracket, and pool settings. Members cannot make picks.
- **Open**: Members create entries, make bowl picks and CFP bracket picks. Commissioner enters scores. Standings visible.
- **Completed**: Commissioner marks pool complete when all games are final. Rank-1 entry highlighted as champion.

There is no explicit "locked" state — locking is per-game (bowls) or per-bracket (CFP), computed client-side from timestamps.

---

## Entry System

- One entry per user per pool (enforced by unique constraint)
- Entry must be created before making any picks
- Entry creation requires approved pool membership

---

## Bowl Games

### Commissioner Setup
- Add games with: home team, away team, game name, kickoff date/time, home spread
- Teams selected via autocomplete from `bb_teams` table; new teams can be created inline
- Games are classified as `kind: 'bowl'` or `kind: 'cfp'`
- Commissioner enters scores and sets game status: `scheduled` → `in_progress` → `final`

### Member Picks
- One pick per game: user selects which team will win (home or away)
- Picks saved immediately via upsert (optimistic UI)
- Spread displayed for reference but does NOT affect which team is picked

### Pick Locking
- Each bowl game locks individually, **5 minutes before kickoff** (`kickoff_at`)
- Also locked when game status is `in_progress` or `final`
- **Demo mode** (`pool.demo_mode = true`) bypasses all locking

---

## Scoring: Margin-of-Victory

Only bowl games (`kind = 'bowl'`) contribute to scoring. CFP picks exist but are NOT scored.

For each finalized bowl game with a pick:
- **Correct pick** (picked the winner): `+margin` (margin = absolute score difference)
- **Wrong pick** (picked the loser): `-margin`
- **Tie game** (equal scores): 0 points, not counted as correct or wrong

**Standings**: Entries ranked by total score descending. Tied scores share the same rank.

**Key implication**: Blowout games have more impact than close games. A 42-7 game is worth ±35 points while a 21-20 game is worth ±1.

---

## CFP Bracket (12-Team Format)

### Structure
```
R1A: #8 vs #9   → winner plays #1 bye → QFA
R1B: #7 vs #10  → winner plays #2 bye → QFB
R1C: #6 vs #11  → winner plays #3 bye → QFC
R1D: #5 vs #12  → winner plays #4 bye → QFD

SFA: QFA winner vs QFD winner
SFB: QFB winner vs QFC winner
F:   SFA winner vs SFB winner
```

### Commissioner Setup
1. **Enable CFP**: Select bracket template, set lock date/time
2. **Assign bye teams** (seeds 1-4): 4 team autocompletes
3. **Configure Round 1 matchups** (R1A-R1D): Select higher/lower seed teams, set game name, kickoff, spread
4. **Configure later rounds** (QF/SF/F): Only game name and kickoff (teams determined by bracket advancement)

### Member Bracket Picks
- 11 total picks: 4 R1 + 4 QF + 2 SF + 1 Championship
- Available teams in each slot derive from prior-round picks (bracket flow)
- **Downstream clearing**: Changing a pick auto-clears all dependent downstream picks
- The entire CFP bracket locks at a single `cfp_lock_at` timestamp (unlike bowls which lock per-game)
- Demo mode bypasses CFP locking

### Pick Deletion Rules
- Changing any bye team or R1 team: **deletes ALL CFP picks for ALL users** in the pool
- Rationale: cascading bracket dependencies make partial updates impractical

### Auto-Population Trigger
A DB trigger (`cfp_auto_populate_trigger`) fires when games are marked `final` and automatically populates next-round games with the winning team. Flow:
- R1 winner + bye team → QF game
- QF winners → SF game (QFA+QFD → SFA, QFB+QFC → SFB)
- SF winners → Final (when both SF games are final)

---

## Onboarding Wizard

4-step wizard for new users (redirected when user has no org memberships):

1. **Organization**: Create org (user becomes admin)
2. **Pool**: Choose type (Bowl Buster or Squares), set name. Creates pool as `draft`
3. **Games**: Bowl Buster only — option to add games now or skip (Squares skips this step)
4. **Invite**: Auto-generates join link (7-day expiry). User copies link and proceeds to pool

State maintained via URL search params (`step`, `orgId`, `poolId`, `poolType`).

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `bb_teams` | **SHARED** — Team catalog used by Bowl Buster AND March Madness. Do NOT delete. |
| `bb_games` | Individual games: name, kickoff, status, scores, spread, teams |
| `bb_pool_games` | Links games to pools. `kind`: `'bowl'` or `'cfp'` |
| `bb_entries` | User entries (1 per user per pool) |
| `bb_bowl_picks` | User picks for bowl games (entry_id, pool_game_id, picked_team_id) |
| `bb_cfp_pool_config` | CFP configuration per pool (template, lock time) |
| `bb_cfp_templates` | Bracket format definitions |
| `bb_cfp_template_slots` | Slot definitions within a template (round, dependencies) |
| `bb_cfp_pool_byes` | Bye team assignments (seeds 1-4) |
| `bb_cfp_pool_round1` | Round 1 matchup config (teams, game references) |
| `bb_cfp_pool_slot_games` | Game assignments for QF/SF/F slots |
| `bb_cfp_entry_picks` | User bracket picks per slot |

### Key Relationship
```
pools → bb_entries → bb_bowl_picks (per pool_game)
                   → bb_cfp_entry_picks (per slot)
pools → bb_pool_games → bb_games → bb_teams
pools → bb_cfp_pool_config → bb_cfp_templates → bb_cfp_template_slots
pools → bb_cfp_pool_byes → bb_teams
pools → bb_cfp_pool_round1 → bb_teams + bb_games
pools → bb_cfp_pool_slot_games → bb_games
```

---

## What Worked Well

- **Margin-of-victory scoring** — Simple to understand, creates interesting strategy around blowout games vs close games
- **Per-game pick locking** — Each bowl game locks independently based on kickoff time, allowing users to wait until last minute for injury/weather info
- **Onboarding wizard** — Guided first-time users through org → pool → games → invite flow
- **CFP auto-population trigger** — Server-side bracket advancement kept state consistent

## What to Improve

- **CFP bracket UX was confusing** — Too many separate forms/pages for setup. Consider a single guided flow.
- **CFP picks not scored** — Feature was built but scoring was never implemented. Design CFP scoring from the start (e.g., points per correct advancement, escalating by round)
- **Too many DB tables for CFP** — 7 tables just for CFP config is heavy. Consider JSONB bracket config on the pool.
- **Onboarding was Bowl Buster-specific** — Should be generic across all pool types
- **No spread-based scoring option** — Some users expect ATS (against-the-spread) scoring as an alternative to straight-up margin-of-victory
- **No notifications** — Users had to manually check for game results and deadline reminders

---

## Architecture Notes

- All Bowl Buster mutations use **direct Supabase client calls** from `'use client'` components — no API routes
- Security is enforced entirely by **RLS policies** on `bb_*` tables
- Standings calculated **server-side on every page load** (no caching)
- Demo mode is a boolean on the pool that bypasses all time-based locking
- Spread is informational only — displayed to users but doesn't affect scoring
