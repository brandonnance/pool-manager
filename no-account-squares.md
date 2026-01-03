# No-Account Squares Pool Implementation

## Summary

Add a "No-Account Squares" pool type where participants don't need user accounts. The commissioner manually assigns squares to names (text), tracks payment status, and shares a public URL for viewing.

## Key Features

- **Commissioner-controlled squares**: Click to assign names (no user accounts for participants)
- **Verified/paid toggle**: Commissioner tracks who has paid (hidden from public)
- **Public URL**: Custom slug like `/view/superbowl2026` (no auth required)
- **Both modes**: Single game (quarter or score_change) OR full playoffs
- **Bulk assign**: Dialog to assign multiple squares to one name
- **Realtime updates**: Grid, games, winners all update live via WebSocket
- **Live winning indicators**: Pulsing animation on currently-winning squares during games

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
  - [x] Axis labels: "Home"/"Away" for playoff mode, team names for single game

- [x] **Phase 3: No-Account Grid Components**

  - [x] `frontend/src/components/squares/no-account-square-cell.tsx`
  - [x] `frontend/src/components/squares/no-account-squares-grid.tsx`
  - [x] Winner highlighting with round-specific colors
  - [x] Legend for all win states (forward, reverse, both, final)
  - [x] `liveWinningSquareIds` prop for pulsing animation during in-progress games

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
  - [x] Edit game teams button for playoff games (`edit-game-teams-button.tsx`)

- [x] **Phase 7: Realtime Updates**

  - [x] `frontend/src/components/squares/public-realtime-grid.tsx` - Public view realtime grid
  - [x] `frontend/src/components/squares/public-realtime-games.tsx` - Public view realtime games/winners
  - [x] Commissioner view realtime (both single-game and playoff content)
  - [x] Instant updates via WebSocket for INSERT, UPDATE, DELETE on sq_squares
  - [x] Realtime enabled on `sq_games`, `sq_winners`, `sq_score_changes` tables in Supabase
  - [x] Public view auto-refreshes when numbers are locked

- [x] **Phase 8: Live Game Experience**

  - [x] Pulsing animation for squares currently winning from in-progress games
  - [x] Game card styling based on status (scheduled=muted, in_progress=amber glow, final=green check)
  - [x] Winner display on each game card (forward winner + reverse winner if enabled)
  - [x] Round hierarchy for winning square colors (higher rounds override lower)

- [x] **Members Page Adjustments**
  - [x] Hide invite links section for no-account pools
  - [x] Hide pending requests for no-account pools
  - [x] Show only commissioners (not regular members)
  - [x] Hide Squares column for no-account pools

- [x] **Phase 9: Bulk Verification & Participant Management**
  - [x] Case-insensitive participant name matching (e.g., "Bobby" and "bobby" are the same person)
  - [x] Name normalization on save (preserves first-used casing)
  - [x] "Verify All" / "Unverify All" buttons in single-square dialog when editing existing assignments
  - [x] Participant summary panel (commissioner only, collapsible)
    - Lists all unique participants with square counts
    - Shows verified/unverified breakdown per participant
    - Bulk verify/unverify buttons per participant
    - Real-time updates via WebSocket
  - [x] Autocomplete suggestions in both single and bulk assign dialogs

- [x] **Phase 10: Final Winner Display**
  - [x] Prominent final winner banner when game is marked final (score_change mode)
  - [x] Shows both forward and reverse winners if applicable
  - [x] Special message when same person wins both directions
  - [x] Displayed on both commissioner view and public view

- [x] **Phase 11: Wins Breakdown**
  - [x] Leaderboard shows forward/reverse breakdown when reverse scoring enabled
  - [x] Format: "5 (2F, 3R)" instead of just "5"
  - [x] Applied to commissioner view (single game & playoffs) and public view

---

## Known Issues / TODO

### Lower Priority

1. **Quarter scoring mode not implemented for no-account**

   - Score entry only works for `score_change` mode
   - Quarter mode (Q1, halftime, Q3, final) needs implementation
   - Note in `NoAccountScoreEntry`: "Quarter mode not yet implemented for no-account"

2. **No dedicated "in progress" winner recording**
   - Currently only record winners when game status is 'final'
   - In-progress games show live winner calculations but don't persist to sq_winners
   - This is intentional (don't want half-game winners in DB) but could be enhanced

---

## Files Created

| File                                                                 | Purpose                                      |
| -------------------------------------------------------------------- | -------------------------------------------- |
| `frontend/src/app/view/[slug]/page.tsx`                              | Public view page (server component)          |
| `frontend/src/components/squares/no-account-square-cell.tsx`         | Cell with name/verified styling              |
| `frontend/src/components/squares/no-account-squares-grid.tsx`        | Grid for no-account mode                     |
| `frontend/src/components/squares/assign-name-dialog.tsx`             | Single square assignment w/ autocomplete     |
| `frontend/src/components/squares/bulk-assign-dialog.tsx`             | Multi-square assignment                      |
| `frontend/src/components/squares/no-account-pool-settings.tsx`       | Commissioner settings                        |
| `frontend/src/components/squares/no-account-single-game-content.tsx` | Single game wrapper                          |
| `frontend/src/components/squares/no-account-playoff-content.tsx`     | Playoffs wrapper                             |
| `frontend/src/components/squares/public-realtime-grid.tsx`           | Realtime grid for public view                |
| `frontend/src/components/squares/public-realtime-games.tsx`          | Realtime games/winners for public view       |
| `frontend/src/components/squares/edit-game-teams-button.tsx`         | Edit team names for playoff games            |
| `frontend/src/components/squares/participant-summary-panel.tsx`      | Commissioner participant overview with bulk verify |

## Files Modified

| File                                                       | Changes                                       |
| ---------------------------------------------------------- | --------------------------------------------- |
| `frontend/src/app/(dashboard)/pools/[id]/page.tsx`         | Detect no_account_mode, route to components   |
| `frontend/src/app/(dashboard)/pools/[id]/members/page.tsx` | Hide invite links, show only commissioners    |
| `frontend/src/components/pools/create-pool-button.tsx`     | Add no-account toggle and slug input          |
| `frontend/src/components/squares/square-cell.tsx`          | WinningRound type export                      |
| `frontend/src/app/globals.css`                             | Live winner pulse & game glow animations      |
| `frontend/src/types/database.ts`                           | Regenerated after migrations                  |

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

### Realtime Enabled Tables

Via Supabase Dashboard > Database > Replication:
- `sq_squares` - Grid updates
- `sq_games` - Score/status updates
- `sq_winners` - Winner records
- `sq_score_changes` - Score change mode updates
- `sq_pools` - Numbers lock status

---

## CSS Animations (globals.css)

```css
/* Live winning square pulse animation */
@keyframes live-winner-pulse {
  0%, 100% {
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.6);
    background-color: rgba(16, 185, 129, 0.15);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.4);
    background-color: rgba(16, 185, 129, 0.25);
  }
}

.animate-live-winner {
  animation: live-winner-pulse 1.5s ease-in-out infinite;
  position: relative;
  z-index: 10;
}

/* In-progress game card glow */
@keyframes game-live-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.3);
  }
  50% {
    box-shadow: 0 0 8px 2px rgba(245, 158, 11, 0.4);
  }
}

.animate-game-live {
  animation: game-live-glow 2s ease-in-out infinite;
}
```

---

## Round Hierarchy for Winning Colors

When a square wins in multiple rounds, the **highest** tier takes precedence for display color:

```typescript
const roundHierarchy: Record<string, number> = {
  wild_card: 1,           // amber/yellow
  divisional: 2,          // emerald/green
  conference: 3,          // red
  super_bowl_halftime: 4, // violet
  super_bowl: 5,          // purple

  // Single game mode
  single_game: 1,         // teal

  // Score change mode
  score_change_forward: 1,
  score_change_reverse: 1,
  score_change_both: 2,
  score_change_final: 3,
  score_change_final_reverse: 3,
  score_change_final_both: 4,
}
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
- Winning squares show round-appropriate colors
- In-progress winning squares pulse with green glow

### Game Card States

- **Scheduled**: Muted background, gray text
- **In Progress**: Amber background, glowing border animation, "Live" badge pulses
- **Final**: White background, green border, checkmark badge

---

## Architecture Notes

### Public View Data Flow

1. Server component (`view/[slug]/page.tsx`) fetches initial data
2. Passes to client components as `initial*` props
3. Client components (`PublicRealtimeGrid`, `PublicRealtimeGames`) set up WebSocket subscriptions
4. Real-time updates merge with local state
5. Winner changes trigger `router.refresh()` to get updated server-calculated highlighting

### Live Winner Calculation

The `PublicRealtimeGrid` component calculates `liveWinningSquareIds` from in-progress games:
1. For each game with `status === 'in_progress'`
2. Calculate last digits of current scores
3. Find matching grid position based on `rowNumbers` and `colNumbers`
4. Add square ID to live winners set
5. If `reverseScoring` enabled, also calculate reverse winner

### Round Hierarchy Implementation

Applied in 3 places for consistency:
- `view/[slug]/page.tsx` (public view)
- `no-account-playoff-content.tsx` (commissioner no-account)
- `playoff-squares-content.tsx` (authenticated users)
