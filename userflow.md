# User Management & Permissions System - Final Design

## Finalized Role Structure

Based on user decisions, here is the confirmed design:

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ SUPER ADMIN (profiles.is_super_admin = true)                   │
│ • All rights across all orgs, bypasses RLS                     │
│ • Can create organizations                                      │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ ORG ADMIN (org_memberships.role = 'admin')                     │
│ • Full org control: settings, members, billing (future)        │
│ • Can create/delete pools                                       │
│ • Can appoint other admins                                      │
│ • Auto-commissioner on ALL pools in org (implicit)             │
│ • Can appoint pool commissioners                                │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ POOL COMMISSIONER (pool_memberships.role = 'commissioner')     │
│ • Pool-specific management (multiple commissioners allowed)    │
│ • Manage pool members (approve/reject/remove)                  │
│ • Pool settings (visibility, activation, completion)           │
│ • Enter scores, manage games                                    │
│ • ❌ CANNOT delete pool                                         │
│ • ❌ CANNOT appoint other commissioners (only org admin can)   │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ MEMBER (org_memberships.role = 'member')                       │
│         (pool_memberships.role = 'member')                     │
│ • Invited via pool join links                                   │
│ • Auto-added to org membership                                  │
│ • Make picks, view standings                                    │
│ • ❌ Cannot create pools, add users, etc.                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schema Changes Required

### 1. Add tier field to organizations (future-proofing)

```sql
ALTER TABLE organizations
ADD COLUMN tier text NOT NULL DEFAULT 'free'
CHECK (tier IN ('free', 'basic', 'pro'));

-- Not enforced yet, but ready for monetization later
```

### 2. Rename org_memberships.role values

```sql
-- Change 'commissioner' → 'admin'
UPDATE org_memberships SET role = 'admin' WHERE role = 'commissioner';

-- Update CHECK constraint
ALTER TABLE org_memberships DROP CONSTRAINT org_memberships_role_check;
ALTER TABLE org_memberships ADD CONSTRAINT org_memberships_role_check
  CHECK (role IN ('admin', 'member'));
```

### 3. Add role column to pool_memberships

```sql
ALTER TABLE pool_memberships
ADD COLUMN role text NOT NULL DEFAULT 'member'
CHECK (role IN ('commissioner', 'member'));
```

### 4. Migrate existing pool creators to commissioners

```sql
-- Set pool creator as commissioner for their pools (if they have a membership)
UPDATE pool_memberships pm
SET role = 'commissioner'
FROM pools p
WHERE pm.pool_id = p.id
  AND pm.user_id = p.created_by;

-- Create commissioner memberships for pool creators who don't have one yet
INSERT INTO pool_memberships (pool_id, user_id, role, status)
SELECT p.id, p.created_by, 'commissioner', 'approved'
FROM pools p
WHERE NOT EXISTS (
  SELECT 1 FROM pool_memberships pm
  WHERE pm.pool_id = p.id AND pm.user_id = p.created_by
);
```

### 5. Trigger: Auto-create commissioner membership on pool creation

```sql
-- When a pool is created, auto-create commissioner membership for creator
CREATE OR REPLACE FUNCTION create_pool_commissioner_membership()
RETURNS trigger AS $$
BEGIN
  INSERT INTO pool_memberships (pool_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'commissioner', 'approved');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pool_commissioner_trigger
AFTER INSERT ON pools
FOR EACH ROW
EXECUTE FUNCTION create_pool_commissioner_membership();
```

---

## Permissions Matrix

| Action | Super Admin | Org Admin | Pool Commissioner | Pool Member |
|--------|:-----------:|:---------:|:-----------------:|:-----------:|
| Create org | ✓ | ✓ (self-service) | - | - |
| Delete org | ✓ | ✓ (own) | - | - |
| Org settings | ✓ | ✓ | - | - |
| View org members | ✓ | ✓ | - | - |
| Add/remove org members | ✓ | ✓ | - | - |
| Promote to admin | ✓ | ✓ | - | - |
| Create pool | ✓ | ✓ | - | - |
| **Delete pool** | ✓ | ✓ | ❌ | - |
| Pool settings | ✓ | ✓ | ✓ | - |
| Manage pool members | ✓ | ✓ | ✓ | - |
| Appoint pool commissioner | ✓ | ✓ | ❌ | - |
| Add/manage games | ✓ | ✓ | ✓ | - |
| Enter scores | ✓ | ✓ | ✓ | - |
| Generate join links | ✓ | ✓ | ✓ | - |
| Make picks | ✓ | ✓ | ✓ | ✓ |
| View standings | ✓ | ✓ | ✓ | ✓ |

---

## Self-Service Org Creation Flow

### New User Journey (Not Invited) - Full Onboarding Wizard

```
Step 1: Sign Up
├── Email/password form
├── Creates account + profile
└── Redirects to onboarding wizard (if no orgs)

Step 2: Create Organization (Wizard Step 1)
├── "Let's set up your organization"
├── Organization name input
├── Submit → creates org + admin membership
└── Auto-advances to Step 3

Step 3: Create First Pool (Wizard Step 2)
├── "Now let's create your first pool"
├── Pool name + type selection
├── Submit → creates pool + commissioner membership
└── Auto-advances to Step 4

Step 4: Add Games (Wizard Step 3)
├── "Add some games to your pool"
├── Quick game entry interface
├── Can skip → "Add games later"
└── Advances to Step 5

Step 5: Invite Friends (Wizard Step 4)
├── "Invite people to join!"
├── Auto-generates invite link
├── Copy/share interface
├── "Done" → Exits wizard to pool page
```

**Wizard Implementation Notes:**
- Store wizard state in URL or localStorage
- Allow skipping steps (can complete later)
- Show progress indicator (Step 2 of 4, etc.)
- Redirect returning users who abandon wizard

### Invited User Journey (Current - Unchanged)

1. User receives join link
2. User signs up/logs in
3. Pool membership created (pending)
4. Org membership auto-created (member role)
5. Commissioner approves → user can participate

---

## RLS Policy Updates

### New Helper Functions

```sql
-- Check if user is org admin
CREATE OR REPLACE FUNCTION is_org_admin(org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_id = $1
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user is pool commissioner (direct or via org admin)
CREATE OR REPLACE FUNCTION is_pool_commissioner(pool_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    -- Direct pool commissioner
    SELECT 1 FROM pool_memberships
    WHERE pool_id = $1
      AND user_id = auth.uid()
      AND role = 'commissioner'
      AND status = 'approved'
  ) OR EXISTS (
    -- Org admin (implicit commissioner)
    SELECT 1 FROM pools p
    JOIN org_memberships om ON om.org_id = p.org_id
    WHERE p.id = $1
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### Policies to Update

All policies currently using `is_org_commissioner()` need to be updated:
- `is_org_commissioner(org_id)` → `is_org_admin(org_id)`
- `is_pool_commissioner(pool_id)` → Updated function above

### New Policy: Pool Delete (Admin Only)

```sql
-- Only org admins can delete pools
CREATE POLICY "Org admins can delete pools"
ON pools FOR DELETE
USING (
  is_super_admin() OR is_org_admin(org_id)
);
```

---

## Frontend Updates Required

### Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/app/(dashboard)/pools/[id]/page.tsx` | Check pool commissioner role, hide delete for non-admins |
| `frontend/src/app/(dashboard)/orgs/[id]/members/page.tsx` | Update role options (admin/member) |
| `frontend/src/components/orgs/org-member-actions.tsx` | Rename "commissioner" → "admin" |
| `frontend/src/components/pools/pool-settings.tsx` | Add commissioner role management |
| `frontend/src/components/members/member-actions.tsx` | Add "Promote to Commissioner" option |
| `frontend/src/app/(dashboard)/dashboard/page.tsx` | Add "Create Organization" for users with no orgs |

### New Components Needed

1. **CreateOrgButton** - Self-service org creation (for dashboard)
2. **PromoteToCommissionerButton** - Org admin promoting pool member

### Permission Check Pattern Update

```typescript
// Old pattern
const isCommissioner = orgMembership?.role === 'commissioner' || isSuperAdmin

// New pattern
const isOrgAdmin = orgMembership?.role === 'admin' || isSuperAdmin
const isPoolCommissioner = poolMembership?.role === 'commissioner' || isOrgAdmin
```

---

## Migration Checklist

### Phase 1: Database Schema
- [ ] Create migration: add `tier` column to organizations (default 'free')
- [ ] Create migration: rename org role 'commissioner' → 'admin'
- [ ] Create migration: add `role` column to pool_memberships
- [ ] Create migration: set pool creators as commissioners
- [ ] Create migration: add pool creation trigger (auto-commissioner)
- [ ] Create migration: update RLS helper functions
- [ ] Create migration: update RLS policies
- [ ] Regenerate TypeScript types

### Phase 2: Frontend - Org Level
- [ ] Update org member actions (admin terminology)
- [ ] Add self-service org creation to dashboard
- [ ] Update org creation to set creator as admin
- [ ] Update org member list to show admin/member roles

### Phase 3: Frontend - Pool Level
- [ ] Update pool permission checks (isOrgAdmin + isPoolCommissioner)
- [ ] Add commissioner promotion UI for org admins
- [ ] Hide delete pool from pool commissioners (only admins)
- [ ] Update member management to show commissioner role

### Phase 4: Onboarding Wizard
- [ ] Create `/onboarding` route with step-based UI
- [ ] Step 1: Create organization
- [ ] Step 2: Create first pool
- [ ] Step 3: Add games (skippable)
- [ ] Step 4: Invite friends
- [ ] Redirect logic: new users with no orgs → wizard
- [ ] Store wizard state (URL params or localStorage)

### Phase 5: Testing & Docs
- [ ] Test all permission scenarios
- [ ] Test onboarding flow end-to-end
- [ ] Update CLAUDE.md with new role structure
- [ ] Document the permission model for users

---

## Confirmed Design Decisions

1. **Multiple commissioners per pool**: YES - Multiple people can be commissioner for a single pool
2. **Explicit pool membership for admins**: YES - When admin creates pool, they get `pool_memberships` record with `role='commissioner'`
3. **Org admins have implicit rights**: Still true, but explicit record makes data model cleaner and enables admin to be "removed" from a pool if desired

---

## Open Questions for Future

1. **Billing/pricing** - Will org admins manage billing? (Future feature)
2. **Org deletion** - What happens to pools when org is deleted?
3. **Role audit log** - Track role changes for accountability?
