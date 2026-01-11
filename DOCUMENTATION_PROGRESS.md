# Documentation Progress

## Overview
Adding comprehensive JSDoc-style documentation comments to all main files in the pool-manager codebase. The goal is to make the code self-documenting so anyone can easily understand what each file does, where functions are called from, and how components interact.

## Documentation Pattern Used
Each file gets:
- `@fileoverview` - Brief description of the file's purpose
- `@route` - The URL route (for pages/API routes)
- `@auth` - Authentication/permission requirements
- `@layout` - Parent layout (for pages)
- `@description` - Detailed explanation
- `@features` - Bullet list of main features
- `@components` - Child components used
- `@data_fetching` - Database queries made
- Function-level JSDoc for all functions
- Interface/type documentation with property descriptions

## Completed Files

### API Routes (Commit 1e0f6a6)
- [x] `frontend/src/app/api/madness/scores/route.ts` - Score entry with spread calculations
- [x] `frontend/src/app/api/madness/draw/route.ts` - Blind draw execution
- [x] `frontend/src/app/api/madness/demo/route.ts` - Demo data seeding/simulation

### Public Pages (Commit 1e0f6a6)
- [x] `frontend/src/app/view/mm/[slug]/page.tsx` - Public MM bracket/standings view
- [x] `frontend/src/app/madness/[slug]/page.tsx` - Public MM entry request

### Dashboard Pages (Commit 9210dd4)
- [x] `frontend/src/app/(dashboard)/dashboard/page.tsx` - Main dashboard
- [x] `frontend/src/app/(dashboard)/orgs/[id]/page.tsx` - Organization detail
- [x] `frontend/src/app/(dashboard)/orgs/[id]/members/page.tsx` - Org members management

### Pool Pages (Commit 9210dd4)
- [x] `frontend/src/app/(dashboard)/pools/[id]/page.tsx` - Pool detail (all types)
- [x] `frontend/src/app/(dashboard)/pools/[id]/members/page.tsx` - Pool members management
- [x] `frontend/src/app/(dashboard)/pools/[id]/games/page.tsx` - Bowl games management
- [x] `frontend/src/app/(dashboard)/pools/[id]/picks/page.tsx` - Bowl/CFP picks
- [x] `frontend/src/app/(dashboard)/pools/[id]/cfp/page.tsx` - CFP bracket setup

### Other Pages (Commit 9210dd4)
- [x] `frontend/src/app/onboarding/page.tsx` - Onboarding wizard

### Admin Pages (Session 3)
- [x] `frontend/src/app/(dashboard)/admin/users/page.tsx` - User management
- [x] `frontend/src/app/(dashboard)/admin/settings/page.tsx` - Site settings

### Auth Pages (Session 3)
- [x] `frontend/src/app/(auth)/login/page.tsx` - Login page
- [x] `frontend/src/app/(auth)/signup/page.tsx` - Signup page
- [x] `frontend/src/app/(auth)/forgot-password/page.tsx` - Forgot password
- [x] `frontend/src/app/(auth)/reset-password/page.tsx` - Reset password

### Public Pages (Session 3)
- [x] `frontend/src/app/join/[token]/page.tsx` - Join pool via invite token
- [x] `frontend/src/app/join/[token]/join-action.tsx` - Join action component
- [x] `frontend/src/app/view/[slug]/page.tsx` - Public squares view
- [x] `frontend/src/app/account-deactivated/page.tsx` - Deactivated account notice

### March Madness Dashboard Pages (Session 3)
- [x] `frontend/src/app/(dashboard)/pools/[id]/march-madness/page.tsx` - MM main view
- [x] `frontend/src/app/(dashboard)/pools/[id]/march-madness/setup/page.tsx` - Team setup
- [x] `frontend/src/app/(dashboard)/pools/[id]/march-madness/entries/page.tsx` - Entry management
- [x] `frontend/src/app/(dashboard)/pools/[id]/march-madness/games/page.tsx` - MM score entry
- [x] `frontend/src/app/(dashboard)/pools/[id]/march-madness/bracket/page.tsx` - Full bracket view

### Settings Page (Session 3)
- [x] `frontend/src/app/(dashboard)/settings/page.tsx` - Account settings

### Lib Files (Session 3)
- [x] `frontend/src/lib/supabase/server.ts` - Server-side Supabase client
- [x] `frontend/src/lib/supabase/client.ts` - Browser-side Supabase client

## TODO - Remaining Files

### Other API Routes
- [ ] `frontend/src/app/api/squares/**` - Squares API routes
- [ ] Other API routes as needed

### Components (selective - skip shadcn/ui)
- [ ] Key components in `frontend/src/components/` (not ui/)

## Git Commits Made
1. `1e0f6a6` - Add documentation comments to March Madness API routes and pages (5 files)
2. `9210dd4` - Add documentation comments to dashboard and pool pages (9 files)
3. (pending) - Add documentation comments to admin, auth, public, MM dashboard, settings, and lib files (19 files)

## Notes
- Skip `frontend/src/components/ui/` - these are shadcn/ui components (third-party)
- Focus on app pages, API routes, lib files, and custom components
- Documentation should NOT break any code - only adding comments
- All changes are pushed to `main` branch
