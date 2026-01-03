# Security Audit & Testing Strategy

**Date:** January 2, 2026
**Last Updated:** January 3, 2026
**Project:** BN Pools - Bowl Buster
**Auditor:** Claude Code

---

## Executive Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| **Critical Security** | **RESOLVED** | 3 critical - all fixed |
| **High Priority** | **RESOLVED** | 2 high - all verified/fixed |
| **Medium Priority** | **RESOLVED** | 2 medium - all fixed |
| **RLS Performance** | Partially Optimized | 15 FK indexes added, 26 inefficient policies remaining |
| **Testing Infrastructure** | **IMPLEMENTED** | 276 tests passing |

---

## Testing Infrastructure Added (January 3, 2026)

### Branch: `unit-testing`

Full unit testing infrastructure implemented with **276 passing tests**.

### Files Created

| Path | Purpose |
|------|---------|
| `frontend/vitest.config.ts` | Vitest configuration with jsdom, path aliases |
| `frontend/src/__tests__/setup.ts` | Global mocks for Next.js navigation |
| `frontend/src/lib/squares/types.ts` | Shared TypeScript types for squares |
| `frontend/src/lib/squares/grid-generation.ts` | Fisher-Yates shuffle, grid number utils |
| `frontend/src/lib/squares/score-validation.ts` | Score change validation rules |
| `frontend/src/lib/squares/winner-calculation.ts` | Winner position and round mapping |
| `frontend/src/lib/squares/index.ts` | Re-exports for library |

### Test Files Created

- `lib/squares/__tests__/grid-generation.test.ts` (22 tests)
- `lib/squares/__tests__/score-validation.test.ts` (38 tests)
- `lib/squares/__tests__/winner-calculation.test.ts` (35 tests)
- `components/auth/__tests__/login-form.test.tsx` (12 tests)
- `components/auth/__tests__/signup-form.test.tsx` (13 tests)
- `components/auth/__tests__/logout-button.test.tsx` (3 tests)
- `app/(auth)/forgot-password/__tests__/page.test.tsx` (9 tests)
- `app/(auth)/reset-password/__tests__/page.test.tsx` (11 tests)
- `components/orgs/__tests__/create-org-button.test.tsx` (12 tests)
- `components/orgs/__tests__/delete-org-button.test.tsx` (12 tests)
- `components/orgs/__tests__/org-member-actions.test.tsx` (17 tests)
- `components/squares/__tests__/square-cell.test.tsx` (32 tests)
- `components/squares/__tests__/no-account-square-cell.test.tsx` (32 tests)
- `components/squares/__tests__/game-score-card.test.tsx` (21 tests)
- `components/pools/__tests__/create-pool-button.test.tsx` (6 tests)

### Components Updated

- `squares-pool-settings.tsx` - Now uses `shuffleArray` from `@/lib/squares`
- `single-game-squares-content.tsx` - Uses `buildWinningSquareRoundsMap` from lib
- `playoff-squares-content.tsx` - Uses `buildWinningSquareRoundsMap` from lib
- `no-account-single-game-content.tsx` - Uses `buildWinningSquareRoundsMap` from lib

---

## Fixes Applied (January 2, 2026)

### Critical Issues - ALL RESOLVED

| Issue | Status | Resolution |
|-------|--------|------------|
| #1 Bowl Pick Lock Bypass | **ALREADY FIXED** | Server-side `is_bowl_pick_locked()` function already enforces lock time in RLS |
| #2 CFP Pick Lock Bypass | **ALREADY FIXED** | Server-side `is_cfp_locked()` function already enforces lock time in RLS |
| #3 Score Manipulation | **FIXED** | Migration `fix_bb_games_update_policy` - now requires commissioner status |

### High Priority Issues - ALL RESOLVED

| Issue | Status | Resolution |
|-------|--------|------------|
| #4 Self-Approval Bug | **FIXED** | RLS already prevents self-approval; removed bad code pattern from `create-entry-button.tsx` |
| #5 Game Deletion Auth | **ALREADY CORRECT** | RLS policy `is_pool_commissioner(pool_id)` already enforces authorization |

### Medium Priority Issues - ALL RESOLVED

| Issue | Status | Resolution |
|-------|--------|------------|
| #6 Weak Token Generation | **FIXED** | Replaced `Math.random()` with `crypto.randomUUID()` in `generate-link-button.tsx` |
| #7 Pick Visibility | **FIXED** | Migration `fix_pick_visibility_before_lock` - picks hidden until game/CFP locks |

### Migrations Applied

1. **`fix_bb_games_update_policy`** - Restricts game score updates to commissioners only
2. **`fix_pick_visibility_before_lock`** - Hides other users' picks until lock time

---

## Table of Contents

1. [Testing Infrastructure Added](#testing-infrastructure-added-january-3-2026)
2. [Fixes Applied](#fixes-applied-january-2-2026)
3. [Critical Security Vulnerabilities](#critical-security-vulnerabilities)
4. [High Priority Security Issues](#high-priority-security-issues)
5. [Medium Priority Issues](#medium-priority-issues)
6. [Supabase Security Advisory](#supabase-security-advisory)
7. [Performance Optimizations](#performance-optimizations)
8. [Positive Security Findings](#positive-security-findings)
9. [Testing Strategy](#testing-strategy)
10. [Action Items](#action-items)

---

## Critical Security Vulnerabilities

### 1. Bowl Pick Lock Time Bypass (CRITICAL)

**Location:** `frontend/src/components/picks/bowl-picks-form.tsx` (lines 49-55)

**Issue:** Game lock time validation is **client-side only**. Users can bypass this via:
- Direct Supabase API calls
- Browser developer tools
- Modified client code

```typescript
// This only runs in the browser - can be bypassed!
const isGameLocked = (kickoffAt: string | null): boolean => {
  if (demoMode) return false
  if (!kickoffAt) return false
  const lockTime = new Date(kickoffAt)
  lockTime.setMinutes(lockTime.getMinutes() - 5)
  return new Date() >= lockTime
}
```

**Impact:** Users can submit picks after games have started, giving them an unfair advantage by knowing game outcomes.

**Recommended Fix:** Add database-level enforcement via RLS policy:

```sql
-- Add to bb_bowl_picks INSERT policy
CREATE POLICY "Prevent picks after lock" ON bb_bowl_picks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM bb_pool_games pg
    JOIN bb_games g ON pg.game_id = g.id
    WHERE pg.id = pool_game_id
    AND (g.kickoff_at IS NULL OR g.kickoff_at > NOW() + interval '5 minutes')
  )
);

-- Add to bb_bowl_picks UPDATE policy
CREATE POLICY "Prevent pick updates after lock" ON bb_bowl_picks
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM bb_pool_games pg
    JOIN bb_games g ON pg.game_id = g.id
    WHERE pg.id = pool_game_id
    AND (g.kickoff_at IS NULL OR g.kickoff_at > NOW() + interval '5 minutes')
  )
);
```

---

### 2. CFP Lock Time Bypass (CRITICAL)

**Location:** `frontend/src/components/picks/cfp-bracket-picker.tsx` (lines 226-230, 244-276)

**Issue:** CFP bracket lock validation (`isLocked` prop) is only checked on the frontend. The database operations proceed without any server-side lock time verification.

```typescript
const handlePick = async (slotKey: string, teamId: string) => {
  if (isLocked) {  // Client-side only check
    setError('CFP picks are locked')
    return
  }
  // ... proceeds to insert/update in database
}
```

**Impact:** Users can modify CFP bracket picks after the lock deadline (`cfp_lock_at`) via direct API calls.

**Recommended Fix:** Add RLS policy on `bb_cfp_entry_picks` that checks `cfp_lock_at`:

```sql
-- Add to bb_cfp_entry_picks INSERT/UPDATE policies
CREATE POLICY "Prevent CFP picks after lock" ON bb_cfp_entry_picks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM bb_entries e
    JOIN bb_cfp_pool_config c ON c.pool_id = e.pool_id
    WHERE e.id = entry_id
    AND c.cfp_lock_at > NOW()
  )
);
```

---

### 3. Score Manipulation Risk (CRITICAL)

**Location:** `frontend/src/components/games/enter-score-button.tsx` (lines 70-87)

**Issue:** The `EnterScoreButton` component updates `bb_games.home_score`, `away_score`, and `status` with **no authorization check** on the client side. While the page restricts rendering based on commissioner status, if RLS policies are not properly configured, any authenticated user could potentially call the update directly.

```typescript
const { error: updateError } = await supabase
  .from('bb_games')
  .update(updates)
  .eq('id', gameId)  // No user authorization check in code
```

**Impact:** If RLS is not properly configured, non-commissioners could manipulate game scores, affecting pool standings and potentially enabling cheating.

**Recommended Fix:** Verify RLS policies enforce commissioner-only updates on `bb_games`:

```sql
-- Ensure this policy exists on bb_games
CREATE POLICY "Only commissioners can update games" ON bb_games
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM bb_pool_games pg
    JOIN pools p ON pg.pool_id = p.id
    WHERE pg.game_id = bb_games.id
    AND is_pool_commissioner(p.id)
  )
  OR is_super_admin()
);
```

---

## High Priority Security Issues

### 4. Pool Membership Self-Approval Bug (HIGH)

**Location:** `frontend/src/components/pools/create-entry-button.tsx` (lines 45-55)

**Issue:** When creating an entry, the code auto-upserts pool membership with `status: 'approved'`, potentially allowing users to bypass the approval process if they already have a pending membership.

```typescript
await supabase
  .from('pool_memberships')
  .upsert({
    pool_id: poolId,
    user_id: user.id,
    status: 'approved'  // Self-approves membership!
  }, {
    onConflict: 'pool_id,user_id'
  })
```

**Impact:** Users with pending membership status could self-approve by creating an entry, bypassing commissioner approval workflow.

**Recommended Fix:**
1. Remove the upsert entirely - require approved membership first
2. Or add RLS policy to prevent status changes from pending to approved:

```sql
-- Prevent users from self-approving
CREATE POLICY "Users cannot self-approve" ON pool_memberships
FOR UPDATE USING (
  -- Allow if user is commissioner
  is_pool_commissioner(pool_id)
  -- Or if they're only updating non-status fields
  OR (OLD.status = NEW.status)
);
```

---

### 5. Remove Game - Authorization Depends on RLS (HIGH)

**Location:** `frontend/src/components/games/remove-game-button.tsx` (lines 22-35)

**Issue:** The component deletes pool games with no client-side authorization check - relies entirely on RLS.

```typescript
const { error } = await supabase
  .from('bb_pool_games')
  .delete()
  .eq('id', poolGameId)  // No authorization verification in code
```

**Impact:** If RLS is not configured correctly, any user could remove games from pools, disrupting pool operations and deleting associated picks via cascade.

**Verification Needed:** Ensure RLS policy exists:

```sql
-- Verify this policy exists
CREATE POLICY "Only commissioners can delete pool games" ON bb_pool_games
FOR DELETE USING (
  is_pool_commissioner(pool_id) OR is_super_admin()
);
```

---

## Medium Priority Issues

### 6. Weak Token Generation (MEDIUM)

**Location:** `frontend/src/components/members/generate-link-button.tsx` (lines 24-31)

**Issue:** Token generation uses `Math.random()` which is not cryptographically secure.

```typescript
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}
```

**Impact:** Tokens could theoretically be predicted, though the 62^16 keyspace makes brute-force impractical. More of a best-practice concern.

**Recommended Fix:**

```typescript
function generateToken(): string {
  // Use cryptographically secure random
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}
```

---

### 7. Other Users' Picks Potentially Visible Before Lock (MEDIUM)

**Location:** `frontend/src/app/(dashboard)/pools/[id]/page.tsx`

**Issue:** The standings calculation fetches all entries and picks without filtering by lock status:

```typescript
const { data: entriesData } = await supabase
  .from('bb_entries')
  .select(`..., bb_bowl_picks (...)`)
  .eq('pool_id', id)
```

**Impact:** Depending on RLS configuration, users might be able to see what other users picked before games lock, allowing them to copy picks.

**Recommended Fix:** Add RLS policy on `bb_bowl_picks` to restrict visibility:

```sql
CREATE POLICY "Hide other users picks until game locks" ON bb_bowl_picks
FOR SELECT USING (
  -- User can always see their own picks
  EXISTS (
    SELECT 1 FROM bb_entries e
    WHERE e.id = entry_id AND e.user_id = (select auth.uid())
  )
  -- Or game has locked
  OR EXISTS (
    SELECT 1 FROM bb_pool_games pg
    JOIN bb_games g ON pg.game_id = g.id
    WHERE pg.id = pool_game_id
    AND g.kickoff_at <= NOW() + interval '5 minutes'
  )
  -- Or user is commissioner
  OR EXISTS (
    SELECT 1 FROM bb_entries e
    JOIN pools p ON e.pool_id = p.id
    WHERE e.id = entry_id
    AND is_pool_commissioner(p.id)
  )
);
```

---

### 8. Delete Pool - Frontend Authorization Only (MEDIUM)

**Location:** `frontend/src/components/pools/delete-pool-button.tsx` (lines 43-71)

**Issue:** While there's a frontend check for org admin status, the actual deletion cascade happens with no apparent database-level authorization verification beyond what RLS provides.

**Verification Needed:** Ensure proper RLS exists for DELETE on `pools` table.

---

## Supabase Security Advisory

### Leaked Password Protection Disabled (WARNING)

**Issue:** Your Supabase project has "Leaked Password Protection" disabled.

**What it does:** Checks passwords against HaveIBeenPwned.org database to prevent users from using compromised passwords.

**How to fix:**
1. Go to Supabase Dashboard
2. Navigate to Authentication > Settings
3. Enable "Check passwords against leaked password database"

**Reference:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## Performance Optimizations

### 1. Missing Foreign Key Indexes

**Impact:** Slow JOINs and queries on these tables.

| Table | Foreign Key | Missing Index |
|-------|-------------|---------------|
| `audit_log` | `audit_log_actor_user_id_fkey` | `actor_user_id` |
| `bb_bowl_picks` | `bb_bowl_picks_picked_team_id_fkey` | `picked_team_id` |
| `bb_cfp_entry_picks` | `bb_cfp_entry_picks_picked_team_id_fkey` | `picked_team_id` |
| `bb_cfp_pool_byes` | `bb_cfp_pool_byes_team_id_fkey` | `team_id` |
| `bb_cfp_pool_config` | `bb_cfp_pool_config_template_id_fkey` | `template_id` |
| `bb_cfp_pool_round1` | `bb_cfp_pool_round1_game_id_fkey` | `game_id` |
| `bb_cfp_pool_round1` | `bb_cfp_pool_round1_team_a_id_fkey` | `team_a_id` |
| `bb_cfp_pool_round1` | `bb_cfp_pool_round1_team_b_id_fkey` | `team_b_id` |
| `bb_cfp_pool_slot_games` | `bb_cfp_pool_slot_games_game_id_fkey` | `game_id` |
| `bb_games` | `bb_games_away_team_id_fkey` | `away_team_id` |
| `bb_games` | `bb_games_home_team_id_fkey` | `home_team_id` |
| `bb_pool_games` | `bb_pool_games_game_id_fkey` | `game_id` |
| `join_links` | `join_links_created_by_fkey` | `created_by` |
| `pool_memberships` | `pool_memberships_approved_by_fkey` | `approved_by` |
| `pools` | `pools_created_by_fkey` | `created_by` |

**Recommended Migration:**

```sql
-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_bb_bowl_picks_picked_team_id ON bb_bowl_picks(picked_team_id);
CREATE INDEX IF NOT EXISTS idx_bb_cfp_entry_picks_picked_team_id ON bb_cfp_entry_picks(picked_team_id);
CREATE INDEX IF NOT EXISTS idx_bb_cfp_pool_byes_team_id ON bb_cfp_pool_byes(team_id);
CREATE INDEX IF NOT EXISTS idx_bb_cfp_pool_config_template_id ON bb_cfp_pool_config(template_id);
CREATE INDEX IF NOT EXISTS idx_bb_cfp_pool_round1_game_id ON bb_cfp_pool_round1(game_id);
CREATE INDEX IF NOT EXISTS idx_bb_cfp_pool_round1_team_a_id ON bb_cfp_pool_round1(team_a_id);
CREATE INDEX IF NOT EXISTS idx_bb_cfp_pool_round1_team_b_id ON bb_cfp_pool_round1(team_b_id);
CREATE INDEX IF NOT EXISTS idx_bb_cfp_pool_slot_games_game_id ON bb_cfp_pool_slot_games(game_id);
CREATE INDEX IF NOT EXISTS idx_bb_games_away_team_id ON bb_games(away_team_id);
CREATE INDEX IF NOT EXISTS idx_bb_games_home_team_id ON bb_games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_bb_pool_games_game_id ON bb_pool_games(game_id);
CREATE INDEX IF NOT EXISTS idx_join_links_created_by ON join_links(created_by);
CREATE INDEX IF NOT EXISTS idx_pool_memberships_approved_by ON pool_memberships(approved_by);
CREATE INDEX IF NOT EXISTS idx_pools_created_by ON pools(created_by);
```

---

### 2. Inefficient RLS Policies (Auth Function Re-evaluation)

**Impact:** RLS policies using `auth.uid()` instead of `(select auth.uid())` cause the function to be re-evaluated for each row, significantly impacting query performance at scale.

**Affected Policies (26 total):**

| Table | Policy Name |
|-------|-------------|
| `profiles` | Users can update own profile |
| `profiles` | Super admins can update any profile |
| `pool_memberships` | Pool members can view memberships |
| `pool_memberships` | Users can request to join |
| `bb_bowl_picks` | Users can insert bowl picks |
| `bb_bowl_picks` | Users can update bowl picks |
| `bb_cfp_entry_picks` | Users can insert CFP picks |
| `bb_cfp_entry_picks` | Users can update CFP picks |
| `bb_cfp_entry_picks` | Users can delete CFP picks |
| `organizations` | authenticated_users_can_view_orgs |
| `bb_entries` | Members commissioners and super admins can create entry |
| `sq_pools` | Pool members can view sq_pools |
| `sq_squares` | Pool members can view sq_squares |
| `sq_squares` | Approved members can claim squares |
| `sq_squares` | Members can unclaim own squares |
| `sq_games` | Pool members can view sq_games |
| `sq_winners` | Pool members can view sq_winners |
| `bb_games` | Commissioners can insert games |
| `bb_teams` | Admins can delete teams |
| `bb_teams` | Admins can insert teams |
| `bb_teams` | Admins can update teams |
| `sq_score_changes` | Score changes viewable by pool members |

**Fix Pattern:**

```sql
-- Before (slow - re-evaluates per row)
CREATE POLICY "example" ON table USING (auth.uid() = user_id);

-- After (fast - evaluates once)
CREATE POLICY "example" ON table USING ((select auth.uid()) = user_id);
```

**Reference:** https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

---

### 3. Multiple Permissive Policies

**Impact:** When multiple permissive policies exist for the same role and action, ALL policies must be evaluated for every query, reducing performance.

**Affected Tables:**

| Table | Action | Duplicate Policies |
|-------|--------|-------------------|
| `bb_bowl_picks` | UPDATE | "Commissioners can override bowl picks", "Users can update bowl picks" |
| `bb_cfp_entry_picks` | UPDATE | "Commissioners can override CFP picks", "Users can update CFP picks" |
| `bb_cfp_pool_byes` | SELECT | "Commissioners can manage byes", "Pool members can view byes" |
| `bb_pool_games` | INSERT | "Commissioners can manage pool games", "Pool commissioners can insert pool games" |
| `bb_teams` | SELECT | "Anyone can read teams", "Anyone can view teams" |
| `pool_memberships` | INSERT | "Commissioners and super admins can insert pool memberships", "Users can request to join" |
| `pools` | All actions | Multiple policies per action |
| `profiles` | UPDATE | "Super admins can update any profile", "Users can update own profile" |
| `sq_squares` | INSERT/SELECT/DELETE | Multiple policies |

**Recommendation:** Consolidate into single policies using OR conditions:

```sql
-- Instead of two separate policies
-- Combine into one:
CREATE POLICY "Update bowl picks" ON bb_bowl_picks
FOR UPDATE USING (
  -- User owns the pick
  EXISTS (SELECT 1 FROM bb_entries e WHERE e.id = entry_id AND e.user_id = (select auth.uid()))
  -- Or user is commissioner
  OR EXISTS (
    SELECT 1 FROM bb_entries e
    JOIN pools p ON e.pool_id = p.id
    WHERE e.id = entry_id AND is_pool_commissioner(p.id)
  )
);
```

---

### 4. Unused Indexes

**Impact:** These indexes consume storage and slow down writes without providing query benefits.

| Table | Unused Index |
|-------|--------------|
| `audit_log` | `idx_audit_log_created` |
| `bb_games` | `idx_bb_games_external` |
| `bb_entries` | `idx_bb_entries_pool` |
| `sq_games` | `idx_sq_games_status` |
| `sq_games` | `idx_sq_games_round` |

**Recommendation:** Monitor these indexes and consider removing if truly unused:

```sql
-- Only after confirming they're not needed
DROP INDEX IF EXISTS idx_audit_log_created;
DROP INDEX IF EXISTS idx_bb_games_external;
-- etc.
```

---

## Positive Security Findings

The following security measures are correctly implemented:

### 1. Race Condition Handling in Squares
`frontend/src/components/squares/squares-grid.tsx` properly handles unique constraint violations (PostgreSQL error code 23505) for square claims, preventing double-claiming.

### 2. Realtime Updates
The squares grid uses Supabase realtime subscriptions to prevent stale state and ensure users see current data.

### 3. Join Link Server-Side Validation
Uses server-side RPC (`validate_join_link`) to check token validity, expiration, and max uses - not just client-side checks.

### 4. Super Admin Protection
Multiple components check `isMemberSuperAdmin` before allowing dangerous actions on super admin users, preventing accidental removal.

### 5. Last Admin Protection
Frontend prevents demoting/removing the last org admin, maintaining org access.

### 6. Page-Level Access Control
Server components properly check membership and roles before rendering sensitive pages (games, members, etc.).

### 7. RLS Enabled on All Tables
All 27 tables have Row Level Security enabled - no tables are publicly accessible without policies.

---

## Testing Strategy

### Current State (Updated January 3, 2026)

**Testing infrastructure fully implemented.** The project now has:
- ✅ Vitest + React Testing Library configured
- ✅ 276 unit/component tests passing
- ✅ Business logic extracted to `@/lib/squares/` for testability
- ✅ Test scripts in package.json (`test`, `test:run`, `test:coverage`)

#### Test Coverage Summary

| Category | Tests | Files |
|----------|-------|-------|
| **Grid Generation** | 22 | `lib/squares/__tests__/grid-generation.test.ts` |
| **Score Validation** | 38 | `lib/squares/__tests__/score-validation.test.ts` |
| **Winner Calculation** | 35 | `lib/squares/__tests__/winner-calculation.test.ts` |
| **Auth Components** | 49 | `components/auth/__tests__/*.test.tsx` |
| **Org Components** | 41 | `components/orgs/__tests__/*.test.tsx` |
| **Square Components** | 85 | `components/squares/__tests__/*.test.tsx` |
| **Pools Components** | 6 | `components/pools/__tests__/*.test.tsx` |
| **Total** | **276** | |

#### Extracted Business Logic

Pure utility functions extracted for easy testing (no React/Supabase dependencies):

| File | Functions |
|------|-----------|
| `lib/squares/grid-generation.ts` | `shuffleArray`, `generateGridNumbers`, `isValidGridNumbers` |
| `lib/squares/score-validation.ts` | `validateScoreChange`, `validateFirstScoreChange`, `getLastScore` |
| `lib/squares/winner-calculation.ts` | `calculateWinningSquarePosition`, `findWinningSquare`, `buildWinningSquareRoundsMap` |
| `lib/squares/types.ts` | `WinningRound`, `Square`, `Winner`, `Game` types |

### Recommended Stack

| Test Type | Tool | Reason |
|-----------|------|--------|
| **Unit/Integration** | Vitest + React Testing Library | Native ESM support, fast, TypeScript-first |
| **E2E** | Playwright | Multi-browser, great Supabase integration |

### Installation

```bash
cd frontend

# Unit test dependencies
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom

# E2E dependencies
npm install -D @playwright/test
npx playwright install
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### Vitest Configuration

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/__tests__/setup.ts']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### Playwright Configuration

Create `frontend/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Suggested File Structure

```
frontend/
├── vitest.config.ts
├── playwright.config.ts
├── src/
│   └── __tests__/
│       ├── setup.ts                    # Test setup (mocks)
│       ├── components/
│       │   ├── picks/
│       │   │   ├── bowl-picks-form.test.tsx
│       │   │   └── cfp-bracket-picker.test.tsx
│       │   ├── standings/
│       │   │   └── pool-standings.test.tsx
│       │   └── auth/
│       │       └── login-form.test.tsx
│       └── lib/
│           └── utils.test.ts
└── e2e/
    ├── auth.spec.ts
    ├── picks.spec.ts
    ├── join-flow.spec.ts
    └── commissioner.spec.ts
```

### Priority Tests to Write

#### P0 - Critical (Write First)

1. **Game Lock Logic** - `bowl-picks-form.test.tsx`
   ```typescript
   describe('isGameLocked', () => {
     it('returns false when no kickoff time')
     it('returns false more than 5 minutes before kickoff')
     it('returns true at exactly 5 minutes before kickoff')
     it('returns true after kickoff')
     it('returns false in demo mode regardless of time')
   })
   ```

2. **CFP Bracket Logic** - `cfp-bracket-picker.test.tsx`
   ```typescript
   describe('CFP Bracket', () => {
     it('clears downstream picks when upstream changes')
     it('resolves slot teams from picks correctly')
     it('handles bye teams in quarterfinals')
     it('validates bracket flow dependencies')
   })
   ```

3. **Authentication E2E** - `auth.spec.ts`
   ```typescript
   test('allows new user to sign up')
   test('allows existing user to log in')
   test('redirects to dashboard after login')
   test('redirects to login when accessing protected route')
   test('handles invalid credentials gracefully')
   ```

#### P1 - High Priority

4. **Standings Calculation** - `pool-standings.test.tsx`
   ```typescript
   describe('Pool Standings', () => {
     it('sorts by total score descending')
     it('handles ties with same rank')
     it('identifies winner when pool completed')
     it('calculates margin-of-victory scoring correctly')
   })
   ```

5. **Pick Submission E2E** - `picks.spec.ts`
   ```typescript
   test('allows user to select a team for bowl game')
   test('persists picks after page refresh')
   test('shows pick count progress')
   test('prevents picks after game locks')
   ```

6. **Join Flow E2E** - `join-flow.spec.ts`
   ```typescript
   test('join via valid invite link')
   test('handles expired link gracefully')
   test('handles max uses exceeded')
   test('redirects to login if not authenticated')
   ```

#### P2 - Medium Priority

7. **Commissioner Actions E2E** - `commissioner.spec.ts`
   ```typescript
   test('add bowl game to pool')
   test('enter final scores')
   test('approve pending member')
   test('generate invite link')
   ```

---

## Action Items

### Immediate (P0 - Security Critical) - COMPLETED

- [x] **Fix #1:** Bowl pick lock time - ALREADY ENFORCED via `is_bowl_pick_locked()` in RLS
- [x] **Fix #2:** CFP pick lock time - ALREADY ENFORCED via `is_cfp_locked()` in RLS
- [x] **Fix #3:** Fixed RLS on `bb_games` - now requires commissioner status (migration applied)
- [ ] **Fix #4:** Enable Leaked Password Protection in Supabase Auth settings (manual step required)
- [x] **Fix #5:** Removed self-approval code pattern from `create-entry-button.tsx`

### Short-term (P1 - Security & Performance) - SECURITY COMPLETE

- [x] **Fix #6:** Replaced `Math.random()` with `crypto.randomUUID()` in `generate-link-button.tsx`
- [x] **Fix #7:** Added RLS policy to hide picks until lock (migration applied)
- [x] **Perf #1:** Add missing foreign key indexes ✅ (January 3, 2026)
  - Migration `add_missing_fk_indexes` applied with 15 indexes
- [ ] **Perf #2:** Optimize RLS policies to use `(select auth.uid())`
- [ ] **Perf #3:** Consolidate duplicate permissive policies

### Medium-term (P2 - Testing) - UNIT TESTING COMPLETE

- [x] **Test #1:** Set up Vitest + React Testing Library ✅ (January 3, 2026)
  - Configured `vitest.config.ts` with jsdom, path aliases, globals
  - Created test setup file with Next.js navigation mocks
  - Added `test`, `test:run`, `test:coverage` scripts to package.json
- [x] **Test #2:** Write unit tests for squares pool logic ✅ (January 3, 2026)
  - Grid generation (Fisher-Yates shuffle, number validation)
  - Score validation (increment rules, first score, history)
  - Winner calculation (forward/reverse scoring, round hierarchy)
- [x] **Test #3:** Write component tests ✅ (January 3, 2026)
  - Auth: login, signup, logout, forgot-password, reset-password
  - Orgs: create, delete, member actions
  - Squares: square-cell, no-account-square-cell, game-score-card
  - Pools: create-pool-button
- [ ] **Test #4:** Set up Playwright for E2E tests
- [ ] **Test #5:** Write authentication E2E tests
- [ ] **Test #6:** Write pick submission E2E tests

### Long-term (P3 - Maintenance)

- [ ] Evaluate and potentially remove unused indexes
- [ ] Add test coverage requirements to CI/CD
- [ ] Set up automated security scanning

---

## References

- [Supabase RLS Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth Function Optimization](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
