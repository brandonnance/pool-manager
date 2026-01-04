# Plan: Simplify Pool Creation Experience

## Overview
Simplify the pool creation flow by:
1. Adding super-admin site settings for pool type enable/disable
2. Removing member-joining squares mode (keeping only no-account mode)
3. Restructuring admin pages with dropdown navigation
4. Simplifying the create pool dialog

---

## Phase 1: Database Schema ✅ COMPLETED

### Migration: `create_site_settings_table`
Created `site_settings` table with key-value storage for:
- `pool_types` - `{"bowl_buster": true, "playoff_squares": true}`
- `nfl_playoff_games` - Array of game templates

RLS: Super admins only can read/write directly.

### RPC Function: `get_enabled_pool_types()`
- Security definer function callable by any authenticated user
- Returns which pool types are enabled for the create pool dialog

---

## Phase 2: Admin UI Restructure ✅ COMPLETED

### 2.1 Create Admin Dropdown Component
**Created:** `frontend/src/components/admin/admin-dropdown.tsx`
- Dropdown with "Users" and "Site Settings" links
- Uses existing shadcn dropdown pattern

### 2.2 Update Navigation
**Modified:** `frontend/src/app/(dashboard)/layout.tsx`
- Replaced single "Users" link with AdminDropdown component

**Modified:** `frontend/src/components/nav/mobile-nav.tsx`
- Added both admin links for mobile

### 2.3 Create Site Settings Page
**Created:** `frontend/src/app/(dashboard)/admin/settings/page.tsx`
- Super admin access check
- Pool Types section with toggles
- NFL Playoff Games management section

### 2.4 Create Settings Components
**Created:** `frontend/src/components/admin/pool-types-settings.tsx`
- Toggle switches for Bowl Buster and Squares

**Created:** `frontend/src/components/admin/nfl-games-settings.tsx`
- Table view to edit NFL playoff game templates
- Add/remove games, edit names, rounds, display order

---

## Phase 3: Simplify Create Pool Dialog ✅ COMPLETED

**Modified:** `frontend/src/components/pools/create-pool-button.tsx`

Changes:
1. Fetch enabled pool types via RPC, only show enabled types
2. Removed "No-Account Mode" toggle - always on
3. Removed "Max Squares per Player" input - member mode only
4. Removed "Management Mode" label
5. Always auto-generate public slug from pool name
6. Fetch NFL playoff games from site_settings instead of hardcoded constant
7. Always set `no_account_mode: true` when creating squares pools

**Created:** `frontend/src/lib/site-settings.ts`
- `getEnabledPoolTypes()` - Fetch from database
- `getNflPlayoffGamesTemplate()` - Fetch from database with fallback

---

## Phase 4: Remove Member-Joining Squares Code ✅ COMPLETED

### Files DELETED (7 files)
| File | Purpose |
|------|---------|
| `frontend/src/components/squares/assign-square-button.tsx` | Member mode assignment |
| `frontend/src/components/squares/playoff-squares-content.tsx` | Member mode playoff |
| `frontend/src/components/squares/single-game-squares-content.tsx` | Member mode single game |
| `frontend/src/components/squares/squares-grid.tsx` | Member mode grid |
| `frontend/src/components/squares/square-cell.tsx` | Member mode cell |
| `frontend/src/components/squares/squares-pool-settings.tsx` | Member mode settings |
| `frontend/src/components/squares/__tests__/square-cell.test.tsx` | Member mode cell tests |

### Files RENAMED (6 files)
| Current | New |
|---------|-----|
| `no-account-playoff-content.tsx` | `playoff-content.tsx` |
| `no-account-single-game-content.tsx` | `single-game-content.tsx` |
| `no-account-squares-grid.tsx` | `squares-grid.tsx` |
| `no-account-square-cell.tsx` | `square-cell.tsx` |
| `no-account-pool-settings.tsx` | `pool-settings.tsx` |
| `no-account-square-cell.test.tsx` | `square-cell.test.tsx` |

### Additional Updates
- Fixed circular import in `square-cell.tsx`, exported `WinningRound` type
- Renamed `NoAccountSquare` to `Square` in `squares-grid.tsx`
- Updated `payout-leaderboard.tsx` to use `participant_name` (no-account mode)
- Updated `game-score-card.test.tsx` for new Square type

### Files KEPT unchanged (11 shared files)
- `assign-name-dialog.tsx`
- `bulk-assign-dialog.tsx`
- `edit-game-teams-button.tsx`
- `enter-squares-score-button.tsx`
- `game-score-card.tsx`
- `participant-summary-panel.tsx`
- `payout-leaderboard.tsx` (updated for no-account mode)
- `public-realtime-grid.tsx`
- `public-realtime-games.tsx`
- `score-change-log.tsx`
- `single-game-score-entry.tsx`

### Updated Pool Detail Page
**Modified:** `frontend/src/app/(dashboard)/pools/[id]/page.tsx`
- Removed conditional branches checking `no_account_mode`
- Simplified to just check `mode` (single_game vs full_playoff)
- Updated imports to use renamed components

---

## Verification ✅

- TypeScript compiles without errors
- Build succeeds
- All 232 tests pass

---

## Files Summary

### New Files (6)
- `frontend/src/components/admin/admin-dropdown.tsx`
- `frontend/src/app/(dashboard)/admin/settings/page.tsx`
- `frontend/src/components/admin/pool-types-settings.tsx`
- `frontend/src/components/admin/nfl-games-settings.tsx`
- `frontend/src/lib/site-settings.ts`
- Migration file (via Supabase MCP)

### Modified Files (5)
- `frontend/src/app/(dashboard)/layout.tsx` - Admin dropdown
- `frontend/src/components/nav/mobile-nav.tsx` - Admin links
- `frontend/src/components/pools/create-pool-button.tsx` - Simplify dialog
- `frontend/src/app/(dashboard)/pools/[id]/page.tsx` - Remove member mode branches
- `frontend/src/components/squares/payout-leaderboard.tsx` - Use participant_name

### Deleted Files (7)
- `frontend/src/components/squares/assign-square-button.tsx`
- `frontend/src/components/squares/playoff-squares-content.tsx`
- `frontend/src/components/squares/single-game-squares-content.tsx`
- `frontend/src/components/squares/squares-grid.tsx` (member mode)
- `frontend/src/components/squares/square-cell.tsx` (member mode)
- `frontend/src/components/squares/squares-pool-settings.tsx`
- `frontend/src/components/squares/__tests__/square-cell.test.tsx` (member mode)

### Renamed Files (6)
- `no-account-playoff-content.tsx` → `playoff-content.tsx`
- `no-account-single-game-content.tsx` → `single-game-content.tsx`
- `no-account-squares-grid.tsx` → `squares-grid.tsx`
- `no-account-square-cell.tsx` → `square-cell.tsx`
- `no-account-pool-settings.tsx` → `pool-settings.tsx`
- `no-account-square-cell.test.tsx` → `square-cell.test.tsx`
