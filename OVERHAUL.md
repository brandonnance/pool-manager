# BN Pools — Comprehensive Overhaul Plan

## Executive Summary

BN Pools has reached a critical inflection point. Built iteratively across four pool types (Bowl Buster, Squares, Golf, March Madness Blind Draw), the codebase has accumulated technical debt that now actively causes user-facing bugs — particularly around permissions. This overhaul addresses seven goals:

1. **Fix permissions once and for all** — Centralize the permission system, fix RLS policy gaps, eliminate copy-paste permission checks
2. **Ship March Madness features** — Blind draw improvements and new March Madness Squares, deadline mid-March 2026
3. **Simplify Squares** — Public-facing is THE model, not "no-account mode." Remove all dual-mode conditionals
4. **Simplify Golf** — Commissioner setup is muddy; streamline into a guided workflow while keeping what works
5. **Remove Bowl Buster** — Football is 7+ months away. Delete code, write a high-level tech spec for future re-introduction
6. **Improve architecture** — Form handling, error boundaries, loading states, data fetching patterns, more shadcn
7. **Simplify the database** — Consolidate where possible, all changes tested on dev DB first

The work is organized into 8 phases. Phases 0-2 are highest priority. The dependency graph allows significant parallelization.

---

## Progress Tracker

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| **0A**: Centralized Permission Helpers | **DONE** | 2026-02-26 | Created `lib/permissions.ts`, updated 14 files to use shared helpers |
| **0B**: Fix RLS Security Issues | **DONE** | 2026-02-26 | Fixes 1-4 applied. Fix 5 (consolidate policies) skipped — duplicates are intentional auth/public splits |
| **0C**: Error Boundaries & Loading States | **DONE** | 2026-02-26 | Created `lib/errors.ts`, 4 loading.tsx, 2 error.tsx files |
| **1A**: Blind Draw Improvements | Not started | | |
| **1B**: Generic Squares + MM Squares | Not started | | |
| **2A**: Remove "No-Account" Naming | **DONE** | 2026-02-26 | Renamed types/variables across 12 files, removed dead code |
| **2B**: DB Column Cleanup | **DONE** | 2026-02-26 | Dropped columns, rewrote 6 RLS policies, dropped FK, regenerated types |
| **3A**: Commissioner Workflow Redesign | Not started | | |
| **4A**: Form Library | Not started | | |
| **4B**: Data Fetching Helpers | Not started | | |
| **4C**: Expanded shadcn Usage | Not started | | |
| **4D**: Slug Validation Utility | Not started | | |
| **5A-F**: DB Simplification | Not started | | |
| **6A-C**: Bowl Buster Removal | Not started | | |
| **7A-C**: Dev Environment | Not started | | |

---

## Current State Assessment

### Codebase Stats
- **209** TypeScript files across `frontend/src/`
- **2.1 MB** total source
- **45** database tables, **18** database functions
- **22** shadcn/ui components, **116** custom components
- **41** page components, **14** API routes
- **4** pool types: Bowl Buster, Squares, Golf, March Madness Blind Draw

### What Works Well
- Supabase RLS provides real security at the data layer
- 4-tier role hierarchy (Super Admin → Org Admin → Pool Commissioner → Member) is a sound model
- Pool-type-specific tables (`sq_*`, `gp_*`, `mm_*`, `bb_*`) keep domain logic clean
- Public slug/URL system for unauthenticated access works great
- Golf pool is the most polished — tournament import, tiers, public leaderboards, Slash Golf API
- Squares realtime features (WebSocket grid updates, live winner indicators) are solid
- shadcn/ui provides good accessible primitives

### Identified Issues

**Permissions (Critical)**
- All authenticated users can view ALL organizations (RLS policy `authenticated_users_can_view_orgs` is too permissive)
- `is_org_admin(p_org_id)` does NOT include super admin check — relies on calling code to add `|| isSuperAdmin`
- Inconsistent super admin checks: some RLS policies use `is_super_admin()`, others inline `EXISTS (SELECT 1 FROM profiles ...)`
- Permission check boilerplate copy-pasted across 27+ files (3 separate queries per page)
- `is_org_commissioner()` is deprecated but still exists in schema
- Double membership insertion in onboarding (trigger + manual insert both run)
- 26 RLS policies use `auth.uid()` instead of `(select auth.uid())` causing per-row re-evaluation

**Architecture**
- No form library — manual `useState` for every field (some forms have 15+ state variables)
- No error boundaries or `error.tsx` files anywhere
- No `loading.tsx` files or skeleton loaders despite having the shadcn Skeleton component
- Pool detail page (`pools/[id]/page.tsx`) is 1200 lines handling all pool types
- No centralized data fetching helpers
- `public_slug` duplicated across `sq_pools`, `mm_pools`, `gp_pools`
- `demo_mode` on both `pools` and `gp_pools` tables

**Squares**
- Code still has "no-account" naming everywhere even though public-facing is now the only model
- Variables like `noAccountSquares`, `isNoAccountMode`, `NoAccountSquaresGridProps` persist
- DB columns `no_account_mode` (always true), `max_squares_per_player` (always null), `user_id` FK on squares (always null)

**Golf**
- Setup page is ~900 lines with too many responsibilities in one view
- Commissioner must navigate 5 separate pages to configure a pool
- No setup progress indicator

**Bowl Buster**
- 10+ components, 3 pages, onboarding wizard — all dormant until football season
- `bb_teams` table is shared with March Madness (critical dependency)

---

## Reference Architecture Patterns

Extracted from the user's work app (Coast Guard recruiting platform — NxJS/Angular/GraphQL monorepo, 50+ DB entities, 3 product lines). These are proven production patterns mapped to BN Pools concepts. See `tech_questions.md` for full details and code examples.

### Permissions: Composition Over Inheritance
Don't build implicit "admin inherits member" chains. Instead, explicitly list permission atoms per role:
- Define an **Ability enum** (`CREATE`, `READ`, `UPDATE`, `DELETE`, `SUBMIT`, `ASSIGN`)
- Each role gets an explicit `dataPermissions: Ability[]` array — Super Admin simply has all abilities listed
- Use **AdminLevel** (`ALL > ORGANIZATION > GROUP > NONE`) as a separate hierarchy for "can manage settings" checks
- Permission check is a direct `.includes()`, not a recursive resolver
- **Maps to BN Pools**: `isSuperAdmin`, `isOrgAdmin`, `isPoolCommissioner` become derived from explicit ability arrays on each role

### Guards Prevent Rendering, Not Hide Content
- Block unauthorized access at the **middleware/layout level** before the page component mounts
- Never render a page then conditionally hide content — check auth/role first
- Content hiding (`{isAdmin && <Button>}`) is only for **within-page** nuance on pages the user can already access
- Store intended URL for post-login redirect (`?continue=`)

### Backend Enforces Independently
- Frontend permission checks are **UX only** (hiding buttons, disabling forms) — never security
- RLS policies are the equivalent of the work app's `OwnableRepository` — they filter data at the DB level regardless of what the client sends
- Even if a user bypasses the frontend, the backend independently rejects unauthorized requests

### Tri-State Loading Pattern
Every data-driven view has three states:
1. `loading && no data` → **Skeleton loaders** (row count matches expected page size)
2. `!loading && no data` → **Empty state** with CTA (e.g., "No pools yet — create your first one!"), use `animate-fade-in` to avoid flash
3. `has data` → **Render list/table**

### Error Handling: Two Tiers
- **Global error handler** intercepts all API responses, normalizes into consistent shape
- **Error constants** define `{ code, message, detailedMessage }` per error type
- **Field-level errors** rendered inline by form library (Zod validation messages)
- **Server errors** shown as toast notifications (positioned bottom-right, auto-dismiss)
- Full flow: client validate → inline errors → fire API → on error toast → on success advance/close

### Config-Driven Forms
- Separate **form definition** (schema/config) from **rendering** (components)
- Register **global validators** once (required, email, phone, etc.) — reuse everywhere
- `focusOnFirstInvalidField()` utility auto-scrolls to first error on submit
- `markAllAsTouched()` equivalent triggers display of all errors at once
- **Maps to BN Pools**: React Hook Form + Zod. Define schemas in `form-schemas.ts`, render with shadcn Form components

### Consumer Service → Custom Hooks
- One **domain hook** per entity: `usePool()`, `useMembers()`, `usePicks()`, `useSquares()`, `useGolf()`
- **React Query** for: `staleTime` (time-based caching) + `invalidateQueries()` (manual after mutations) + Supabase Realtime subscriptions (event-based invalidation)
- **Optimistic updates**: save previous state in `onMutate`, update cache, revert in `onError`, refetch in `onSettled`

### Shell + Tabs + Shared State
For large detail pages (like pool detail):
- **Layout component** loads entity data once, writes to React Context
- **Tabs render as child routes** (lazy-loaded)
- All tab components read from shared context — no redundant fetches
- **Polymorphic rendering**: `switch(pool.type)` dispatches to type-specific components with a common interface

### Generic DataTable
Build a reusable `<DataTable>` component using **TanStack Table**:
- **Column definitions** with custom cell renderers (status badges, action buttons, inline editing)
- Built-in **sorting, filtering, pagination, loading skeletons, empty states**
- Options: `showSearch`, `showPagination`, `defaultPageSize`, `rowClickCallback`
- Filter sidebar driven by form schemas (same pattern as main forms)

### Imperative Modal Pattern
- Open modal, get **Promise/callback** back — `const result = await openModal(MyModal, options)`
- Caller handles refresh: `if (result) { refetchData(); }`
- Modal doesn't know about parent state — it just returns a value
- Built-in generic modals: confirmation, input prompt, file upload

### Client-Side Wizard<T>
For multi-step setup flows (golf stepper, onboarding):
```typescript
interface Wizard<T> {
  steps: WizardStep[]
  currentStepIndex: number
  data: T              // Accumulated data from all steps
  isComplete: boolean
}
interface WizardStep {
  name: string
  label: string
  completed: boolean
  component: ComponentType  // Dynamic step rendering
}
```
- Each step reads/writes to shared `data` via React Context
- **Validate before advancing** — block, don't skip
- **ProgressTimeline** shows `isDone` / `isCurrent` / `isPending` per step
- For persistent progress (survives refresh), store step state in DB

### Entity Lifecycle as StepConfig
For entities with distinct phases (pools: draft → open → locked → completed):
- Define statuses as an **enum with named steps**
- Map each status to a **UI config**: available actions, layout, next valid transitions
- Commissioner dashboard shows a **NextAction card** driven by current status
- Status transitions controlled server-side — the UI shows what's appropriate, the backend enforces what's valid

### Realtime as Invalidation Signal
- Don't reconstruct state from the Supabase Realtime event payload
- Use realtime events purely as a **"something changed" signal** → trigger `invalidateQueries()`
- React Query refetches the authoritative data from the server
- **Maps to BN Pools**: Live leaderboards, pick confirmations, deadline notifications

### Testing Patterns
- **UserFactory** helper: `createAdmin()`, `createCommissioner()`, `createMember()` — generates test users with specific roles
- **Guard tests**: unauthenticated → reject, wrong role → reject, correct role → allow, edge cases
- **`data-testid` attributes** on interactive elements for reliable E2E selection
- **Vitest** for unit tests (faster than Jest for Next.js), **Playwright** for E2E
- Test RLS by creating Supabase clients authenticated as different users and verifying row access

---

## Phase 0: Foundations

**Timeline**: Week 1-2
**Dependencies**: None — enables everything else
**Priority**: Highest

### 0A: Centralized Permission Helpers — DONE (2026-02-26)

**Problem**: Every protected page independently queries `pool_memberships`, `org_memberships`, and `profiles` to derive permission flags. This is repeated in 27+ files with slight variations, leading to inconsistencies.

**Current pattern** (found in every pool-related page):
```typescript
const { data: poolMembership } = await supabase
  .from('pool_memberships').select('id, status, role')
  .eq('pool_id', id).eq('user_id', user.id).single()
const { data: orgMembership } = await supabase
  .from('org_memberships').select('role')
  .eq('org_id', pool.org_id).eq('user_id', user.id).single()
const { data: profile } = await supabase
  .from('profiles').select('is_super_admin')
  .eq('id', user.id).single()
const isSuperAdmin = profile?.is_super_admin ?? false
const isOrgAdmin = orgMembership?.role === 'admin' || isSuperAdmin
const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin
```

**Solution**: Create `frontend/src/lib/permissions.ts` with:
```typescript
interface PoolPermissions {
  user: User
  profile: { is_super_admin: boolean; display_name: string | null }
  isSuperAdmin: boolean
  isOrgAdmin: boolean
  isPoolCommissioner: boolean
  isMember: boolean
  isPending: boolean
  poolMembership: { id: string; status: string; role: string } | null
  orgMembership: { role: string } | null
}

async function getPoolPermissions(supabase, poolId, orgId): Promise<PoolPermissions | null>
async function getOrgPermissions(supabase, orgId): Promise<OrgPermissions | null>
async function requirePoolCommissioner(supabase, poolId, orgId): Promise<PoolPermissions>  // throws/redirects if not
async function requireOrgAdmin(supabase, orgId): Promise<OrgPermissions>  // throws/redirects if not
```

**Files to create**:
- `frontend/src/lib/permissions.ts`

**Files to modify** (replace inline permission checks):
- All pages under `pools/[id]/` (pool detail, members, games, picks, cfp, golf/*, march-madness/*)
- All pages under `orgs/[id]/` (org detail, members)
- Dashboard page
- Any component doing server-side permission checks

**Design guidance** (from reference architecture):
- Use the **composition model** — each role explicitly declares its abilities rather than implicit inheritance. `isPoolCommissioner` checks both direct role AND `isOrgAdmin`, which itself checks both direct role AND `isSuperAdmin`. The chain is explicit at each level.
- `requirePoolCommissioner()` and `requireOrgAdmin()` act as **guard functions** — they redirect/throw if the user lacks permission, preventing the page from rendering at all. This matches the "guards prevent rendering" pattern.
- Consider defining permission atoms as a union type: `type Ability = 'manage_pool' | 'enter_picks' | 'view_standings' | 'manage_members' | 'manage_org'` for future flexibility beyond simple role checks.

**Verification**: Every page that currently checks permissions should produce identical behavior after refactor. Manually test as super admin, org admin, commissioner, and regular member.

**Completion notes**: Created `frontend/src/lib/permissions.ts` with pure derivation functions (`checkSuperAdmin`, `checkOrgAdmin`, `checkPoolCommissioner`) and combined query+derivation functions (`getPoolPermissions`, `getOrgPermissions`). Updated 13 server component pages and 3 API routes. Queries now run in `Promise.all` instead of sequentially. Remaining inline patterns are legitimate: `delete-pool-button.tsx` (client component), `orgs/page.tsx` (no specific org), `isMemberSuperAdmin` props (checking other users).

### 0B: Fix RLS Security Issues — DONE (2026-02-26)

**All changes must be tested on dev DB first.**

**Fix 1: `is_org_admin()` should include super admin**
```sql
CREATE OR REPLACE FUNCTION is_org_admin(p_org_id uuid) RETURNS boolean AS $$
  SELECT is_super_admin() OR EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_id = p_org_id AND user_id = (select auth.uid()) AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```
Impact: Every RLS policy using `is_org_admin()` will now correctly allow super admin access without needing a separate `OR is_super_admin()` clause.

**Fix 2: Organization visibility**
```sql
DROP POLICY IF EXISTS "authenticated_users_can_view_orgs" ON organizations;
CREATE POLICY "org_members_can_view_orgs" ON organizations FOR SELECT USING (
  is_super_admin() OR
  EXISTS (SELECT 1 FROM org_memberships WHERE org_id = id AND user_id = (select auth.uid()))
);
```
Impact: Users can only see organizations they belong to. Super admins see all.

**Fix 3: Drop deprecated function**
```sql
DROP FUNCTION IF EXISTS is_org_commissioner(uuid);
```

**Fix 4: Performance — `auth.uid()` to `(select auth.uid())`**
26 RLS policies evaluate `auth.uid()` per-row instead of once per query. Batch-update all of them. This is a straightforward find-and-replace in the policy definitions.

**Fix 5: Consolidate duplicate permissive policies**
9 tables have multiple permissive SELECT policies that could be consolidated into single policies with OR conditions, reducing policy evaluation overhead.

**Verification**:
- Test all fixes on dev DB branch first
- Verify each role tier can access what it should and nothing more
- Specifically test: super admin accessing org they're not a member of, regular user trying to see other orgs, org admin managing pools

**Completion notes**: Applied via 7 Supabase migrations. Fix 1: `is_org_admin()` now includes `is_super_admin()` check + uses `(select auth.uid())`. Fix 2: Replaced `authenticated_users_can_view_orgs` with `org_members_can_view_orgs` (members + super admins only). Fix 3: Dropped `is_org_commissioner()`. Fix 4: Rewrote all 37 policies across 20 tables to use `(SELECT auth.uid())` subquery pattern — zero bare `auth.uid()` remaining. Also fixed `is_super_admin()` function to use the same pattern. Fix 5: **Skipped** — the "duplicate" policies are intentional auth/public splits (e.g., `Pool members can view sq_games` + `Public can view games for public pools`). Consolidating adds risk for marginal benefit. Security advisors flagged new items: `function_search_path_mutable` on 10 functions and `allow_all_inserts` on organizations — these are separate issues for a future pass.

### 0C: Error Boundaries and Loading States — DONE (2026-02-26)

**Problem**: No error handling infrastructure. Users see blank screens on errors and no feedback during loading.

**Solution**:
- Add `loading.tsx` to key route segments with skeleton loaders
- Add `error.tsx` to key route segments with user-friendly error messages
- Use the existing shadcn Skeleton component

**Design guidance** (from reference architecture):

*Loading states — Tri-state pattern*:
- Skeleton row count should **match expected page size** (e.g., if a table shows 10 rows, render 10 skeleton rows — not an arbitrary number)
- Use `animate-fade-in` on empty states to avoid a flash during fast loads
- Every data view implements the tri-state: loading → empty + CTA → data

*Error handling — Two-tier approach*:
- Create `frontend/src/lib/errors.ts` with error constants: `{ code: string, message: string, detailedMessage: string }` per error type
- **Field-level errors**: Rendered inline by form library (Zod validation messages below each field)
- **Server/API errors**: Shown as toast notifications (use shadcn Sonner or similar, bottom-right, auto-dismiss after 5s)
- `error.tsx` boundaries catch unhandled exceptions — show a user-friendly message with "Try again" action
- Consider a thin wrapper around Supabase client calls that normalizes errors into the consistent shape

**Files to create**:
- `frontend/src/app/(dashboard)/pools/[id]/loading.tsx`
- `frontend/src/app/(dashboard)/pools/[id]/error.tsx`
- `frontend/src/app/(dashboard)/orgs/[id]/loading.tsx`
- `frontend/src/app/(dashboard)/orgs/[id]/error.tsx`
- `frontend/src/app/(dashboard)/dashboard/loading.tsx`
- `frontend/src/lib/errors.ts` — Error constants and toast helper

**Verification**: Navigate to pool/org pages and observe skeleton loading states. Trigger an error (e.g., invalid pool ID) and verify error boundary catches it.

**Completion notes**: Created `frontend/src/lib/errors.ts` (error constants with code/message/detailedMessage + `showErrorToast`/`showSuccessToast` wrappers using Sonner). Created loading skeletons for dashboard, pool detail, and org detail routes. Created error boundaries for pool and org routes with "Go Back" and "Try Again" actions. Sonner was already configured in root layout.

---

## Phase 1: March Madness

**Timeline**: Week 2-3
**Dependencies**: Phase 0A (permissions helpers)
**Priority**: TIME SENSITIVE — must be production-ready before mid-March 2026

### 1A: Blind Draw Improvements

**Current state**: Core functionality works — 17 components, 5 pages, DB trigger for game results. Identified gaps:

**1. Next-round auto-population** (Critical)
The `mm_process_game_result()` trigger handles elimination and team transfer when a game is finalized, but does NOT automatically populate the next round's game with the advancing entry and team. This means the commissioner must manually set up each round's matchups. For 63 games, this is untenable.

Solution: Extend the trigger (or add a new one) to:
- Identify the next-round game based on bracket position
- Set the advancing entry and team on the appropriate slot (higher/lower seed)
- Only populate when both feeder games for a matchup are final

**2. Mobile bracket view**
`bracket-view.tsx` (30KB) is desktop-focused with a 4-region layout. Needs either:
- A responsive redesign with horizontal scrolling
- A mobile-specific list/card view that shows matchups by round

**3. Public view completion**
The `/view/mm/[slug]` route exists but needs review for completeness:
- Standings table visible without auth
- Bracket view (read-only) visible without auth
- Team assignments and current-round display

**4. Commissioner UX**
Currently requires navigating to setup, entries, and games pages separately. Add a consolidated dashboard card showing:
- Setup progress (teams selected, entries added, draw completed)
- Current round status
- Quick-action buttons

**Files to modify**:
- `frontend/src/components/march-madness/bracket-view.tsx` — Mobile responsive
- `frontend/src/components/march-madness/march-madness-content.tsx` — Dashboard improvements
- `frontend/src/app/view/mm/[slug]/page.tsx` — Public view completeness
- DB trigger `mm_process_game_result` — Next-round population

**Spec file**: `MARCH_MADNESS_IMPROVEMENTS.md` — Created at start of this phase

### 1B: Generic Squares Type + March Madness Squares

**Decision**: Rename `playoff_squares` to a generic `squares` pool type with a sport/event configuration. This allows the same infrastructure to support NFL playoffs, March Madness, Super Bowl, and any future event.

**DB changes (dev DB first)**:
- Add `event_type` column to `sq_pools`: `'nfl_playoffs'` | `'march_madness'` | `'single_game'` | `'custom'`
- Expand `sq_games.round` check constraint to include March Madness rounds: `'mm_r64'`, `'mm_r32'`, `'mm_s16'`, `'mm_e8'`, `'mm_f4'`, `'mm_final'`
- Update `pools.type` enum/check: rename `'playoff_squares'` to `'squares'` (or add `'squares'` and migrate existing)
- Consider: `sq_pools.event_config` JSONB field for event-specific settings (e.g., number of games, round structure)

**March Madness Full Tournament Mode**:
- 63 games after play-in (R64: 32 games, R32: 16, S16: 8, E8: 4, F4: 2, Final: 1)
- Each game produces a winner based on the same grid (row = home/higher seed last digit, col = away/lower seed last digit)
- Scoring mode: quarter scoring per game (Q1, Halftime, Q3, Final) or final-score-only
- Games can be pre-populated from a bracket import or added manually as the tournament progresses
- Public view at `/view/[slug]` works exactly as NFL squares do

**Single Game Mode for March Madness**:
- Already supported by existing single_game squares mode
- Just needs the "March Madness" event_type label in the create dialog
- Final score only for now (user requirement)

**Pool creation flow update**:
- `create-pool-button.tsx`: Replace `playoff_squares` with `squares`
- Add event type selector: "NFL Playoffs", "March Madness", "Single Game", "Custom"
- March Madness sub-options: "Full Tournament" or "Single Game"

**Files to modify**:
- `frontend/src/components/pools/create-pool-button.tsx` — New event selector
- `frontend/src/lib/squares/` — Scoring logic for March Madness rounds
- `frontend/src/components/squares/playoff-content.tsx` — Adapt for March Madness multi-game
- DB migration for `event_type` column and round constraint

**Spec file**: `MARCH_MADNESS_SQUARES.md` — Created at start of this phase

---

## Phase 2: Squares Cleanup

**Timeline**: Week 2-3 (parallel with Phase 1)
**Dependencies**: None
**Priority**: Medium — code cleanliness

### 2A: Remove "No-Account" Naming — DONE (2026-02-26)

**Context**: The app previously had two squares models — authenticated (users claim squares via accounts) and no-account (commissioner assigns names to squares). The authenticated model has been removed. Public-facing IS the model now. But naming artifacts persist throughout the code.

**Files with "no-account" references to clean up**:

| File | What to change |
|------|---------------|
| `pools/[id]/page.tsx` | Rename `noAccountSquares` variable to `squaresPool` or `squares` |
| `pools/[id]/members/page.tsx` | Remove `isNoAccountMode` conditional logic — squares always use participant_name model |
| `view/[slug]/page.tsx` | Remove `.eq('no_account_mode', true)` filter, remove "no account mode" comments |
| `pools/create-pool-button.tsx` | Remove "no-account mode only" and "always no-account mode" comments |
| `squares/squares-grid.tsx` | Rename `NoAccountSquare` type to `Square`, `NoAccountSquaresGridProps` to `SquaresGridProps` |
| `squares/payout-leaderboard.tsx` | Remove "no-account mode" comment |
| `squares/live-scoring-control.tsx` | Remove "For no-account mode" comment |

This is a mechanical rename/cleanup — no behavior changes.

**Completion notes**: Renamed types across 12 files. Key renames: `NoAccountSquare` → `Square`, `NoAccountSquaresGridProps` → `SquaresGridProps`, `isNoAccountMode` → `isSquaresPool` (using existing variable), `noAccountSquares` → `publicSquares`. Removed dead code in members page (`squareCountsByUser` and squares count columns that could never execute since `no_account_mode` was always `true`). Removed `no_account_mode` from DB queries in view page and members page. Only remaining references: `database.ts` (auto-generated types) and `create-pool-button.tsx` (DB insert — kept until Phase 2B drops the column). TypeScript compiles cleanly.

### 2B: DB Column Cleanup (Dev DB First) — DONE (2026-02-26)

Columns that only existed for the removed authenticated mode:
- `sq_pools.no_account_mode` — Always `true`. Drop column.
- `sq_pools.max_squares_per_player` — Always `null`. Drop column.
- `sq_squares.user_id` — Always `null`. Drop the FK constraint to `auth.users`. Keep column nullable for now to avoid data migration issues.

**Verification**: After migration on dev DB, run the app end-to-end: create a squares pool, assign names, enter scores, verify winners.

**Completion notes**: Applied via 1 Supabase migration. Dropped `sq_pools.no_account_mode` and `sq_pools.max_squares_per_player` columns. Rewrote 6 RLS policies that referenced `no_account_mode` — removed the always-true check, renamed from "no-account" to "public pools" naming. Dropped `sq_squares_user_id_fkey` FK constraint (column kept nullable). Removed `no_account_mode: true` and `max_squares_per_player: null` from `create-pool-button.tsx` DB insert. Regenerated TypeScript types — no remaining references to dropped columns.

---

## Phase 3: Golf Simplification

**Timeline**: Week 3-4 (can parallel with Phase 1)
**Dependencies**: Phase 0A (permissions helpers)
**Priority**: Medium

### 3A: Commissioner Workflow Redesign

**Problem**: Setting up a golf pool requires navigating 5 separate pages with no clear guidance on what to do next:
1. `/golf/setup` (~900 lines) — Tournament import, pool settings, public entries config, demo controls, live scoring, all in one
2. `/golf/tiers` — Tier assignments per golfer
3. `/golf/entries` — Entry management
4. `/golf/scores` — Score sync/manual entry
5. `/golf/picks` — Pick sheet

The setup page especially is a wall of options. A commissioner has to figure out the right order themselves.

**Solution**: Guided stepper workflow on the setup page:

**Step 1: Import Tournament**
- Tournament search and import from Slash Golf API
- Clear "done" indicator when tournament is imported
- This is what most commissioners do first

**Step 2: Assign Tiers**
- Auto-tier button (OWGR-based) + manual overrides
- Link to the existing tiers page for detailed editing
- Show count: "42 of 48 golfers tiered"

**Step 3: Configure Pool**
- Lock time, minimum tier points, scoring display
- Public entries toggle
- Compact form — these are just a few settings

**Step 4: Go Live**
- Checklist showing what's done and what's pending
- "Open Pool" button (changes status to open)
- Public URL display and copy button

Add a progress card to the main pool page showing setup completion.

**Design guidance** (from reference architecture — `Wizard<T>` pattern):

The work app has two wizard systems. For golf setup, use the **client-side Wizard** pattern:
- Create a `GolfSetupWizard` state object: `{ steps: WizardStep[], currentStepIndex: number, data: GolfSetupData, isComplete: boolean }`
- Each step component reads/writes to shared wizard state via React Context
- **Validate before advancing** — if a step is incomplete (e.g., no tournament imported), block the "Next" button rather than allowing skip
- Build a **ProgressTimeline** component showing `isDone` (checkmark) / `isCurrent` (highlighted) / `isPending` (greyed) per step
- For **persistent progress** that survives page refresh, store step completion flags in `gp_pools` (e.g., `setup_step: number` or `setup_completed_at: timestamp`)
- On wizard completion (`isComplete: true`), trigger pool status change to "open"

**What NOT to change** (these work well):
- Tournament import from Slash Golf API
- Tier system and auto-tier OWGR assignment
- Public leaderboard and entry form
- Pick sheet interface
- Slash Golf API integration and live scoring
- Unicorn team calculation
- Entry edit via token

**Files to modify**:
- `frontend/src/app/(dashboard)/pools/[id]/golf/setup/page.tsx` — Restructure into stepper
- `frontend/src/app/(dashboard)/pools/[id]/page.tsx` — Add golf setup progress card
- Consider: `frontend/src/components/ui/wizard.tsx` — Reusable wizard shell (also useful for future onboarding)

**Spec file**: `GOLF_SIMPLIFICATION.md` — Created at start of this phase

---

## Phase 4: Architecture Improvements

**Timeline**: Week 3-5 (after Phase 0)
**Dependencies**: Phase 0A
**Priority**: Medium — quality of life

### 4A: Form Library

**Problem**: Forms use raw `useState` for every field. The `create-pool-button.tsx` has 15 state variables. Golf setup has 11. No validation framework.

**Solution**: Introduce React Hook Form + Zod.

**Design guidance** (from reference architecture):
- The work app uses **@ngx-formly** with 50+ custom field types — config-driven forms where you define fields as TypeScript objects, not JSX. The React equivalent is React Hook Form + Zod schemas + shadcn Form components.
- Register **global validators** once in a shared config: `required`, `email`, `phone`, `minLength`, `maxLength`. Each gets a consistent error message template.
- Build a `focusOnFirstInvalidField()` utility that auto-scrolls to the first error on submit — significantly improves UX on long forms.
- **Submission flow**: (1) client validate via Zod → if invalid: show all field errors + scroll to first → (2) fire API call → if error: show toast → (3) on success: close modal / advance step / show success toast
- Consider creating thin wrapper components (e.g., `<FormInput>`, `<FormSelect>`, `<FormRadioGroup>`) that combine shadcn primitives with React Hook Form's `Controller` — this is the equivalent of Formly's registered field types

**Priority forms to convert** (most state variables / most used):
1. `create-pool-button.tsx` — Pool creation dialog (15 state vars)
2. `golf/setup/page.tsx` — Golf pool configuration (11 state vars)
3. `settings/` forms — Email, password, profile updates
4. Score entry dialogs across pool types
5. Member management modals

**Files to create**:
- `frontend/src/lib/form-schemas.ts` — Zod schemas for all major forms
- `frontend/src/lib/form-utils.ts` — `focusOnFirstInvalidField()`, shared validators, submit helpers

### 4B: Data Fetching Helpers

**Problem**: `pools/[id]/page.tsx` is 1200 lines because it fetches data for ALL pool types inline with inline type declarations per pool type.

**Solution**: Extract into per-pool-type data modules:
```
frontend/src/lib/data/
  pool.ts              — Base pool + permissions (shared)
  squares.ts           — sq_pools, sq_squares, sq_games, sq_winners queries
  golf.ts              — gp_pools, gp_tournaments, gp_entries queries
  march-madness.ts     — mm_pools, mm_entries, mm_pool_teams queries
  bowl-buster.ts       — bb_entries, bb_picks queries (remove in Phase 6)
```

Each module exports a typed async function that returns everything a pool type section needs. The pool detail page becomes a thin dispatcher.

**Design guidance** (from reference architecture — Consumer Service pattern):
- The work app uses **Consumer Services** per domain (ProfileConsumerService, ClientConsumerService, TaskConsumerService). The React equivalent is **custom hooks per domain**: `usePoolData(poolId)`, `useSquaresData(poolId)`, `useGolfData(poolId)`, `useMarchMadnessData(poolId)`
- For server components (current pattern), keep the `lib/data/` modules as async functions. For any future client-side fetching, wrap with **React Query**:
  - `staleTime` for time-based caching (e.g., standings can be stale for 30s)
  - `invalidateQueries()` for manual invalidation after mutations (e.g., after entering a score)
  - Supabase Realtime subscriptions as **invalidation signals** — don't reconstruct state from the event payload, just `invalidateQueries(['pool', poolId])`
- **Optimistic updates** via React Query's `onMutate`/`onError`/`onSettled` — save previous state, update cache immediately, revert on failure, refetch on settle
- **Shell + Tabs + Shared State** for pool detail: layout loads base pool data into React Context, type-specific tabs fetch their own additional data. This prevents the 1200-line monolith.

### 4C: Expanded shadcn Usage

Currently installed but underused patterns. Add:
- **Accordion** — Collapsible sections in golf standings (golfer details), pool settings
- **Command** — Search/autocomplete for team selection, golfer search (replace custom implementations)
- **Form** — React Hook Form integration components (with Phase 4A)
- **Breadcrumb** — Replace custom breadcrumb markup across pool pages
- **Skeleton** — Consistent loading states (with Phase 0C)
- **Stepper** (custom or from shadcn registry) — Golf setup workflow (Phase 3)
- **Sonner** (toast) — Server error notifications (with Phase 0C error handling)
- **DataTable** — Build a generic `<DataTable>` component using **TanStack Table**

**Design guidance** (from reference architecture — GridComponent pattern):
The work app's `GridComponent<T>` is its most reused component. Build the React equivalent:
- **Column definitions** with: `name`, `label`, `sortable`, `cellTemplate` (custom renderer component), `cellTemplateOptions` (passed to renderer)
- **Options object**: `showSearch`, `showPagination`, `defaultPageSize`, `rowClickCallback`, filter config
- Built-in states: shimmer skeletons while loading (row count = page size), "No records found" when empty, actual data rows
- Custom cell renderers for: status badges, action buttons (edit/delete), formatted dates, user avatars
- **Where to use**: Members list, standings tables, entries lists, games lists — currently each builds its own table markup

### 4D: Slug Validation Utility

**Problem**: Each pool type validates and generates public slugs independently.

**Solution**: Create `frontend/src/lib/slug.ts` with shared validation logic (format rules, uniqueness check pattern, URL generation). Keep the actual slug column on type-specific tables since URL prefixes differ (`/view/[slug]` for squares, `/pools/golf/[slug]` for golf, `/view/mm/[slug]` for March Madness).

**Spec file**: `UI_PATTERNS.md` — shadcn guidelines, form patterns, loading state patterns

---

## Phase 5: DB Simplification

**Timeline**: Week 4-5
**Dependencies**: Phase 2 (squares cleanup), Phase 0B (RLS fixes)
**Priority**: Medium
**CRITICAL**: All changes tested on dev DB branch first. No production changes until verified.

### 5A: Column Drops

| Table | Column | Reason |
|-------|--------|--------|
| `sq_pools` | `no_account_mode` | Always `true`, concept removed |
| `sq_pools` | `max_squares_per_player` | Always `null`, was for auth mode |
| `pools` | `demo_mode` | Only used by Bowl Buster (being removed). Golf has its own `gp_pools.demo_mode` |

### 5B: FK Cleanup

| Table | FK | Action |
|-------|-----|--------|
| `sq_squares` | `user_id → auth.users` | Drop FK constraint. Keep column nullable. |

### 5C: Function Cleanup

| Function | Action |
|----------|--------|
| `is_org_commissioner(uuid)` | Drop (deprecated, just calls `is_org_admin`) |

### 5D: RLS Policy Consolidation

9 tables have multiple permissive SELECT policies that could be merged. Consolidate into single policies with OR conditions.

### 5E: Index Review

5 potentially unused indexes identified during exploration. Monitor query patterns before dropping. Add indexes where new query patterns demand them (e.g., `sq_pools.event_type` after Phase 1B).

### 5F: Type Regeneration

After every schema change:
```
mcp__supabase__generate_typescript_types
```
Copy output to `frontend/src/types/database.ts`.

---

## Phase 6: Bowl Buster Removal

**Timeline**: Week 5-6
**Dependencies**: Phase 4B (data fetching helpers extracted first)
**Priority**: Low — football is 7+ months away

### 6A: Create Tech Spec Before Deletion

Write `BOWL_BUSTER_TECH_SPEC.md` capturing:
- **Scoring**: Margin-of-victory (correct pick = +margin, wrong = -margin, tie = 0)
- **CFP Bracket**: 12-team format with byes, seeding rules, auto-population trigger
- **Pick Locking**: Bowl games lock 5 min before kickoff, CFP locks at configurable time
- **Game Management**: Commissioner adds bowl games, enters scores, marks final
- **Pool Lifecycle**: draft → open → locked → completed
- **Standings**: Ranked by total score across all bowl picks
- **Onboarding Wizard**: 4-step (org → pool → games → invite) for new commissioners
- **What worked well**: Margin-of-victory scoring, pick locking, onboarding flow
- **What to improve**: CFP bracket UX was confusing, too many tables for CFP structure, onboarding was BB-specific
- **DB Tables**: Summary of all `bb_*` tables and their relationships

Keep this HIGH-LEVEL. Don't specify exact component structures or API signatures. AI models will be significantly better by August 2026 and should design the implementation fresh.

### 6B: Delete Code

Remove from codebase (all stays in git history):
- `frontend/src/components/picks/` — Bowl picks form
- `frontend/src/components/cfp/` — CFP bracket components (6 files)
- `frontend/src/components/games/` — Game management components (5 files)
- `frontend/src/components/standings/pool-standings.tsx` — Bowl standings
- `frontend/src/app/(dashboard)/pools/[id]/games/page.tsx`
- `frontend/src/app/(dashboard)/pools/[id]/picks/page.tsx`
- `frontend/src/app/(dashboard)/pools/[id]/cfp/page.tsx`
- `frontend/src/app/(dashboard)/pools/[id]/cfp-picks/page.tsx`
- `frontend/src/app/onboarding/page.tsx` — Bowl Buster specific onboarding
- Bowl Buster section in `pools/[id]/page.tsx` — Remove conditional rendering block

**DO NOT DELETE**:
- `bb_teams` table — Shared with March Madness (`mm_pool_teams.team_id` → `bb_teams.id`)
- Any `bb_*` database tables — Keep data for historical reference, just unused by app
- Any RLS policies on `bb_*` tables — Leave in place, no harm

### 6C: Disable in Site Settings

Set `bowl_buster: false` in `site_settings` via `get_enabled_pool_types()`.
Remove `'bowl_buster'` from the pool type selector in `create-pool-button.tsx`.

**Spec file**: `BOWL_BUSTER_TECH_SPEC.md`

---

## Phase 7: Dev Environment

**Timeline**: When time permits (after March Madness ships)
**Dependencies**: None
**Priority**: Nice-to-have

### 7A: Docker Local Dev

Inspired by the user's work environment (Coast Guard recruiting app with Docker + seeded Postgres).

**Design guidance** (from reference architecture):
- The work app runs 12+ Docker services. BN Pools is simpler — consider **`supabase start`** (Supabase CLI) as the primary local dev tool. It gives Postgres + Auth + Realtime + Storage + Edge Functions + Studio in one command, without maintaining a custom Docker Compose.
- If full Docker Compose is needed later, the work app's **profiles** pattern is useful: `docker compose --profile product-line-vets up -d` runs only one product line's services.
- Create a **seed script** (`npm run seed`) with: test org, users with each role tier (super admin, org admin, commissioner, member), sample pools of each type in various states (draft, open, completed).
- The work app's **UserFactory** pattern translates directly: `createTestUser({ role: 'commissioner', org: testOrg })` for consistent test data creation.

Setup:
- `supabase start` for local Supabase stack (preferred over custom Docker)
- Seed script with test data: org, users with different roles, sample pools of each type
- Document the workflow: `supabase start` → `npm run seed` → `npm run dev` → ready

### 7B: Multi-Environment Pipeline

**Design guidance** (from reference architecture):
The work app has a sophisticated 4-environment cascade (dev → UAT → staging → production) with automated promotions. BN Pools needs something simpler but following the same principles.

Use **Vercel's built-in environments**:
- **Local dev**: Supabase CLI + Next.js dev server
- **Preview** (automatic): Vercel creates preview deploys on every PR branch, paired with Supabase branch DBs for migration testing
- **Production**: Main branch auto-deploys to Vercel, migrations via `supabase db push` after dev validation

Environment variables managed per-environment in the Vercel dashboard. Supabase has separate projects for staging vs. production if needed.

### 7C: CI/CD

**Design guidance** (from reference architecture):
The work app uses **affected-based CI** — `nx show projects --affected` determines which projects need testing, skipping unchanged ones. BN Pools is a single app, but the same principle applies: only run full test suite when relevant files change.

GitHub Actions workflow:
- **On PR**: Lint + type check + Vitest unit tests + build check
- **On merge to main**: Full build + deploy to Vercel + migration validation
- Consider: **Claude auto-review** on PRs (the work app uses `claude-auto-review.yml` for AI-powered PR review)

**Testing stack** (from reference architecture):
- **Vitest** for unit tests (faster than Jest for Next.js)
- **Playwright** for E2E tests (preferred over Cypress for Next.js)
- **`data-testid` attributes** on all interactive elements for reliable E2E selection
- **UserFactory** helper for generating test users with specific roles: `createAdmin()`, `createCommissioner()`, `createMember()`
- **RLS testing**: Create Supabase clients authenticated as different users and verify they can/can't access specific rows

**Spec file**: `DEV_ENVIRONMENT.md`

---

## Dependency Graph

```
Phase 0 (Foundations) ─── No dependencies, start immediately
├── 0A: Permission helpers ──────→ Enables Phases 1, 3, 4B
├── 0B: RLS fixes (dev DB) ─────→ Security prerequisite
└── 0C: Error boundaries ───────→ Quality of life

Phase 1 (March Madness) ─── Depends on 0A | TIME SENSITIVE
├── 1A: Blind draw improvements ──→ Ship before mid-March
└── 1B: Generic squares + MM mode → Ship before mid-March

Phase 2 (Squares cleanup) ─── Independent, parallel with Phase 1
├── 2A: Remove no-account naming ─→ Code cleanliness
└── 2B: DB column cleanup ────────→ Depends on 2A, test on dev DB

Phase 3 (Golf simplification) ─── Depends on 0A, parallel with Phase 1
├── 3A: Commissioner stepper ─────→ UX improvement
└── 3B: Demo mode consolidation ──→ After Phase 6

Phase 4 (Architecture) ─── Depends on 0A for 4B, rest independent
├── 4A: Form library (RHF + Zod) ─→ Independent
├── 4B: Data fetching helpers ────→ Depends on 0A
├── 4C: More shadcn ─────────────→ Independent
└── 4D: Slug utility ────────────→ Independent

Phase 5 (DB simplification) ─── Depends on Phase 2
├── 5A-D: Schema changes ────────→ Dev DB only
└── 5E: Type regeneration ───────→ After each schema change

Phase 6 (Bowl Buster removal) ─── Depends on 4B (extract data helpers first)
├── 6A: Write tech spec ─────────→ Before deletion
├── 6B: Delete code ─────────────→ After 6A
└── 6C: Disable in settings ─────→ After 6B

Phase 7 (Dev environment) ─── Independent, low priority
├── 7A: Docker setup ────────────→ Anytime
├── 7B: Multi-env docs ──────────→ Anytime
└── 7C: CI/CD ───────────────────→ Anytime
```

## Parallelization Strategy

| Timeframe | Work Streams |
|-----------|-------------|
| **Week 1-2** | Phase 0 (all three tracks) |
| **Week 2-3** | Phase 1 (March Madness — both tracks) + Phase 2 (Squares cleanup) |
| **Week 3-4** | Phase 3 (Golf) + Phase 4 (Architecture) |
| **Week 4-5** | Phase 5 (DB simplification) + Phase 4 continued |
| **Week 5-6** | Phase 6 (Bowl Buster removal) |
| **Later** | Phase 7 (Dev environment) |

---

## Companion Spec Files

These files are created as each phase begins, not all upfront. Each contains detailed implementation specifics for its area.

| File | Created In | Purpose |
|------|-----------|---------|
| `PERMISSIONS_SPEC.md` | Phase 0 | Centralized permission system design, RLS migration plan, test matrix |
| `MARCH_MADNESS_IMPROVEMENTS.md` | Phase 1A | Blind draw: next-round population, mobile bracket, public view, commissioner UX |
| `MARCH_MADNESS_SQUARES.md` | Phase 1B | Generic squares type, event_type system, MM tournament mode (63 games), single game |
| `GOLF_SIMPLIFICATION.md` | Phase 3 | Commissioner stepper workflow, setup page restructure, progress indicators |
| `UI_PATTERNS.md` | Phase 4 | shadcn component guidelines, form patterns (RHF + Zod), loading/error patterns |
| `BOWL_BUSTER_TECH_SPEC.md` | Phase 6 | High-level archival: scoring rules, CFP mechanics, pick locking, what to preserve |
| `DEV_ENVIRONMENT.md` | Phase 7 | Docker Compose setup, multi-env pipeline, CI/CD workflows |

---

## Risk Mitigation

### March Madness Deadline
Phase 1 has minimal dependencies (only 0A). If permissions refactor takes longer than expected, March Madness work can proceed with the existing inline permission checks and refactor later. The feature work is the priority.

### Database Changes
ALL schema changes go through the dev DB branch first. Migration flow:
1. Write migration SQL
2. Apply to dev branch DB via `mcp__supabase__apply_migration`
3. Test the app against dev branch
4. Verify via `mcp__supabase__get_advisors` (security + performance)
5. Only then apply to production

### Breaking Changes
- Permission helper refactor (0A) is mechanical — extract existing code into functions. No behavior change.
- Squares rename (2A) is cosmetic — rename variables and types. No behavior change.
- Generic squares type (1B) is additive — new event_type column, expanded round values. Existing pools keep working.
- Bowl Buster removal (6) is subtractive but safe — code in git history, data in DB.

### Bowl Buster Dependencies
`bb_teams` is referenced by `mm_pool_teams.team_id`. The table and its data MUST be preserved even after Bowl Buster code removal. Consider renaming to `teams` in a future migration if it becomes a shared resource for other pool types.

### Rollback Strategy
Each phase is independently deployable. If a phase causes issues:
- Git revert the commits for that phase
- DB migrations: write a reverse migration (or restore from dev branch snapshot)
- Site settings: re-enable disabled pool types instantly

---

## Reference: Key Files

These are the most critical files that will be touched across multiple phases:

| File | Lines | Phases | Why |
|------|-------|--------|-----|
| `pools/[id]/page.tsx` | 1200 | 0A, 1B, 2A, 4B, 6B | Central hub for all pool types |
| `pools/create-pool-button.tsx` | ~300 | 1B, 2A, 4A, 6C | Pool creation with type selector |
| `pools/[id]/members/page.tsx` | ~667 | 0A, 2A | Permission checks + no-account conditionals |
| `golf/setup/page.tsx` | ~900 | 0A, 3A, 4A | Commissioner setup (to be restructured) |
| `march-madness/march-madness-content.tsx` | ~500 | 1A | Main MM UI component |
| `march-madness/bracket-view.tsx` | ~800 | 1A | Desktop bracket (needs mobile) |
| `supabase/migrations/00000000000000_schema.sql` | ~4000 | 0B, 1B, 2B, 5A-D | Full DB schema |
| `types/database.ts` | ~2000 | 5F | Auto-generated, regenerate after schema changes |
| `lib/supabase/middleware.ts` | ~60 | 0B | Auth + deactivation checks |

---

## Future Consideration: JSONB Schema Consolidation (v2)

Currently 39 tables across 5 domains. Each pool type has its own set of tables (sq_*, gp_*, mm_*, bb_*). A future v2 could consolidate using JSONB columns:

**Tier 1 — Pool Config (highest value, lowest risk):**
Merge `sq_pools` (18 cols), `gp_pools` (9 cols), `mm_pools` (17 cols) into a single `config JSONB` column on the `pools` table. These are all 1:1 with pools. Adding new pool types becomes just a new config shape instead of a new table + migration + types + RLS policies.

**Tier 2 — Entries (medium value, needs careful RLS work):**
`gp_entries`, `mm_entries`, `bb_entries` all share the same skeleton: pool_id, user_id/participant_name, status, created_at. Type-specific data (picks, scores, bracket positions) could be JSONB. One unified `pool_entries` table = one RLS policy, one membership check.

**Tier 3 — Games/Matches (questionable):**
`sq_games` (25 cols) and `mm_games` (21 cols) are very different shapes with frequent individual field updates (scores, status). JSONB partial updates are clunkier than direct column updates.

**Don't touch:** Reference data (gp_golfers, gp_tournaments, bb_teams), high-volume query targets (gp_golfer_results, gp_tier_assignments), individual-cell-level data (sq_squares).

**Decision**: Save for v2. Current table structure works, and the JSONB migration would touch almost every query in the codebase. Revisit after the current overhaul phases stabilize.

---

## Notes for Future AI Sessions

- This overhaul will span multiple conversations. Each phase should reference this document.
- The companion spec files provide implementation detail. This document provides strategic direction.
- When in doubt about a decision, check the "Key Decisions" section at the top.
- **`tech_questions.md`** contains 25 detailed Q&A pairs with code examples from the user's work app. The "Reference Architecture Patterns" section above summarizes the key takeaways, but consult the full file for implementation-level detail (guard code, wizard state management, grid component APIs, etc.).
- The "Reference Architecture Patterns" section maps work app concepts to BN Pools equivalents. Use these as blueprints, not carbon copies — adapt to Next.js App Router + Supabase + React patterns.
- March Madness is the hard deadline. Everything else can flex.
