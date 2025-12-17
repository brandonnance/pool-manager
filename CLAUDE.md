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
- [x] Pool activation (draft -> open status)
- [x] Bowl picks page (`/pools/[id]/picks`) - Pick winners for each bowl game
- [x] CFP bracket picker (`/pools/[id]/cfp-picks`) - Interactive bracket UI
- [x] Standings on pool page - Margin-of-victory scoring
- [x] Score entry for commissioners - Enter final scores for games
- [x] Commissioner tools accessible when pool is open
- [x] Pick deletion on team changes (bowl: single game, CFP: all picks)
- [x] Entry creation auto-creates pool membership

### In Progress
- [ ] Members management (`/pools/[id]/members`) - Approve/reject join requests

### Not Started
- [ ] Join links - Generate invite links for pools
- [ ] Game locking (5 min before kickoff)
- [ ] Pool completion status (open -> locked -> completed)

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
│   │   │   │           └── cfp-picks/ # CFP bracket picker
│   │   │   └── auth/callback/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── orgs/
│   │   │   ├── pools/
│   │   │   ├── games/
│   │   │   ├── cfp/           # CFP bracket components
│   │   │   └── standings/     # Pool standings component
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

## Scoring Logic

Bowl picks use margin-of-victory scoring:
- **Correct pick**: +margin (e.g., pick winner by 14 = +14 points)
- **Wrong pick**: -margin (e.g., pick loser by 14 = -14 points)
- **Tie games**: No points awarded

## Pick Deletion Rules

When teams are changed on games:
- **Bowl games**: Only picks for that specific game are deleted
- **CFP games/byes**: ALL CFP bracket picks for ALL users in the pool are deleted (cascading picks make partial updates impractical)

## Next Steps (Priority Order)

1. **Members Management** (`/pools/[id]/members`)
   - List pending/approved members
   - Approve/reject buttons for commissioners

2. **Join Links**
   - Generate shareable invite links
   - Auto-approve or pending based on pool settings

3. **Game Locking**
   - Lock picks 5 minutes before kickoff
   - Show locked status in picks UI

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
- Input text color fix applied in `globals.css`
