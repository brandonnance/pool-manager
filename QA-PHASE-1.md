# Phase 1A + 1B — Manual QA Checklist

Run through after deploying. Check each box as you go.

---

## 1. Regression: Existing NFL Squares Pools

These should work exactly as before — the rename is transparent.

- [ ] Open an existing NFL squares pool → page loads, no errors
- [ ] Game list shows correct NFL round labels (Wild Card, Divisional, Conference, Super Bowl)
- [ ] Grid renders with correct NFL round legend colors
- [ ] Leaderboard shows round wins formatted correctly (e.g., "2WC, 1D")
- [ ] Enter a score on an NFL game → winner square highlights with correct round color
- [ ] Mark an NFL game final → winner persists, grid updates
- [ ] Public view (`/view/[slug]`) of NFL pool → loads, legend correct, games list correct

## 2. Regression: Existing Single-Game Squares Pools

- [ ] Open an existing single-game pool → page loads, no errors
- [ ] Score entry works, winner squares display correctly
- [ ] Public view works

## 3. New: Create an NFL Playoffs Squares Pool

- [ ] Go to pool creation → "Squares" pool type available (not "Playoff Squares")
- [ ] Select Squares → event type selector shows: NFL Playoffs, March Madness, Single Game
- [ ] Select "NFL Playoffs" → create pool
- [ ] Pool creates successfully with 13 games (6 WC, 4 Div, 2 Conf, 1 SB)
- [ ] `sq_pools.event_type` = `'nfl_playoffs'` in DB

## 4. New: Create a March Madness Squares Pool

- [ ] Select "March Madness" in event type selector → create pool
- [ ] Pool creates successfully with 63 games
- [ ] Games are in correct rounds: 32 R64, 16 R32, 8 S16, 4 E8, 2 F4, 1 Final
- [ ] `sq_pools.event_type` = `'march_madness'` in DB
- [ ] Pool detail page shows MM round labels (Round of 64, Round of 32, Sweet 16, etc.)
- [ ] Grid legend shows 6 MM round colors (slate/amber/emerald/blue/red/purple)

## 5. New: MM Squares Gameplay

- [ ] Assign grid (pick names) → works same as NFL
- [ ] Lock numbers → works same as NFL
- [ ] Enter scores on an R64 game → winner square highlights in slate
- [ ] Enter scores on an S16 game → winner square highlights in emerald
- [ ] Enter scores on Championship game → winner square highlights in purple
- [ ] Leaderboard shows MM abbreviations (e.g., "3R64, 1S16, 1F")
- [ ] Public view header says "March Madness Squares"
- [ ] Public view legend shows MM rounds

## 6. New: Create a Single Game Pool (via new selector)

- [ ] Select "Single Game" in event type selector → scoring mode selector appears
- [ ] Create pool → 1 game created
- [ ] `sq_pools.event_type` = `'single_game'` in DB
- [ ] Pool works as before (enter scores, winner highlights)

## 7. March Madness Blind Draw (1A)

### 7a. Mobile Bracket

- [ ] Open blind draw pool on mobile (or narrow browser window)
- [ ] Round filter buttons visible at top (R64, R32, S16, E8, F4, Final)
- [ ] Buttons show completion counts (e.g., "R64 28/32")
- [ ] Tap a round button → scrolls/filters to that round
- [ ] Current round (first with non-final games) is auto-expanded
- [ ] Completed rounds are collapsed by default
- [ ] Tap collapsed round header → expands to show games

### 7b. Commissioner Dashboard

- [ ] Open MM blind draw pool as commissioner
- [ ] Current round badge shows (e.g., "Round of 64" with colored badge)
- [ ] Progress bar shows X/63 completed
- [ ] "Next Action" card shows: "X games in [round] need scores"
- [ ] After all games final → shows "All complete!" or similar
- [ ] Non-commissioner users see current round + progress (but NOT next action card)

### 7c. Scores API Cleanup

- [ ] Enter score on MM blind draw game → mark as final
- [ ] Losing entry eliminated, teams transferred to winner
- [ ] Next-round game auto-populated with winning team
- [ ] No console errors about duplicate updates
- [ ] Repeat across rounds: R64 → R32 → S16 to verify chain works

## 8. Database Verification

Run these queries to confirm migration integrity:

```sql
-- No playoff_squares values remain
SELECT DISTINCT type FROM pools WHERE type = 'playoff_squares';
-- Should return 0 rows

-- All sq_pools have event_type
SELECT id, event_type FROM sq_pools WHERE event_type IS NULL;
-- Should return 0 rows

-- Check event_type distribution
SELECT event_type, count(*) FROM sq_pools GROUP BY event_type;

-- MM rounds exist in constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname LIKE '%sq_games%round%';
```

## 9. Build & Type Check

- [ ] `npx tsc --noEmit` passes
- [ ] `npx next build` succeeds
- [ ] `npx vitest run` — all tests pass (329+)

---

## Sign-off

| Area | Tested By | Date | Notes |
|------|-----------|------|-------|
| NFL Regression | | | |
| MM Squares Create | | | |
| MM Squares Gameplay | | | |
| Blind Draw Mobile | | | |
| Commissioner Dashboard | | | |
| DB Verification | | | |
