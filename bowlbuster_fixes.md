# Bowl Buster Fixes

## Bug: CFP Picks Not Included in Scoring

### Problem
The leaderboard shows incorrect scores because CFP (College Football Playoff) picks are being excluded from the scoring calculation.

**Example:** Brandon Nance should have ~217-227 points but shows 176 points (missing ~41-51 points from CFP picks).

### Root Cause
In `frontend/src/app/(dashboard)/pools/[id]/page.tsx` at line 308:

```javascript
if (!poolGame || poolGame.kind !== 'bowl') continue
```

This filter explicitly skips any picks where `kind !== 'bowl'`, which excludes all CFP games (`kind='cfp'`).

### Data Verification
SQL query confirmed the issue:
```sql
-- Bowl picks: 176 points (currently counted)
-- CFP picks: 51 points (currently EXCLUDED)
-- Total should be: 227 points
```

CFP picks being excluded:
- CFP First Round @ Oklahoma: +10 (Alabama correct)
- CFP First Round @ Texas A&M: -7 (Texas A&M wrong, Miami won)
- CFP First Round @ Ole Miss: +31 (Ole Miss correct)
- CFP First Round @ Oregon: +17 (Oregon correct)

### Fix
Remove or modify the kind filter on line 308. Options:

**Option A: Include both bowl and cfp**
```javascript
if (!poolGame || (poolGame.kind !== 'bowl' && poolGame.kind !== 'cfp')) continue
```

**Option B: Remove kind filter entirely (score all picks)**
```javascript
if (!poolGame) continue
```

**Option C: Use an allowlist**
```javascript
const scoredKinds = ['bowl', 'cfp']
if (!poolGame || !scoredKinds.includes(poolGame.kind)) continue
```

### Files to Modify
- `frontend/src/app/(dashboard)/pools/[id]/page.tsx` - Line 308

### Testing
1. After fix, verify Brandon Nance's score updates from 176 to ~227
2. Verify all users' scores include their CFP picks
3. Check that pending CFP games still show as "pending" correctly

---

## Issue: Orphaned bb_games Records on Pool Deletion

### Problem
When a Bowl Buster pool is deleted, the `bb_pool_games` junction records are deleted (via CASCADE), but the underlying `bb_games` records remain orphaned in the database.

### Current State
48 orphaned `bb_games` records exist that are not referenced by any `bb_pool_games`.

### Safe to Delete Manually?
**Yes** - these records are not referenced by any foreign keys. You can safely delete them with:

```sql
-- Delete orphaned bb_games (games not referenced by any pool)
DELETE FROM bb_games g
WHERE NOT EXISTS (
  SELECT 1 FROM bb_pool_games pg WHERE pg.game_id = g.id
);
```

### Long-term Fix Options

**Option A: Add CASCADE delete from pools to bb_games**
- Requires rethinking if games should be shared across pools or pool-specific
- If pool-specific, add `pool_id` to `bb_games` and CASCADE delete

**Option B: Add cleanup trigger/function**
- Create a trigger that deletes orphaned `bb_games` when `bb_pool_games` are deleted
- Or create a scheduled cleanup job

**Option C: Keep games as shared resources**
- Games could be reusable across multiple pools (e.g., multiple Bowl Buster pools for the same season)
- In this case, orphans are expected and periodic cleanup is acceptable

### Recommendation
Decide on the data model first:
1. Are `bb_games` meant to be shared across pools? (e.g., "2024 Rose Bowl" used by multiple pools)
2. Or are they pool-specific? (each pool creates its own copy of games)

Current behavior suggests pool-specific, so adding proper CASCADE or cleanup logic would be appropriate.
