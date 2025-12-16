# BN Pools – Bowl Buster (V1) Build Brief for Claude (Part 3: Frontend UX + Sync/Scoring)

## 1) Pages / routes (suggested)
### Auth + tenant selection
- `/login`
- `/orgs` (list orgs you belong to; create org if commissioner)
- `/org/:orgId` (org home: pools list + members)

### Pool flows
- `/org/:orgId/pools/new` (commissioner create pool)
- `/pool/:poolId` (pool home: rules, deadlines, join link, status)
- `/pool/:poolId/join/:token` (requests join via RPC; shows “pending approval”)

### Player
- `/pool/:poolId/bowls` (bowl picks list; each game choose winner; lock countdown)
- `/pool/:poolId/cfp` (CFP bracket UI; lock countdown)
- `/pool/:poolId/standings` (leaderboard)
- `/pool/:poolId/my-picks` (read-only view of submitted picks)

### Commissioner admin
- `/pool/:poolId/admin`
  - members (approve/reject)
  - bowl slate (add/remove games; set kickoff if manual)
  - CFP setup (choose template; set lock time; set Round 1 matchups)
  - overrides (edit picks after lock)
  - audit log

## 2) CFP bracket UI (implementation approach)
- Render bracket from `bb_cfp_template_slots` + `bb_cfp_pool_round1`
- Store picks as `bb_cfp_entry_picks` (winner per slot)
- Derive participants for later slots:
  - participantA = winner pick of depends_on_slot_a
  - participantB = winner pick of depends_on_slot_b
- When user clicks winner in a slot:
  - upsert that slot pick
  - automatically clear downstream picks that are now invalid (because participants changed)
    - e.g. if SF participant changes, clear SF pick and Final pick(s) affected

Lock display:
- show CFP lock timestamp
- disable all inputs when locked (except commissioner route)

## 3) Bowl picks UI
- Show list/table: kickoff time, teams, (optional odds/spread), user selection
- Compute per-row lock time = kickoff - 5 minutes
- Disable the selector after lock time

## 4) Standings computation
### Simple approach (V1)
Compute on demand in SQL view or RPC:
- Sum per entry:
  - bowls: join picks → game final scores
  - CFP: for each CFP slot, map it to a `bb_games` row (Round1 uses bb_cfp_pool_round1.game_id; later rounds will be assigned as games become known)
Return:
- total score
- breakdown counts (optional): wins/losses, remaining games

### How to map CFP later rounds to real games
V1 option (fastest):
- Add commissioner admin to link each later-round slot to a `bb_games` row once participants are known in real life.
- Store in table `bb_cfp_pool_slot_games(pool_id, slot_key, game_id)`
  - Round1 comes from `bb_cfp_pool_round1`
  - QF/SF/F come from `bb_cfp_pool_slot_games` as commissioner sets them (light manual)
V1.5 option (better):
- Auto-link by matching real participants once bracket advances (requires reliable data feed and team mapping).

## 5) Automated score sync (pseudo-live)
### Requirements
- Refresh every N minutes during active windows
- Update `bb_games` for any game referenced by `bb_pool_games` or CFP slot mapping tables
- When a game becomes final, standings should reflect immediately

### Implementation options
- Supabase Edge Function scheduled via cron (or Cloudflare cron hitting your endpoint)
- A small serverless worker that runs:
  1) fetch scores for relevant `external_game_id`s
  2) update `bb_games` rows
  3) record a sync run row (optional) for debugging

### Cost-control
- Use pool setting `score_refresh_minutes`
- During inactive hours, increase interval (optional)

## 6) Odds/spreads (display-only)
- If your chosen provider supplies vegas lines, store them on `bb_games`:
  - `spread`, `moneyline_home`, `moneyline_away` etc (nullable)
- Do NOT use them in scoring

## 7) Commissioner overrides + audit
When commissioner edits:
- picks after lock
- mapping CFP slot → game
- game score correction
Write an `audit_log` row with before/after JSON and reason.

## 8) “Golden demo” checklist
- create pool in org
- generate join link
- approve 2–5 users
- show bowl picks UI with lock countdown
- show CFP bracket UI locked at cfp_lock_at
- simulate score updates (manually mark a game final) and show standings change
- show audit log showing the override event
