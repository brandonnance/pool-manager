# BN Pools - Bowl Buster

## Project Overview
A multi-tenant bowl pool management application built with Next.js 16 and Supabase.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **MCP**: Supabase MCP server for database management

## Current Status: MVP Complete

### Completed
- [x] Supabase MCP server setup (npx-based with PAT)
- [x] Database schema with 18 tables and RLS policies
- [x] Next.js project scaffolding with Supabase SSR auth
- [x] Authentication (login, signup, logout, session management)
- [x] Super admin support (`is_super_admin` flag bypasses RLS)
- [x] Organizations CRUD (create, list, detail pages)
- [x] Pools CRUD (create within orgs, detail page)
- [x] Games management (add bowl games with teams, kickoff times)
- [x] Teams management (add teams on-the-fly when creating games)
- [x] Pool activation (draft -> open status)
- [x] Bowl picks page (`/pools/[id]/picks`) - Pick winners for each bowl game
- [x] CFP bracket picker (`/pools/[id]/cfp-picks`) - Interactive bracket UI
- [x] Standings on pool page - Margin-of-victory scoring
- [x] Score entry for commissioners - Enter final scores for games
- [x] Commissioner tools accessible when pool is open
- [x] Pick deletion on team changes (bowl: single game, CFP: all picks)
- [x] Entry creation auto-creates pool membership
- [x] Members management (`/pools/[id]/members`) - List, approve/reject/remove members
- [x] Join links - Generate/copy/delete invite links with expiration and max uses
- [x] Public join page (`/join/[token]`) - Validates token, handles auth redirect
- [x] Game locking - Bowl picks lock 5 min before kickoff, CFP locks at `cfp_lock_at`
- [x] Pool completion - Commissioner can complete pool when all games final, winner highlight in standings
- [x] Hybrid org membership - Pool join auto-creates org membership, dashboard groups pools by org
- [x] Pool visibility - Commissioners can set pools to "invite_only" or "open_to_org"
- [x] Pool discovery - Org members can see and join "open_to_org" pools from dashboard
- [x] CFP auto-population - When games are marked final, next round games auto-populate with winners (DB trigger)
- [x] User management & permissions system (4-tier role hierarchy)
- [x] Onboarding wizard for new users (create org → pool → games → invite)
- [x] Self-service org creation for any authenticated user

### MVP Complete!

## Project Structure

```
pool-manager/
├── .mcp.json                 # Supabase MCP config
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/       # Login, signup pages
│   │   │   ├── (dashboard)/  # Protected pages
│   │   │   │   ├── dashboard/
│   │   │   │   ├── orgs/
│   │   │   │   │   └── [id]/
│   │   │   │   └── pools/
│   │   │   │       └── [id]/
│   │   │   │           ├── games/     # Commissioner game management
│   │   │   │           ├── picks/     # Bowl picks page
│   │   │   │           ├── cfp/       # CFP bracket management
│   │   │   │           ├── cfp-picks/ # CFP bracket picker
│   │   │   │           └── members/   # Members management
│   │   │   ├── onboarding/   # New user wizard (org → pool → games → invite)
│   │   │   ├── join/[token]/ # Public join link redemption
│   │   │   └── auth/callback/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── orgs/
│   │   │   ├── pools/
│   │   │   ├── games/
│   │   │   ├── cfp/           # CFP bracket components
│   │   │   ├── members/       # Member management components
│   │   │   └── standings/     # Pool standings component
│   │   ├── lib/supabase/     # Client, server, middleware
│   │   └── types/database.ts # Auto-generated types
│   └── .env.local            # Supabase URL + anon key
└── Claude_BowlBuster_V1_Part*.md  # Spec documents
```

## Database Tables

### Core/Shared
- `profiles` - User profiles with `is_super_admin` flag
- `organizations` - Multi-tenant orgs with `tier` field (free/basic/pro)
- `org_memberships` - User roles in orgs (admin/member)
- `pools` - Bowl pools within orgs
- `pool_memberships` - User membership in pools with `role` (commissioner/member) and `status` (pending/approved)
- `join_links` - Invite links for pools
- `audit_log` - Commissioner actions

### Bowl Buster
- `bb_teams` - College football teams
- `bb_games` - Bowl games with scores/status
- `bb_pool_games` - Games included in a pool (kind: 'bowl' or 'cfp')
- `bb_entries` - User entries in a pool
- `bb_bowl_picks` - User picks for bowl games

### CFP Bracket
- `bb_cfp_pool_byes` - Top 4 seeds that get first-round byes
- `bb_cfp_pool_round1` - First round matchups (seeds 5-12)
- `bb_cfp_entry_picks` - User bracket picks for each slot

## Key Files to Know

| File | Purpose |
|------|---------|
| `frontend/src/lib/supabase/server.ts` | Server-side Supabase client |
| `frontend/src/lib/supabase/client.ts` | Browser Supabase client |
| `frontend/src/types/database.ts` | TypeScript types (regenerate with MCP) |
| `frontend/src/app/(dashboard)/layout.tsx` | Dashboard layout with header/nav |
| `frontend/src/components/pools/pool-settings.tsx` | Pool activation controls |
| `frontend/src/components/games/add-game-button.tsx` | Add game modal |
| `frontend/src/components/games/enter-score-button.tsx` | Score entry modal |
| `frontend/src/components/games/edit-spread-button.tsx` | Edit game details modal |
| `frontend/src/components/standings/pool-standings.tsx` | Standings table |
| `frontend/src/components/cfp/cfp-bracket-picker.tsx` | Interactive CFP bracket |
| `frontend/src/app/(dashboard)/pools/[id]/members/page.tsx` | Members management page |
| `frontend/src/components/members/member-actions.tsx` | Approve/reject/remove buttons |
| `frontend/src/components/members/generate-link-button.tsx` | Create invite link modal |
| `frontend/src/app/join/[token]/page.tsx` | Public join link redemption |
| `frontend/src/app/onboarding/page.tsx` | New user onboarding wizard |

## Role & Permissions System

### Role Hierarchy (Top to Bottom)

1. **Super Admin** (`profiles.is_super_admin = true`)
   - Full access across all orgs, bypasses RLS
   - Can create organizations

2. **Org Admin** (`org_memberships.role = 'admin'`)
   - Full org control: settings, members, billing (future)
   - Can create/delete pools
   - Can appoint other admins
   - Implicit commissioner on ALL pools in org
   - Can appoint pool commissioners

3. **Pool Commissioner** (`pool_memberships.role = 'commissioner'`)
   - Pool-specific management (multiple commissioners allowed per pool)
   - Manage pool members (approve/reject/remove)
   - Pool settings (visibility, activation, completion)
   - Enter scores, manage games
   - **Cannot** delete pool (only org admin can)
   - **Cannot** appoint other commissioners (only org admin can)

4. **Member** (`org_memberships.role = 'member'` / `pool_memberships.role = 'member'`)
   - Invited via pool join links
   - Auto-added to org membership when joining pool
   - Make picks, view standings

### Permission Check Pattern (Frontend)

```typescript
const isOrgAdmin = orgMembership?.role === 'admin' || isSuperAdmin
const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin
```

### Key RLS Helper Functions

- `is_org_admin(org_id)` - Check if user is org admin
- `is_pool_commissioner(pool_id)` - Check if user is pool commissioner (direct OR via org admin)

## Scoring Logic

Bowl picks use margin-of-victory scoring:
- **Correct pick**: +margin (e.g., pick winner by 14 = +14 points)
- **Wrong pick**: -margin (e.g., pick loser by 14 = -14 points)
- **Tie games**: No points awarded

## Pick Deletion Rules

When teams are changed on games:
- **Bowl games**: Only picks for that specific game are deleted
- **CFP games/byes**: ALL CFP bracket picks for ALL users in the pool are deleted (cascading picks make partial updates impractical)

## Potential Future Enhancements

1. **CFP Scoring**
   - Points for correct CFP bracket picks
   - Different point values per round (R1=1, QF=2, SF=4, F=8)

2. **Notifications**
   - Email notifications for game results
   - Reminders to make picks before lock

3. **Enhanced Stats**
   - Pick accuracy percentages
   - Historical pool results

## Running the Project

```bash
cd frontend
npm run dev
# Opens at http://localhost:3000
```

## Supabase MCP Commands

The MCP server is configured in `.mcp.json`. Use these tools:
- `mcp__supabase__execute_sql` - Run queries
- `mcp__supabase__apply_migration` - Apply schema changes
- `mcp__supabase__generate_typescript_types` - Regenerate types
- `mcp__supabase__list_tables` - View tables
- `mcp__supabase__get_advisors` - Check for security issues

## Notes

- Dev server runs on http://localhost:3000
- Super admin account is set up (user set `is_super_admin = true` manually)
- Pool statuses: draft -> open -> locked -> completed
- Game statuses: scheduled -> in_progress -> final
- Dark mode disabled in `globals.css` (app uses light theme only)
- Join requests go to "pending" status, commissioners approve via `/pools/[id]/members`
- Hybrid org membership: joining a pool auto-creates org membership (DB trigger)
- Pool visibility: `invite_only` (default) or `open_to_org` (discoverable by org members)
- CFP bracket auto-population: `cfp_auto_populate_trigger` on bb_games updates next round games when status='final'
  - R1 winner + bye team → QF game
  - QF winners → SF game: QFA+QFD → SFA, QFB+QFC → SFB
  - SF winners → Final (when both SF games are final)
- CFP seeds display on games page (seeds 1-12 shown next to team names for CFP games)
- CFP bracket seeding: R1A=#8v#9→#1, R1B=#7v#10→#2, R1C=#6v#11→#3, R1D=#5v#12→#4
- Onboarding wizard: New users with no org memberships are redirected to `/onboarding` (4-step wizard: org → pool → games → invite)
- Pool creation auto-creates commissioner membership for the creator (DB trigger: `pool_commissioner_trigger`)
- Self-service org creation: Any authenticated user can create organizations via dashboard or onboarding wizard
- Org roles: `admin` (full control) or `member` (read-only) - note: renamed from previous "commissioner" terminology
- Pool roles: `commissioner` (manage pool) or `member` (participate only) - stored in `pool_memberships.role`
