# Member Removal Design Plan

## Design Decisions (Confirmed)

1. **Locked squares removal**: Abandoned squares (set user_id to NULL)
2. **Winner display**: Original owner name (historical accuracy)
3. **Commissioner reassignment**: Yes, always allowed even when locked

---

## Problem Summary

Currently, removing a user from an org or pool only deletes their membership record, **orphaning all related data** (entries, picks, squares, winners). This creates data integrity issues and unclear UX.

---

## Key Implementation Change: Preserve Winner Names

To show original owner names for historical winners, we need to **denormalize** by storing `winner_name` on `sq_winners` when winners are calculated. This ensures the name persists even if:
- User is removed from pool
- Square is reassigned
- User account is deactivated

**Migration needed:** Add `winner_name TEXT` column to `sq_winners`

---

## Final Design

### 1. Org-Level Member Removal

When removing a user from an org:
1. For each pool they're a member of, apply pool-type-specific removal logic
2. Then delete their `org_membership`

---

### 2. Pool-Level Removal: Bowl Buster

**Behavior: Full cascade delete**

```
1. Delete bb_cfp_entry_picks WHERE entry_id IN (user's entries)
2. Delete bb_bowl_picks WHERE entry_id IN (user's entries)
3. Delete bb_entries WHERE user_id = X AND pool_id = Y
4. Delete pool_membership
```

**Standings:** Auto-update (query-time calculation)

---

### 3. Pool-Level Removal: Squares (Unlocked)

**Behavior: Delete squares, they become available**

```
1. Delete sq_squares WHERE sq_pool_id = X AND user_id = Y
2. Delete pool_membership
```

**Grid:** Squares return to "available" state

---

### 4. Pool-Level Removal: Squares (Locked)

**Behavior: Abandon squares (set user_id = NULL)**

```
1. UPDATE sq_squares SET user_id = NULL WHERE sq_pool_id = X AND user_id = Y
2. Delete pool_membership
```

**Grid:** Squares show as "Abandoned" with distinct styling
**Winners:** Display `winner_name` from `sq_winners` (original owner preserved)
**Commissioner:** Can reassign abandoned squares to new members

---

### 5. Commissioner Reassignment in Locked Pools

**Allow commissioners to reassign squares at any time**, even after lock.

- Regular users: Cannot claim/unclaim after lock (no change)
- Commissioners: Can reassign any square regardless of lock state

**Winner Logic (No Retroactive Recalculation):**
- Pre-abandonment wins → Original owner name preserved forever
- During-abandonment wins → Recorded as "Abandoned" (winner_name = 'Abandoned')
- Post-reassignment wins → New owner gets credit going forward

---

## Implementation Tasks

### Phase 1: Database Migration
- [ ] Add `winner_name TEXT` column to `sq_winners`
- [ ] Backfill existing winners with owner names from sq_squares → profiles join

### Phase 2: Update Winner Calculation to Store Names
Files to modify:
- [ ] `frontend/src/components/squares/enter-squares-score-button.tsx` - Add winner_name to insert
- [ ] `frontend/src/components/squares/single-game-score-entry.tsx` - Add winner_name to insert

### Phase 3: Enable Locked Pool Reassignment
Files to modify:
- [ ] `frontend/src/components/squares/squares-grid.tsx` (line ~218)
  - Change: `const canAdminAssign = isCommissioner` (remove `&& !numbersLocked`)
- [ ] `frontend/src/components/squares/assign-square-button.tsx` - Verify works when locked

### Phase 4: Pool Member Removal Logic
File: `frontend/src/components/members/member-actions.tsx`
- [ ] Detect pool type from context
- [ ] Bowl Buster: Cascade delete entries → picks → membership
- [ ] Squares (unlocked): Delete squares → membership
- [ ] Squares (locked): UPDATE squares SET user_id = NULL → delete membership
- [ ] Update confirmation dialog to explain what will happen

### Phase 5: Abandoned Square UI
Files to modify:
- [ ] `frontend/src/components/squares/square-cell.tsx` - Add "Abandoned" styling (distinct from available)
- [ ] `frontend/src/components/squares/squares-grid.tsx` - Handle NULL user_id in display
- [ ] Winner display components - Use `winner_name` from sq_winners instead of join

### Phase 6: Org Member Removal
File: `frontend/src/components/orgs/org-member-actions.tsx`
- [ ] Fetch all pools user is member of
- [ ] For each pool, apply pool-type-specific removal logic
- [ ] Show summary dialog of affected pools before confirming

---

## Files Summary

| File | Changes |
|------|---------|
| `member-actions.tsx` | Add pool-type-specific cascade removal |
| `org-member-actions.tsx` | Add multi-pool cascade removal |
| `squares-grid.tsx` | Allow locked reassignment, handle abandoned |
| `assign-square-button.tsx` | Work when locked |
| `square-cell.tsx` | Add abandoned styling |
| `enter-squares-score-button.tsx` | Store winner_name |
| `single-game-score-entry.tsx` | Store winner_name |
| Winner display components | Read winner_name from sq_winners |

---

## Edge Cases to Handle

1. **Removing last/only member** - Should work, just leaves pool empty
2. **Removing commissioner** - Block if only commissioner (already handled)
3. **User in multiple pools in same org** - Each pool processed independently
4. **Abandoned square wins while abandoned** - winner_name = "Abandoned", displayed as such
5. **Reassigned square wins after reassignment** - New owner gets credit (normal flow)
6. **Multiple abandoned squares from same user** - All get abandoned styling, commissioner can reassign individually

---

## Current State Reference

### Foreign Key Relationships (No CASCADE rules - all app-level)

```
org_memberships → (no cascade to pools)
pool_memberships → (no cascade to entries/squares)
bb_entries → bb_bowl_picks, bb_cfp_entry_picks
sq_squares → sq_winners (via square_id FK)
```

### Current Removal Implementations

- `org-member-actions.tsx`: Deletes pool_memberships + org_membership (orphans entry data)
- `member-actions.tsx`: Only deletes pool_membership (orphans all entry/square data)
- `delete-pool-button.tsx`: Full cascade delete (correct reference implementation)
- `delete-org-button.tsx`: Full cascade delete (correct reference implementation)
