# NFL Desperation — Technical Spec

Companion to `NFL_Desperation.md` (Derek Curlee's official rules, v1.0).
Status: **Week 1 build complete, verified end-to-end on 2026-09-06.** Commissioner UI shipped; season-end features deferred.

## Context

Pool has run 6–7 years on OfficeFootballPools / Splash Sports as a custom pool type.
Splash dropped support for the custom script. Migrating to BN Pools.

Commissioner: Derek Curlee. Org: **Curlee Org** (`fabdc7b1-acee-42ad-b11c-71b603abffef`).

Pool type slug: `nfl_desperation`. Display name: "NFL Desperation".
- Test pool: **Desperation Test**
- Live pool: **NFL Desperation 2026**

## Deadlines

Driven by the real ESPN schedule, not assumptions.

| Event | When (CT) |
|---|---|
| Week 1 first kickoff (NE @ SEA) — soft deadline | Wed Sep 9, 7:20 PM |
| Melbourne neutral-site game (SF vs LAR) | Thu Sep 10, 7:35 PM |
| Week 1 noon lock — **hard deadline** | Sun Sep 13, 12:00 PM |
| Week 1 finalizes (MNF DEN @ KC ends) | Mon Sep 14, ~10:30 PM |

Week 1 has 16 games, so a perfect week is 136 points.

## Confirmed decisions

| Decision | Choice |
|---|---|
| Access model | One private token link per entry. No password, no account. |
| Roster | Derek's email list **plus** a public join link anyone can use (one entry per email). Names optional. |
| Entries | One per person, keyed on email. |
| Money | **Not in the app.** No entry fees, prize pools, or payment tracking. |
| Pick-count visibility | Hidden from other players until the Sunday noon lock. |
| Per-game pick visibility | Revealed at that game's kickoff (per Rule 5). |
| Live Sunday board | In scope for Week 1. Reuses squares ESPN polling. |
| Operator | Brandon runs Week 1. Commissioner screens built, but last in order. |
| Pick reminders | Built, **default off**. |
| Commissioner recap email | Required — Derek writes funny weekly recaps and blasts them. |

Deferred to December (Weeks 17–18): Flash Prizes (Rule 17), Grand Prize
(Rule 12), Week 18 playoff (Rules 14–16), midseason joining (Rule 18).

## Visibility model — the critical part

The entire pool rests on nobody seeing picks early. Two independent gates:

1. **Individual pick on game G** is visible to other players iff `now >= G.kickoff_at`.
2. **An entry's total pick count for the week** is visible to other players iff
   `now >= week.lock_at` (Sunday 12:00 PM CT).

An entry always sees its own picks and its own count.

### Enforcement

The anon Postgres role gets **no direct SELECT on `nd_picks`**. Every read of another
player's picks goes through server-side code that applies the gates explicitly. This
makes a PostgREST-shaped leak structurally impossible rather than policy-dependent.

This is a deliberate departure from the golf/squares pattern, where public pages read
tables directly with the anon key.

## Lock model

A pick on game G is editable iff `now < LEAST(G.kickoff_at, week.lock_at)`.

`week.lock_at` = Sunday 12:00 PM America/Chicago for that NFL week. In practice this is
the same instant the early Sunday window kicks off, so one lock event covers the early
games, the 3:25s, SNF, and MNF. Only pre-Sunday games (Wed/Thu/Sat, and Sunday-morning
international games) lock individually.

## Scoring

Weekly points: `n * (n + 1) / 2` where `n` = count of the entry's picks on **qualifying**
games — but only if every one of those picks is correct. Otherwise **0**.

A game qualifies iff `status = 'final'` AND `winner <> 'tie'`. Non-qualifying:
- **Tie** (Rule 7) — removed entirely, shrinks `n`, counts as neither right nor wrong.
- **Canceled** (Rule 9) — removed entirely.
- **Postponed into a later week** (Rule 8) — removed from this week; reappears in the
  new week as a fresh game with no picks carried over.
- **Postponed within the same week** (Rule 8) — stays, pick stays attached.
- **Suspended** (Rule 9) — stays active until completed or canceled.

Because ties and cancellations shrink `n` retroactively, weekly scores stay **provisional**
until every game in the week reaches a terminal state. Surface them as provisional in the UI.

Season score = sum of weekly scores. No tiebreakers anywhere (Rules 13, 16, 17).

## Data model

```
nd_pools          1:1 with pools. season_year, public_slug, current_week,
                  allow_midseason_join, reminders_enabled (default false)

nd_weeks          one per NFL week. week_number, lock_at, first_kickoff_at,
                  last_kickoff_at, status, finalized_at,
                  flash_prize_* (deferred, columns reserved)

nd_games          espn_game_id, week_number, home/away team + abbrev + logo,
                  kickoff_at, venue, neutral_site, home_score, away_score,
                  status, winner ('home'|'away'|'tie'|null), qualifies,
                  spread/over_under/odds_details/odds_provider (ESPN DraftKings line;
                  display only, refreshed on every sync, never used in scoring)

nd_entries        email (unique per pool), display_name, access_token (unguessable),
                  joined_week, active

nd_picks          entry_id, game_id, selection ('home'|'away')
                  unique(entry_id, game_id). Absence of row = no pick.

nd_week_scores    entry_id, week_number, qualifying_picks, correct_picks,
                  is_perfect, points, finalized
```

## Data source

ESPN scoreboard, already used by squares
(`frontend/src/app/api/squares/sync-score/route.ts`).

Regular season: `.../football/nfl/scoreboard?seasontype=2&week=N&dates=2026`

Verified working — returns all 16 Week 1 games with kickoff times, venues, neutral-site
flags, and live status.

## Email

Resend is already installed, keyed (`RESEND_API_KEY`), and sending from
`BN Pools <noreply@pools.brandon-nance.com>`. No infra work needed.

1. **Invite blast** — each entry gets its private link. One send to the roster.
2. **Join / resend my link** — public page, enter email (+ optional name). New email → entry created and
   link emailed; known email → link re-sent. Same confirmation either way. Never displayed on screen.
3. **Pick reminder** — before lock, to entries with zero picks. Default off.
4. **Commissioner recap** — free-text composer, sends to all active entries.

## Build order

1. Schema + regenerate types
2. ESPN schedule import (all 18 weeks, 2026)
3. Entry import from email list, token generation, invite email
4. Picks page — mobile-first, autosave, live "if perfect" points preview  ← **Wed Sep 9**
5. Lock enforcement (per-game + noon)
6. Reveal + live Sunday board  ← **Sun Sep 13**
7. Weekly scoring + season standings  ← **Mon Sep 14**
8. Commissioner screens + recap composer
9. December: Flash Prizes, Grand Prize, Week 18 playoff

### Week rollover (added 2026-09-06)
- "Current week" = first week whose last kickoff was < 5h ago (`pickCurrentWeek`). Board defaults to it.
- The **next** week opens for picks the moment the current week hits its Sunday-noon lock
  (`nextOpenWeek` / `maxPickableWeek` in schedule.ts). Server enforces it in the pick route (403);
  the UI shows a "Week N is locked → Week N+1 is open" banner on the Picks tab and lets the week
  nav step forward one week. Weeks beyond that are not pickable. Past weeks are read-only.
- Betting line (DraftKings via ESPN) shown on each game card for reference only.

### Self-join link (added 2026-09-06)
- `/desperation/<slug>` is the one link Derek shares. `POST /api/desperation/join` (public):
  known+active email → re-send link; known+disabled → no-op; new email → create entry + invite
  email; new email while closed → 403 with a reason. Link is emailed only, so registering someone
  else's address gains nothing. Per-IP throttle (20/hr/pool, best-effort) and a 500-entry cap.
- Open iff `pools.status='open'` AND `nd_pools.self_join_enabled` (new column, default true) AND
  schedule loaded AND (`joinWeekFor() == 1` OR `allow_midseason_join`).
- `joinWeekFor()` (schedule.ts): Week 1 is joinable right up to its noon lock; after that, Rule 18 —
  a week that has kicked off is closed, joiners start with the next one. Used for `joined_week` on
  every entry-creating path (self-join, commissioner import, "Add me").
- Dashboard "Join link" card has two toggles → `POST /api/desperation/settings`:
  "Anyone with the link can join" and "Keep joining open after Week 1".

### Disable / remove players (added 2026-09-06)
- Entries card: status per player — Opened / Never opened (invite sent, link never loaded) /
  Not invited / Disabled — with filter chips and "Remove all N shown" on the Never-opened view.
- Row menu: Disable / Re-enable (`PATCH /api/desperation/entries`) and Remove (`DELETE`, cascades
  picks + week scores). Disabled: private link shows "This entry is disabled", API returns 401,
  hidden from board/standings, can't re-join via the public link (commissioner must re-enable).

### Commissioner as a player
- Dashboard "My Entry" card (commissioner only): matches the signed-in email against the roster.
  "Add me as a player" → `POST /api/desperation/entries {self:true}` creates the entry with the
  account's display name and no invite email; then the card shows Open my picks / Copy link.
  The commissioner makes picks on the normal player page like everyone else. While signed in to the
  dashboard, the player page header shows "Back to pool admin" (server checks the session against
  `getPoolPermissions`; token-only players never see it).
- Player page is mobile-first (max-w-2xl) and widens to max-w-4xl on md+: game cards and board
  entries go two-column, standings gain a desktop-only "Week N" points column.

## What's built (as of 2026-09-06)

| Layer | Files |
|---|---|
| Schema | migrations `nfl_desperation_schema`, `pools_type_add_nfl_desperation` (6 `nd_*` tables, RLS, `is_nd_season_commissioner()`) |
| Pure logic + tests | `frontend/src/lib/desperation/{scoring,visibility,schedule,espn}.ts`, 42 vitest cases |
| Server | `frontend/src/lib/desperation/server.ts` (token lookup, ESPN sync, score recompute, `buildBoard()` — the only reader of other entries' picks), `emails.ts`, `lib/supabase/admin.ts` |
| API | `/api/desperation/{sync-schedule,sync-scores,entries (GET/POST/PATCH/DELETE),pick,profile,join,settings,board}` |
| Player pages | `/desperation/[slug]` (join + lost-link form), `/desperation/[slug]/e/[token]` (Picks / Board / Standings) |
| Commissioner | `components/desperation/{desperation-content,nd-schedule-card,nd-entries-card,nd-my-entry-card,nd-join-settings}.tsx` on the pool page |
| Pool creation | `nfl_desperation` in Create Pool dialog, `site_settings.enabled_pool_types`, `pools_type_check` |
| CLI fallback | `frontend/scripts/nd-sync-schedule.ts` |

Verified: token page 200 / bad token 404; pick save/flip/clear; lock + visibility gates (unit);
cross-entry hiding (two entries, both directions); anon-key REST returns 0 rows and rejects
INSERT on `nd_picks`/`nd_entries`/`nd_week_scores`; resend-link responds identically for
known and unknown emails; Resend delivery to brandon@turbovets.com.

## Test fixtures (live DB)

- Pool **Desperation Test** — `pools.id 2849047f-c25d-4031-bd75-afd6af120ae9`,
  `nd_pools.id 8f4abff2-e43b-48a5-a249-314f72bdfa1f`, slug `desperation-test`
- Entries: brandon@turbovets.com ("Brandon"), rival@example.com ("Rival", 3 picks)
- All 18 weeks of the 2026 schedule loaded (272 games)

## Operating guide (Week 1)

1. Create **NFL Desperation 2026** via Create Pool → NFL Desperation (slug required).
2. Pool page → Schedule card → **Load schedule from ESPN**.
3. Share the **Join link** (players self-register, one per email), and/or Entries card → paste
   Derek's email list → **Add players** (sends invites).
4. Players open their emailed link; picks autosave; sticky footer shows points-if-perfect.
5. Game days: player boards poll every 30s; scores refresh from ESPN lazily (20s server throttle).
   Commissioner can force with **Refresh scores**.
6. Week finalizes automatically when every game reaches final/canceled; standings update.
7. Lost link → `/desperation/<slug>` → email → link re-sent. Or Entries card → copy/resend.
8. Typos / no-shows → Entries card → **Never opened** filter → remove. Kick someone → row menu → Disable.

## Not yet built

- Pick reminders (spec'd default-off; `nd_pools.reminders_enabled` exists, no sender yet)
- Commissioner recap email composer
- Commissioner overrides: void game, move postponed game to another week
- December: Flash Prizes, Grand Prize (after Week 17), Week 18 playoff reset, midseason joining toggle UI
- Commissioner view of the live board (currently commissioner sees schedule + standings, not picks —
  deliberate: Derek is also a player)
