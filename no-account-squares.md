# No-Account Squares Pool Implementation

## Summary
Add a "No-Account Squares" pool type where participants don't need user accounts. The commissioner manually assigns squares to names (text), tracks payment status, and shares a public URL for viewing.

## Key Features
- **Commissioner-controlled squares**: Click to assign names (no user accounts for participants)
- **Verified/paid toggle**: Commissioner tracks who has paid (hidden from public)
- **Public URL**: Custom slug like `/view/superbowl2026` (no auth required)
- **Both modes**: Single game (quarter or score_change) OR full playoffs
- **Bulk assign**: Dialog to assign multiple squares to one name

## User Decisions
- Grid format: **00-99** (row 0-9 x column 0-9)
- Number lock: **Manual trigger** by commissioner
- Public URL: **Custom slug** (commissioner sets readable name)
- Scoring modes: **Both** (quarter and score_change) available
- Game modes: **Both** (single game and full playoffs) available
- Max squares: **No limit** (commissioner decides)
- Lock trigger: **After numbers locked** - public page shows games/scores
- Bulk assign: **Yes** - both one-at-a-time and bulk dialog
- Unassign: **Yes** - commissioner can clear squares

---

## Implementation Status

### Completed

- [x] **Phase 1: Database Changes**
  - [x] Migration: `add_no_account_squares_support` (no_account_mode, public_slug, participant_name, verified)
  - [x] Migration: `add_no_account_rls_policies` (anonymous access for public view)
  - [x] REPLICA IDENTITY FULL on sq_squares (for realtime DELETE events)
  - [x] Regenerate TypeScript types

- [x] **Phase 2: Public View Page**
  - [x] `frontend/src/app/view/[slug]/page.tsx` - Public view page
  - [x] Shows grid, games, scores, winners, leaderboard
  - [x] No auth required, anonymous Supabase client

- [x] **Phase 3: No-Account Grid Components**
  - [x] `frontend/src/components/squares/no-account-square-cell.tsx`
  - [x] `frontend/src/components/squares/no-account-squares-grid.tsx`
  - [x] Winner highlighting with round-specific colors
  - [x] Legend for all win states (forward, reverse, both, final)

- [x] **Phase 4: Commissioner Assignment Dialogs**
  - [x] `frontend/src/components/squares/assign-name-dialog.tsx` - Single square assignment
  - [x] `frontend/src/components/squares/bulk-assign-dialog.tsx` - Multi-square assignment
  - [x] Autocomplete for participant names (fetches existing names, keyboard navigation)

- [x] **Phase 5: Settings & Pool Creation**
  - [x] `frontend/src/components/squares/no-account-pool-settings.tsx` - Commissioner settings
  - [x] Improved URL display (full-width box, copy/open buttons)
  - [x] `frontend/src/components/pools/create-pool-button.tsx` - No-account mode toggle, slug input

- [x] **Phase 6: Integration**
  - [x] `frontend/src/app/(dashboard)/pools/[id]/page.tsx` - Detects no_account_mode
  - [x] `frontend/src/components/squares/no-account-single-game-content.tsx` - Single game wrapper
  - [x] `frontend/src/components/squares/no-account-playoff-content.tsx` - Playoffs wrapper
  - [x] Score entry for score_change mode (add score changes, mark final)

- [x] **Realtime Updates**
  - [x] `frontend/src/components/squares/public-realtime-grid.tsx` - Public view realtime
  - [x] Commissioner view realtime (both single-game and playoff content)
  - [x] Instant updates via WebSocket for INSERT, UPDATE, DELETE on sq_squares

- [x] **Members Page Adjustments**
  - [x] Hide invite links section for no-account pools
  - [x] Hide pending requests for no-account pools
  - [x] Show only commissioners (not regular members)
  - [x] Hide Squares column for no-account pools

---

## Known Issues / TODO

### High Priority (Usability)

1. **Public view axis labels show "TBD" instead of team names**
   - Public view should show "HOME" and "AWAY" (or actual team names) on the grid axes
   - Currently shows generic labels; should match commissioner view

2. **Public view doesn't auto-refresh on lock**
   - When commissioner locks numbers, the public view should automatically update
   - Currently requires manual page refresh to see:
     - Axis numbers (instead of "?")
     - Games section
     - Winners/leaderboard
   - Solution: Add realtime subscription for sq_pools.numbers_locked changes, or page refresh trigger

3. **Commissioner can't set team names for playoff games after lock**
   - Full playoff mode: No way to enter/edit team names for games
   - Would be nice to have team name editing in commissioner view
   - Lower priority but improves UX

### Lower Priority

4. **Quarter scoring mode not implemented for no-account**
   - Score entry only works for `score_change` mode
   - Quarter mode (Q1, halftime, Q3, final) needs implementation
   - Note in `NoAccountScoreEntry`: "Quarter mode not yet implemented for no-account"

5. **Live scoring for public view**
   - Score changes don't push to public view in realtime
   - Will work on later - currently only squares updates are realtime

---

## Files Created

| File | Purpose |
|------|---------|
| `frontend/src/app/view/[slug]/page.tsx` | Public view page |
| `frontend/src/components/squares/no-account-square-cell.tsx` | Cell with name/verified styling |
| `frontend/src/components/squares/no-account-squares-grid.tsx` | Grid for no-account mode |
| `frontend/src/components/squares/assign-name-dialog.tsx` | Single square assignment w/ autocomplete |
| `frontend/src/components/squares/bulk-assign-dialog.tsx` | Multi-square assignment |
| `frontend/src/components/squares/no-account-pool-settings.tsx` | Commissioner settings |
| `frontend/src/components/squares/no-account-single-game-content.tsx` | Single game wrapper |
| `frontend/src/components/squares/no-account-playoff-content.tsx` | Playoffs wrapper |
| `frontend/src/components/squares/public-realtime-grid.tsx` | Realtime grid for public view |

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/app/(dashboard)/pools/[id]/page.tsx` | Detect no_account_mode, route to components |
| `frontend/src/app/(dashboard)/pools/[id]/members/page.tsx` | Hide invite links, show only commissioners |
| `frontend/src/components/pools/create-pool-button.tsx` | Add no-account toggle and slug input |
| `frontend/src/types/database.ts` | Regenerated after migrations |

---

## Database Changes Applied

```sql
-- sq_pools new columns
no_account_mode boolean NOT NULL DEFAULT false
public_slug text (unique where not null, format validated)

-- sq_squares new columns
participant_name text
verified boolean DEFAULT false

-- sq_squares.user_id made nullable

-- RLS policies for anonymous access to public pools

-- REPLICA IDENTITY FULL on sq_squares (for realtime DELETE filtering)
ALTER TABLE sq_squares REPLICA IDENTITY FULL;
```

---

## Visual Reference

### Commissioner View - Before Lock
```
+----+----+----+----+----+----+----+----+----+----+----+
|    | ?  | ?  | ?  | ?  | ?  | ?  | ?  | ?  | ?  | ?  | <- Numbers not assigned yet
+----+----+----+----+----+----+----+----+----+----+----+
| ?  | 00 | 01 | 02 |Bob | 04 | 05 |Sue | 07 | 08 | 09 |
+----+----+----+----+green----+----+red-/----+----+----+
| ?  | 10 | 11 |Tom | 13 | 14 | 15 | 16 | 17 | 18 | 19 |
     gray gray  red/               gray
```
- Gray = available (shows grid number)
- Green = assigned + verified
- Red diagonal = assigned + NOT verified

### Public View - After Lock
```
+----+----+----+----+----+----+----+----+----+----+----+
|    | 3  | 7  | 1  | 9  | 0  | 5  | 2  | 8  | 4  | 6  | <- Random numbers
+----+----+----+----+----+----+----+----+----+----+----+
| 2  |    |    |    |Bob |    |    |Sue |    |    |    |
| 8  |    |    |Tom |    |    |    |    |    |    |    |
```
- No verified styling visible
- Shows names for claimed, empty for available
