# BN Pools – Bowl Buster (V1) Build Brief for Claude (Part 2: Database + RLS + Migrations)

> You have Supabase MCP available. Create migrations for schema, RLS policies, and helper functions.
> Keep it modular: one migration for shared tables, one for bowl-buster module, one for RLS/policies, one for seed/demo.

## 1) Shared tables (multi-tenant foundation)

### `organizations`
- `id` uuid pk default gen_random_uuid()
- `name` text not null
- `created_at` timestamptz default now()

### `profiles`
- `id` uuid pk references auth.users(id) on delete cascade
- `display_name` text
- `created_at` timestamptz default now()

### `org_memberships`
- `id` uuid pk
- `org_id` uuid references organizations(id) on delete cascade
- `user_id` uuid references auth.users(id) on delete cascade
- `role` text check in ('commissioner','member')
- `created_at` timestamptz default now()
- unique (org_id, user_id)

### `pools`
- `id` uuid pk
- `org_id` uuid references organizations(id) on delete cascade
- `type` text check in ('bowl_buster')  -- extend later
- `name` text not null
- `season_label` text (e.g., "2025-26")
- `status` text check in ('draft','open','locked','completed') default 'draft'
- `settings` jsonb default '{}'::jsonb
  - for bowl_buster include: `cfp_lock_at`, `score_refresh_minutes`, etc.
- `created_by` uuid references auth.users(id)
- `created_at` timestamptz default now()

### `pool_memberships`
- `id` uuid pk
- `pool_id` uuid references pools(id) on delete cascade
- `user_id` uuid references auth.users(id) on delete cascade
- `status` text check in ('pending','approved','rejected') default 'pending'
- `approved_by` uuid references auth.users(id)
- `approved_at` timestamptz
- `created_at` timestamptz default now()
- unique (pool_id, user_id)

### `join_links`
- `id` uuid pk
- `pool_id` uuid references pools(id) on delete cascade
- `token` text unique not null  -- random
- `expires_at` timestamptz
- `max_uses` int
- `uses` int default 0
- `created_by` uuid references auth.users(id)
- `created_at` timestamptz default now()

### `audit_log`
- `id` uuid pk
- `org_id` uuid references organizations(id) on delete cascade
- `pool_id` uuid references pools(id) on delete set null
- `actor_user_id` uuid references auth.users(id) on delete set null
- `action` text not null -- e.g. 'pick_override', 'approve_member', 'unlock_exception'
- `entity_table` text not null
- `entity_id` uuid not null
- `before` jsonb
- `after` jsonb
- `reason` text
- `created_at` timestamptz default now()

## 2) Bowl Buster module tables

### Teams
`bb_teams`
- `id` uuid pk
- `name` text not null
- `abbrev` text
- `logo_url` text
- unique(name)

### Games (real-world)
`bb_games`
- `id` uuid pk
- `external_source` text check in ('cfbd','espn') not null
- `external_game_id` text not null
- `kickoff_at` timestamptz
- `home_team_id` uuid references bb_teams(id)
- `away_team_id` uuid references bb_teams(id)
- `status` text check in ('scheduled','live','final') default 'scheduled'
- `home_score` int
- `away_score` int
- `updated_at` timestamptz default now()
- unique(external_source, external_game_id)

### Which games are included in a pool
`bb_pool_games`
- `id` uuid pk
- `pool_id` uuid references pools(id) on delete cascade
- `game_id` uuid references bb_games(id) on delete cascade
- `kind` text check in ('bowl','cfp') not null
- `label` text  -- e.g. 'Pop-Tarts Bowl', 'CFP R1 Game A'
- unique(pool_id, game_id)

### Entries (1 per approved membership)
`bb_entries`
- `id` uuid pk
- `pool_id` uuid references pools(id) on delete cascade
- `user_id` uuid references auth.users(id) on delete cascade
- `created_at` timestamptz default now()
- unique(pool_id, user_id)

### Bowl picks
`bb_bowl_picks`
- `id` uuid pk
- `entry_id` uuid references bb_entries(id) on delete cascade
- `pool_game_id` uuid references bb_pool_games(id) on delete cascade
- `picked_team_id` uuid references bb_teams(id)
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- unique(entry_id, pool_game_id)

## 3) CFP bracket template + per-pool config + per-entry picks

### Template (slot wiring)
`bb_cfp_templates`
- `id` uuid pk
- `name` text not null -- e.g. 'CFP 12-team (2024+)'
- `created_at` timestamptz default now()

`bb_cfp_template_slots`
- `id` uuid pk
- `template_id` uuid references bb_cfp_templates(id) on delete cascade
- `slot_key` text not null -- 'R1A','QFA','SFA','F'
- `round` text not null -- 'R1','QF','SF','F'
- `depends_on_slot_a` text -- slot_key
- `depends_on_slot_b` text -- slot_key
- `created_at` timestamptz default now()
- unique(template_id, slot_key)

### Pool config (chooses template + lock + round-1 participants)
`bb_cfp_pool_config`
- `pool_id` uuid pk references pools(id) on delete cascade
- `template_id` uuid references bb_cfp_templates(id)
- `cfp_lock_at` timestamptz not null
- `created_at` timestamptz default now()

`bb_cfp_pool_round1`
- `id` uuid pk
- `pool_id` uuid references pools(id) on delete cascade
- `slot_key` text not null -- must be an R1 slot in template
- `team_a_id` uuid references bb_teams(id)
- `team_b_id` uuid references bb_teams(id)
- `game_id` uuid references bb_games(id)  -- link to real game for that slot
- unique(pool_id, slot_key)

### Entry picks by slot
`bb_cfp_entry_picks`
- `id` uuid pk
- `entry_id` uuid references bb_entries(id) on delete cascade
- `slot_key` text not null
- `picked_team_id` uuid references bb_teams(id)
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- unique(entry_id, slot_key)

## 4) Helper functions (recommended)
Create SECURITY DEFINER functions for:
- `is_org_commissioner(org_id uuid) returns boolean`
- `is_pool_commissioner(pool_id uuid) returns boolean` (via pool.org_id membership)
- `user_org_ids() returns setof uuid` convenience
- `pool_lock_time_for_bowl(pool_game_id uuid) returns timestamptz`
- `is_cfp_locked(pool_id uuid) returns boolean` based on `bb_cfp_pool_config.cfp_lock_at`

## 5) RLS policy outline (do NOT skip)
Enable RLS on all tables except maybe templates (read-only).

### Shared:
- Organizations: user can SELECT orgs they’re a member of
- Org memberships: commissioner can manage memberships; members can read their own membership
- Pools: members of org can read; commissioners can write
- Pool memberships: commissioners can approve/reject; users can create pending for themselves via join link flow
- Join links: commissioners can create; anyone with token can use via RPC (safer) rather than direct table write
- Audit log: org members can read; only system/commissioner inserts

### Bowl picks:
- Approved pool members can SELECT their entry + picks for that pool
- Approved pool members can INSERT/UPDATE their own picks ONLY if not locked
- Commissioners can override picks regardless of lock

### CFP picks:
- Approved pool members can INSERT/UPDATE their CFP picks ONLY if `now() < cfp_lock_at`
- Commissioners can override regardless

## 6) Stored procedures (join via link)
Implement an RPC like:
`request_join_pool(token text) returns void`
- find join_links row by token; validate not expired and max uses not exceeded
- create/update pool_memberships for auth.uid() with status='pending'
- increment uses
This avoids exposing join_links or pool_memberships inserts to the public.

## 7) Indexing
Add indexes on:
- org_memberships(org_id,user_id)
- pool_memberships(pool_id,status)
- bb_pool_games(pool_id)
- bb_bowl_picks(entry_id)
- bb_cfp_entry_picks(entry_id)
- bb_games(status,kickoff_at)

## 8) Seed data (dev only)
- Create one org, one commissioner membership, one pool, a few teams, a few games, and a CFP template with slots.
