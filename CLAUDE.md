# BN Pools - Bowl Buster

## Project Overview
A multi-tenant bowl pool management application built with Next.js 16 and Supabase.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **MCP**: Supabase MCP server for database management

## Current Status: MVP In Progress

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
- [x] Pool activation (draft -> active status)

### In Progress
- [ ] Picks UI - Allow users to make bowl game picks

### Not Started
- [ ] Picks page (`/pools/[id]/picks`) - Select winners for each game
- [ ] Standings page (`/pools/[id]/standings`) - Leaderboard with scores
- [ ] Members management (`/pools/[id]/members`) - Approve/reject join requests
- [ ] Join links - Generate invite links for pools
- [ ] CFP bracket picks (separate from bowl picks)
- [ ] Score calculation (margin-of-victory scoring)
- [ ] Game locking (5 min before kickoff)

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
│   │   │   │           └── games/
│   │   │   └── auth/callback/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── orgs/
│   │   │   ├── pools/
│   │   │   └── games/
│   │   ├── lib/supabase/     # Client, server, middleware
│   │   └── types/database.ts # Auto-generated types
│   └── .env.local            # Supabase URL + anon key
└── Claude_BowlBuster_V1_Part*.md  # Spec documents
```

## Database Tables

### Core/Shared
- `profiles` - User profiles with `is_super_admin` flag
- `organizations` - Multi-tenant orgs
- `org_memberships` - User roles in orgs (commissioner/member)
- `pools` - Bowl pools within orgs
- `pool_memberships` - User membership in pools (pending/approved)
- `join_links` - Invite links for pools
- `audit_log` - Commissioner actions

### Bowl Buster
- `bb_teams` - College football teams
- `bb_games` - Bowl games with scores/status
- `bb_pool_games` - Games included in a pool
- `bb_entries` - User entries in a pool
- `bb_bowl_picks` - User picks for each game

### CFP Bracket (Not Yet Implemented)
- `bb_cfp_templates` - Bracket templates
- `bb_cfp_template_slots` - Bracket slot definitions
- `bb_cfp_pool_config` - Pool CFP settings
- `bb_cfp_pool_round1` - First round matchups
- `bb_cfp_pool_slot_games` - Slot to game mappings
- `bb_cfp_entry_picks` - User bracket picks

## Key Files to Know

| File | Purpose |
|------|---------|
| `frontend/src/lib/supabase/server.ts` | Server-side Supabase client |
| `frontend/src/lib/supabase/client.ts` | Browser Supabase client |
| `frontend/src/types/database.ts` | TypeScript types (regenerate with MCP) |
| `frontend/src/app/(dashboard)/layout.tsx` | Dashboard layout with header/nav |
| `frontend/src/components/pools/pool-settings.tsx` | Pool activation controls |
| `frontend/src/components/games/add-game-button.tsx` | Add game modal |

## Next Steps (Priority Order)

1. **Build Picks Page** (`/pools/[id]/picks`)
   - List all games in the pool
   - For each game, show team buttons to pick winner
   - Save picks to `bb_bowl_picks` table
   - Show lock status (game locks 5 min before kickoff)
   - Need RLS policies for `bb_entries` and `bb_bowl_picks`

2. **Create Entry Flow**
   - "Create Entry" button already exists on pool page
   - Need to add RLS policy for `bb_entries` INSERT

3. **Standings Page** (`/pools/[id]/standings`)
   - Query all entries with picks
   - Calculate scores using `calculate_pick_score` function
   - Display leaderboard

4. **Members Management** (`/pools/[id]/members`)
   - List pending/approved members
   - Approve/reject buttons for commissioners

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

- Dev server may already be running in background (task bc99f24)
- Super admin account is set up (user set `is_super_admin = true` manually)
- Pool is created and has games added, ready for picks UI
- Input text color fix applied in `globals.css`
