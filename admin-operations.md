# Admin Operations - Implementation Plan

## Status: IMPLEMENTED (Ready for Testing)

Super admin capabilities for managing organizations and users at the platform level.

---

## 1. Org Deletion (Super Admin Only)

### Behavior
- Hard cascade delete - removes org and ALL related data
- Users are NOT deleted, just their org/pool memberships
- If org was user's only org, they become "org-less" and can create a new org or get invited elsewhere

### Cascade Delete Order (deepest children first)

For each pool in the org:
1. `sq_score_changes` (via sq_games)
2. `sq_winners` (via sq_games)
3. `sq_squares` (via sq_pools)
4. `sq_games` (via sq_pools)
5. `sq_pools`
6. `bb_cfp_entry_picks` (via bb_entries)
7. `bb_bowl_picks` (via bb_entries)
8. `bb_entries`
9. `bb_cfp_pool_byes`
10. `bb_cfp_pool_slot_games`
11. `bb_cfp_pool_round1`
12. `bb_cfp_pool_config`
13. `bb_pool_games`
14. `pool_memberships`
15. `join_links`
16. `audit_log` (where pool_id = target)
17. `pools`

Then for the org:
18. `org_memberships`
19. `audit_log` (where org_id = target)
20. `organizations`

### UI
- Delete button on org page (super admin only)
- Confirmation modal with org name + warning about permanent deletion

---

## 2. User Deactivation (Super Admin Only)

### Approach: App-Level Deactivation
- Don't touch `auth.users` - handle in app layer
- Add `profiles.deactivated_at` timestamp column
- When deactivated: user can authenticate but app blocks access
- Clear messaging: "Your account has been deactivated. Contact support to restore access."

### Why This Approach?
- **Preserves history**: Standings show real names (not "Deleted User")
- **Reversible**: Super admin can reactivate by clearing `deactivated_at`
- **Same UUID**: All historical data stays connected
- **Clear UX**: User knows exactly what happened and how to fix it

### Global Deactivation Check (Two Layers)

**Layer 1: Middleware (catches everything)**
- Runs on EVERY request
- After `auth.getUser()` succeeds, query `profiles.deactivated_at`
- If deactivated → redirect to `/account-deactivated`

**Layer 2: Dashboard Layout (backup)**
- Add `deactivated_at` to existing profile select
- Redirect if set (defense in depth)

### Restoration Flow
1. User tries to log in → sees "account deactivated" message with contact info
2. User emails admin requesting restoration
3. Super admin goes to user management page
4. Clicks "Reactivate" → clears `deactivated_at`
5. User can log in immediately with same credentials, all data intact

---

## 3. Database Changes

### Migration: Add deactivated_at to profiles

```sql
ALTER TABLE profiles
ADD COLUMN deactivated_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN profiles.deactivated_at IS
  'When set, user cannot access the app. NULL = active.';
```

---

## 4. Implementation Checklist

### Database
- [x] Add `profiles.deactivated_at` column (migration)
- [x] Regenerate TypeScript types

### Middleware
- [x] Add deactivation check to middleware
- [x] Add deactivation check to dashboard layout (backup)

### Pages & Components
- [x] Create `/account-deactivated` page
- [x] Create super admin user management page (`/admin/users`)
- [x] Create `DeleteOrgButton` component
- [x] Add delete org button to org page (super admin only)
- [x] Create `UserActions` component (deactivate/reactivate)

### Logic
- [x] Delete org cascade logic (in DeleteOrgButton component)
- [x] Deactivate/reactivate logic (in UserActions component)

### Testing
- [ ] Test org deletion cascade
- [ ] Test user deactivation blocks access
- [ ] Test user reactivation restores access
- [ ] Test deactivated user sees correct message

---

## 5. Files Created

| File | Purpose |
|------|---------|
| `frontend/src/app/account-deactivated/page.tsx` | Deactivated user landing page |
| `frontend/src/components/orgs/delete-org-button.tsx` | Delete org UI + cascade logic |
| `frontend/src/components/admin/user-actions.tsx` | Deactivate/reactivate buttons |
| `frontend/src/app/(dashboard)/admin/users/page.tsx` | Super admin user management |

## 6. Files Modified

| File | Changes |
|------|---------|
| `frontend/src/lib/supabase/middleware.ts` | Added deactivation check |
| `frontend/src/app/(dashboard)/layout.tsx` | Added deactivated_at to profile select + redirect |
| `frontend/src/app/(dashboard)/orgs/[id]/page.tsx` | Added DeleteOrgButton for super admin |
| `frontend/src/types/database.ts` | Regenerated with deactivated_at column |

---

## 7. Permissions Summary

| Action | Super Admin | Org Admin | Pool Commissioner | Member |
|--------|:-----------:|:---------:|:-----------------:|:------:|
| Delete org | ✓ | - | - | - |
| Deactivate user | ✓ | - | - | - |
| Reactivate user | ✓ | - | - | - |
| View all users | ✓ | - | - | - |

---

## 8. Testing Instructions

1. **Start dev server**: `cd frontend && npm run dev`
2. **User Management**: Navigate to `/admin/users` as super admin
3. **Org Deletion**: Go to any org page as super admin, click "Delete Organization"
4. **Deactivation Test**: Deactivate a test user, verify redirect to `/account-deactivated`
5. **Reactivation Test**: Reactivate the user, verify they can access the app again
