# Tech Questions for Work App (Coast Guard Recruiting)

Extract patterns from the mature NxJS/Angular/GraphQL codebase to apply to BN Pools.

**How to use**: Ask these one at a time in a Claude instance with your work app codebase loaded. Follow up each answer with: "Now show me how I'd adapt this pattern for a Next.js 16 App Router + Supabase + TypeScript stack."

**Priority**: Questions 1-6 and 8-9 map to Phases 0 and 4 (highest impact). Questions 17-18 are key for Phase 3 (golf stepper). Questions 21-23 can wait until after March Madness.

---

## Tech Stack Overview

This is an **Nx monorepo** with 3 product lines (Vets, Recruit, Active Duty) sharing common libraries.

| Layer | Technology | Details |
|---|---|---|
| **Monorepo** | Nx | Module boundary enforcement via ESLint, affected-based CI, project graph |
| **Backend** | NestJS (Node.js) | GraphQL API (code-first with `@nestjs/graphql` + Apollo Server), REST for some endpoints |
| **Frontend** | Angular 18+ | Standalone components, Angular Signals, SSR support |
| **API Protocol** | GraphQL | Queries, mutations, and **subscriptions** (real-time via WebSocket) |
| **Database** | PostgreSQL 14 | With `pgvector` extension for embeddings/semantic search |
| **ORM** | TypeORM | Code-first entities, migration generation, custom `CoreRepository<T>` base class |
| **Real-time** | GraphQL Subscriptions | Over `graphql-ws` WebSocket, backed by **Redis Pub/Sub** (`graphql-redis-subscriptions`) |
| **Caching** | Redis 7 | TLS-enabled, used for caching and pub/sub |
| **Forms** | @ngx-formly | 50+ custom field types, wrappers, validators — all forms are config-driven |
| **State Management** | Angular Signals | Private `signal()` + public `asReadonly()` + `computed()` derivatives. No NgRx. |
| **Frontend Data** | Apollo Angular | `watchQuery`, `mutate`, `subscribe` via Consumer Service pattern |
| **Auth** | JWT (cookies) | `access_token`, `action_token`, `isa_access_token` cookies; Login.gov and Microsoft OAuth |
| **Queue/Jobs** | BullMQ | Redis-backed job queues for async processing |
| **Notifications** | AWS SQS → SES + Firebase FCM | SQS consumer app processes notification messages, sends email (SES) and push (Firebase) |
| **Cloud (local)** | LocalStack | Emulates AWS IAM, Lambda, S3, SES, SNS, SQS locally |
| **File Storage** | AWS S3 | Document uploads, DD-214s, profile pictures |
| **Voice/Calls** | Retell AI + Twilio | AI-powered recruiting calls (recruit product line only) |
| **Container** | Docker + Docker Compose | Multi-service stack with nginx SSL termination, per-product profiles |
| **CI/CD** | GitHub Actions | Affected-based testing, container builds, ECS deployment, Cypress E2E |
| **Testing** | Jest + Cypress | Unit/integration tests (Jest), E2E tests (Cypress), container-structure-tests |
| **Design System** | Tether Design System (TDS 2.0) | Custom component library with Tailwind CSS |
| **Icons** | Lucide (via ng-icon) | `lucideLoaderCircle`, etc. |
| **Toasts** | ngx-toastr | Custom `ToastWrapperComponent` mapping to design system variants |

**Key structural convention**: Each product line has its own backend app (`backend-vets`, `backend-recruit`, `backend-active-duty`) and frontend app (`ui-vets`, `ui-recruit`, `ui-active-duty`), plus shared libraries under `libs/` scoped as `@turbovets/*` (backend) and `@turboui/*` (frontend).

---

## Permissions & Authorization (Phase 0)

### 1. Permission System Structure
Show me how the permission/authorization system is structured in this app. What are the role hierarchies, where are permission checks centralized, and how do components/pages consume permission state? Include the key files and any helper functions or guards.

**Answer:**

The permission system has **three distinct layers** that work together:

#### Layer 1: User Context (what "mode" the user is in)

```typescript
// libs/auth/src/lib/identity/user/user-context.entity.ts
export enum UserContextType {
  Client = 'Client',   // End-user (veteran, recruit, service member)
  Agent = 'Agent',     // VSO rep, recruiter, etc.
  Admin = 'Admin',     // ISA (internal super-admin tool)
  Public = 'Public',
  Govx = 'Govx',
}
```

Users can hold multiple contexts and switch between them (e.g., someone who is both a veteran and a VSO rep).

#### Layer 2: Organization Roles (what the user can do within their org)

```typescript
// libs/auth/src/lib/organization/organization-role.entity.ts
export enum VisibilityScope {
  UNIVERSAL = 'UNIVERSAL',              // See all data in org/all groups
  GROUP_MEMBERSHIP = 'GROUP_MEMBERSHIP', // See data in groups user belongs to
  ASSIGNMENT = 'ASSIGNMENT',            // See only data explicitly assigned to user
}

export enum AdminLevel {
  NONE = 'NONE',
  GROUP = 'GROUP',
  ORGANIZATION = 'ORGANIZATION',
  ALL = 'ALL',
}

export class OrganizationRole {
  name: string;                    // e.g. "Office Recruiter In Charge"
  type: RoleType;                  // ORG or GROUP
  visibilityScope: VisibilityScope;
  adminLevel: AdminLevel;
  dataPermissions: Ability[];      // Which CRUD operations are allowed
  groupTypes?: GroupType[];
  isDefault: boolean;
}
```

#### Layer 3: ISA Permissions (internal admin tool access)

```typescript
// libs/auth/src/lib/authorization/entities/isa-data-role.enum.ts
export enum ISADataRole { NO_ACCESS = 'NO_ACCESS', VIEWER = 'VIEWER', ADMIN = 'ADMIN' }

// libs/auth/src/lib/authorization/entities/isa-module.enum.ts
export enum ISAModule { USER, ORGANIZATION, APIS, TEST_ACCOUNTS, SUPPORT, GOVX, RECRUIT, INTEGRATIONS, LICENSES }
```

Each ISA user gets a `(module, role)` pair per module — e.g., `(ORGANIZATION, ADMIN)` means full CRUD on orgs.

#### The Ability Enum (permission atoms)

```typescript
// libs/auth/src/lib/authorization/entities/ability.enum.ts
export enum Ability { CREATE = 'CREATE', READ = 'READ', UPDATE = 'UPDATE', DELETE = 'DELETE', SUBMIT = 'SUBMIT', ASSIGN = 'ASSIGN', METRICS = 'METRICS' }
```

#### Default Roles by Product Line

**Vets** (`apps/backend-vets/src/seeders/default-org-roles.constants.ts`):
- **Organization Super Admin** — `AdminLevel.ALL`, all abilities, `UNIVERSAL` visibility
- **Steward** — `AdminLevel.NONE`, `[READ, CREATE, UPDATE, DELETE, SUBMIT]`, `ASSIGNMENT` visibility
- **Clerk** (default) — `AdminLevel.NONE`, `[READ, CREATE, UPDATE, DELETE]`, `ASSIGNMENT` visibility
- **Executive** — `AdminLevel.NONE`, all abilities, `GROUP_MEMBERSHIP` visibility
- **Read-Only Member** — `AdminLevel.NONE`, `[READ]`, `GROUP_MEMBERSHIP` visibility

**Recruit** (`apps/backend-recruit/src/seeders/coastguard/default-org-roles.constants.ts`):
Domain-specific roles: "Office Recruiter In Charge", "Office Recruiter" (default), "CGRC Data Executive", "MEPS Liaison", etc.

#### Backend Guards (NestJS) — chained in order:

| Guard | File | Purpose |
|---|---|---|
| `JwtAuthGuard` | `libs/auth/src/lib/guards/jwt.guard.ts` | Validates JWT cookies, loads user, attaches to `req.user` |
| `ActiveContextGuard` | `libs/auth/src/lib/guards/active-context.guard.ts` | Enforces `@RequireActiveContext([UserContextType.Client])` |
| `OrganizationGuard` | `libs/auth/src/lib/organization/organization.guard.ts` | Validates org membership + `@OrgType()` decorator |
| `AbilitiesGuard` | `libs/auth/src/lib/authorization/guards/abilities.guard.ts` | Enforces `@Permissions(Ability.READ, ISAModule.ORGANIZATION)` |
| `ActiveDutyGuard` | `libs/active-duty/src/lib/authorization/guards/active-duty.guard.ts` | Enforces `@RequiresRole(SystemRoles.SPO)` |

#### Frontend Guards (Angular) — all in `libs/ui/common/src/lib/guards/`:

| Guard | Purpose |
|---|---|
| `AuthGuard` | Checks `isAuthenticated()`, redirects to `/public/login?continue=` |
| `ContextGuard` | Checks `route.data['context']` against `activeContext.type` |
| `OrgAdminGuard` | Checks `activeOrg().isOrgAdmin` |
| `OrgGroupAdminGuard` | Checks `activeOrg().isGroupAdmin` |
| `OrgAdminOrGroupAdminGuard` | Either admin type passes |
| `isaAuthGuard(ISAModule.*)` | Checks `ISAStateService.hasModuleAccess(module)` |
| `MetricsPermissionGuard` | Checks `Ability.METRICS` in org role or any group role |
| `OrgTypeGuard` | Checks `route.data['orgType']` against `activeOrg().type` |
| `FeatureFlagGuard` | Gates routes by feature flag |

#### How Components Consume Permission State

Components read from `UiStateService` signals (injected, root-provided):

```typescript
// Navigation filtering — libs/ui/main/src/lib/navigation/left-navigation/left-navigation.component.ts
private isNavItemVisible(item: NavigationLink): boolean {
  if (item.contexts && !item.contexts.includes(this.activeContextType())) return false;
  if (item.adminLevel) {
    const org = this.uiStateService.activeOrg();
    if (level === 'ORGANIZATION') return org.isOrgAdmin;
    if (level === 'GROUP') return org.isGroupAdmin;
  }
  return this.hasModuleAccess(item.moduleAccessNeeded);
}

// Admin component — libs/ui/admin/src/lib/admin.component.ts
const isOrgAdmin = this.activeOrg()?.isOrgAdmin;
const isGroupAdmin = this.activeOrg()?.isGroupAdmin;
if (!isOrgAdmin && !isGroupAdmin) this.router.navigate(['/']);
```

**Key takeaway for BN Pools:** The pattern is: define role/permission atoms in an enum, create a role entity that bundles abilities + visibility scope, enforce on backend via guards + data-level filtering, surface on frontend via a state service that exposes `isOrgAdmin`/`isGroupAdmin`/`hasModuleAccess` as signals.

---

### 2. Role Hierarchy & Implicit Permissions
How does this app handle the pattern where a higher-privilege role (e.g., admin) implicitly has all permissions of lower roles? Is there a single function that resolves the effective permission level, or is it checked at multiple layers?

**Answer:**

This app does **not** use a strict hierarchical "admin inherits all lower role permissions" pattern. Instead, it uses a **composition model** where each role explicitly declares its abilities:

```typescript
// Each OrganizationRole has an explicit dataPermissions array:
{
  name: 'Organization Super Admin',
  adminLevel: AdminLevel.ALL,
  dataPermissions: [Ability.CREATE, Ability.READ, Ability.UPDATE, Ability.DELETE, Ability.SUBMIT, Ability.ASSIGN, Ability.METRICS],
  visibilityScope: VisibilityScope.UNIVERSAL,
}

{
  name: 'Clerk',
  adminLevel: AdminLevel.NONE,
  dataPermissions: [Ability.CREATE, Ability.READ, Ability.UPDATE, Ability.DELETE],
  visibilityScope: VisibilityScope.ASSIGNMENT,
}
```

The "higher implies lower" relationship is expressed through **two independent dimensions**:

1. **`AdminLevel`** — a true hierarchy: `ALL > ORGANIZATION > GROUP > NONE`. The frontend resolves this with simple boolean checks: `isOrgAdmin` is `true` when `adminLevel` is `ORGANIZATION` or `ALL`.

2. **`dataPermissions`** — a flat array of abilities. The Super Admin simply has all abilities listed. There's no "resolve effective permissions" function — the check is a direct `.includes()`:

```typescript
// libs/auth/src/lib/authorization/services/base-permission.provider.ts
async checkPermissions(role: string, requiredAbility: Ability): Promise<void> {
  const hasPermission = this.getRoleAbilityMap()[role].some((a) => a === requiredAbility);
  if (!hasPermission) throw new ForbiddenException(`You do not have permission for: ${requiredAbility}`);
}
```

For ISA (internal admin tool), the hierarchy is simpler and genuinely hierarchical:
- `ADMIN` can do everything `VIEWER` can do, plus write operations
- `NO_ACCESS` can do nothing
- The `getRoleAbilityMap()` in `ISAPermissionsProvider` explicitly maps: `ADMIN → [CREATE, READ, UPDATE, DELETE]`, `VIEWER → [READ]`

**Key takeaway for BN Pools:** Rather than building implicit role inheritance (which gets complex), just explicitly list permissions per role. Use `adminLevel` as a simple hierarchy for "can manage settings" type checks, and `dataPermissions` as an explicit ability array for data operations. The composition approach is cleaner and easier to reason about than "admin inherits member inherits viewer" chains.

---

### 3. Server-Side Route Protection
Show me how server-side route protection works. When a user navigates to a page they shouldn't access, what's the flow — middleware, guards, redirects? What pattern prevents the page from rendering at all vs. rendering then hiding content?

**Answer:**

The app uses Angular **route guards** (`CanActivate`) to prevent pages from rendering at all. The page component never loads if the guard returns `false`.

#### The Flow:

```
User navigates to /admin/org-settings
  ↓
Angular Router evaluates route config:
  { path: 'admin', canActivate: [ContextGuard], data: { context: UserContextType.Agent }, children: [
    { path: '', canActivate: [OrgAdminGuard], children: [
      { path: 'org-settings', loadComponent: () => ... }
    ]}
  ]}
  ↓
ContextGuard: Is activeContext === Agent? → No → redirect to '/'
  ↓  (if yes)
OrgAdminGuard: Is activeOrg().isOrgAdmin? → No → redirect to '/'
  ↓  (if yes)
loadComponent dynamically imports OrgSettingsComponent (lazy-loaded)
```

#### Guard: AuthGuard (unauthenticated → login)

```typescript
// libs/ui/common/src/lib/guards/auth.guard.ts
canActivate(): Observable<boolean> {
  if (!this.authService.isAuthenticated()) {
    this.router.navigate(['/public/login'], {
      queryParams: { continue: this.router.url }  // deep-link back after login
    });
    return of(false);
  }
  return this.authService.getLoggedInUser().pipe(map(() => true));
}
```

#### Guard: ContextGuard (wrong user type → redirect)

```typescript
// libs/ui/common/src/lib/guards/context.guard.ts
canActivate(route: ActivatedRouteSnapshot): boolean {
  const requiredContext = route.data['context'];
  const currentContext = this.uiStateService.currentUser()?.activeContext?.type;
  return requiredContext.includes(currentContext);
  // Returns false → Angular Router blocks navigation, component never renders
}
```

#### Guard: isaAuthGuard (no module access → /no-access page)

```typescript
// libs/ui/common/src/lib/guards/isa-auth.guard.ts
export function isaAuthGuard(module: ISAModule): CanActivateFn {
  return () => {
    if (!isaStateService.hasModuleAccess(module)) {
      router.navigate(['/no-access']);
      return false;
    }
    return true;
  };
}
```

#### Route config example (ISA admin tool):

```typescript
// apps/ui-vets/src/app/main/isa/isa.routes.ts
{ path: 'users',    canActivate: [isaAuthGuard(ISAModule.USER)], loadComponent: ... },
{ path: 'orgs',     canActivate: [isaAuthGuard(ISAModule.ORGANIZATION)], loadComponent: ... },
{ path: 'licenses', canActivate: [isaAuthGuard(ISAModule.LICENSES)], loadComponent: ... },
```

#### Key Design Decision: Guards prevent rendering, not hide content

The pattern is **never render then hide**. Guards return `false` before the component loads:
- Unauthenticated → redirect to login with `?continue=` for deep-link return
- Wrong context type → redirect to home
- No ISA access → redirect to `/no-access`
- Not org admin → redirect to home

Content hiding (`*ngIf` / `@if`) is only used for **within-page** permission nuance (e.g., hiding a "Create Group" button for non-admins on a page they can already access).

**Key takeaway for BN Pools:** Use Next.js middleware or `layout.tsx` server-side checks to block page rendering entirely. Don't render a page and then hide content — check auth/role before the page component mounts. Store the intended URL for post-login redirect.

---

### 4. API vs UI Permission Enforcement
How does this app handle permission checks at the API/data layer vs. the UI layer? Is there a pattern where the backend enforces access control independently of what the frontend shows/hides?

**Answer:**

**Yes — the backend enforces independently.** The frontend hides UI elements for UX convenience, but the backend independently rejects unauthorized requests even if the frontend is bypassed.

#### Backend: Multi-layer enforcement

**1. Guard layer** (decorator-driven, on resolvers/controllers):
```typescript
// libs/auth/src/lib/isa/resolvers/isa-org-management.resolver.ts
@UseGuards(AbilitiesGuard)
@Resolver()
export class IsaOrgManagementResolver {
  @Permissions(Ability.READ, ISAModule.ORGANIZATION)
  @Query(() => [Organization])
  async listOrganizations() { ... }

  @Permissions(Ability.CREATE, ISAModule.ORGANIZATION)
  @Mutation(() => Organization)
  async createOrganization() { ... }
}
```

**2. Data-level filtering** (the most sophisticated layer — `OwnableRepository`):

```typescript
// libs/auth/src/lib/authorization/repositories/ownable.repository.ts
// All entity queries are automatically filtered based on the user's role:
async findWithOwnership(options, currentUser, activeOrgId, requiredPermissions): Promise<T[]>
```

This repository automatically applies WHERE clauses based on `VisibilityScope`:
- `UNIVERSAL` → no ownership filter (sees everything in org)
- `GROUP_MEMBERSHIP` → only data in groups the user belongs to
- `ASSIGNMENT` → only data explicitly assigned to the user via `EntityOwner` records

This means even if you craft a raw GraphQL query with someone else's record UUID, the `OwnableRepository` will return nothing because you're not an owner/member.

**3. Context validation** (global guard):
```typescript
// @RequireActiveContext([UserContextType.Client])
// Ensures only veterans can call veteran-specific mutations
```

#### Frontend: UX-level hiding (not security)

The frontend hides elements purely to avoid confusion:
```typescript
// Navigation items have adminLevel gating
{ label: 'Admin', path: '/admin', adminLevel: 'ORGANIZATION' }
// → isNavItemVisible() hides from non-admins

// Buttons conditionally shown
@if (isOrgAdmin()) { <button>Create Group</button> }
```

But if a user somehow navigates to `/admin` anyway, the Angular `OrgAdminGuard` blocks them. And even if they bypass that and call the GraphQL mutation directly, the `OrganizationGuard` + `AbilitiesGuard` on the backend reject the request.

**Key takeaway for BN Pools:** Always enforce permissions on the server side independently. Use Supabase Row Level Security (RLS) policies as your equivalent of `OwnableRepository` — they filter data at the database level regardless of what the client sends. Use frontend checks only for UX (hiding buttons, disabling forms), never for security.

---

## Error Handling & Loading States (Phase 0C)

### 5. Error Handling Architecture
Show me the error handling architecture. How does this app handle: (a) API errors returned from the backend, (b) unexpected runtime errors in components, (c) network failures? Are there global error boundaries, and what do users see when something breaks?

**Answer:**

#### (a) Backend: Global Exception Filter

All backend errors funnel through a single `GlobalExceptionFilter`:

```typescript
// libs/shared/src/lib/exceptions/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType<GqlContextType>() === 'graphql') {
      // Re-throw as GraphQLError with structured extensions
      return new GraphQLError(exception.message, {
        extensions: { operation, userId, requestId, code, statusCode, isRetryable, detailedMessage }
      });
    }
    // HTTP path — logs and rethrows
  }
}

// Registered globally in every app module:
{ provide: APP_FILTER, useClass: GlobalExceptionFilter }
```

Errors use a consistent shape via constants:
```typescript
// libs/shared/src/lib/constants/error.constants.ts
export const ERRORS = {
  USER_NOT_FOUND: { code: 'USER_NOT_FOUND', message: 'User not found.', detailedMessage: '...' },
  LICENSE_EXPIRED: { code: 'LICENSE_EXPIRED', message: '...', detailedMessage: '...' },
  INTERNAL_SERVER_ERROR: { code: 'INTERNAL_SERVER_ERROR', message: '...', detailedMessage: '...' },
};
```

Third-party integration failures have their own exception hierarchy:
```typescript
// libs/shared/src/lib/exceptions/base-integration.exception.ts
export class BaseIntegrationException extends HttpException {
  constructor(
    public readonly integrationName: string,
    public readonly isRetryable: boolean, // BullMQ uses this for retry vs. UnrecoverableError
    // ...
  ) { ... }
}
// Extended by: RetellIntegrationException, TwilioIntegrationException, ExperianIntegrationException
```

#### (b) Frontend: Apollo Error Link (global GraphQL error handler)

```typescript
// libs/ui/common/src/lib/services/apollo/apollo-error-link.ts
export function injectApolloErrorLink(): ApolloLink {
  return onError(({ graphQLErrors }) => {
    if (!graphQLErrors) return;
    const errorService = injector.get(ApolloErrorService);
    errorService.handleErrors(graphQLErrors);
  });
}

// libs/ui/common/src/lib/services/apollo/apollo-error.service.ts
handleErrors(errors: readonly GraphQLError[]): void {
  if (this.isLicenseExpiredError(errors)) {
    this.licenseStateService.handleMidSessionLicenseExpiry();
  }
}
```

Component-level errors use `catchError` in RxJS pipes with toast notifications:
```typescript
// Component pattern — never in subscribe(), always in pipe()
this.someService.doThing().pipe(
  tap(() => this.toastr.success('Done!')),
  catchError((error) => {
    this.toastr.error('Failed to do thing');
    this.revertOptimisticUpdate(); // if applicable
    return of(null);
  })
).subscribe();
```

#### (c) Network/WebSocket Failures

```typescript
// WebSocket closure handling in app.config.ts
const ws = new GraphQLWsLink(createClient({
  on: {
    closed: async (event) => {
      if (event.code === 4401) {
        window.location.reload(); // Force re-auth on token expiry
      }
    },
  },
}));
```

#### What Users See

- **Toast notifications** (`ngx-toastr` with custom `ToastWrapperComponent`): mapped to design system variants (`success`, `destructive`, `warning`, `info`, `gray`). Positioned `toast-bottom-right`, 5s auto-dismiss.
- **License expiry**: mid-session modal/redirect via `LicenseStateService`
- **Auth expiry**: page reload forces re-login flow

There is no React-style "error boundary" component. Errors are caught per-operation in RxJS pipes and surfaced as toasts.

**Key takeaway for BN Pools:** Create a central error handler that intercepts all API responses (Next.js fetch wrapper or React Query error handler). Use toast notifications for user-facing errors. Define error constants with codes, messages, and detailed messages. On the backend, use a single exception filter/middleware that normalizes all errors into a consistent shape.

---

### 6. Loading State Patterns
What loading state patterns does this app use? Show me examples of skeleton loaders, loading spinners, or progressive loading. How are loading states coordinated when a page needs multiple async data sources before it can render?

**Answer:**

#### Pattern 1: Spinner Component

```typescript
// libs/ui/common/src/lib/loading/loading-spinner.component.ts
@Component({ selector: 'lib-loading-spinner' })
export class LoadingSpinnerComponent {
  @Input() size = 'sm'; // 'sm' | 'md' | 'lg'
}
// Template: <ng-icon name="lucideLoaderCircle" class="text-tv-green-500 animate-spin">
```

Used inline wherever a small loading indicator is needed.

#### Pattern 2: Skeleton Shimmer Rows (Grid)

```html
<!-- libs/ui/common/src/lib/grid/grid.component.html -->
@if (loading() && !rows().length) {
  @for (row of rowArray(); track row) {
    <tr>
      <td><div class="bg-shimmer h-4 w-4"></div></td>  <!-- Shimmer placeholder per column -->
    </tr>
  }
}
```

`rowArray` is pre-computed from `Array(currentInput().limit)` so the skeleton row count matches the expected page size. This gives users a sense of table structure before data loads.

#### Pattern 3: Signal-Based Loading State (Grid)

```typescript
// libs/ui/common/src/lib/grid/grid-state.service.ts
loading = signal<boolean>(false);

// Automatically managed:
this.currentInput$.pipe(
  tap(() => this.loading.set(true)),
  switchMap((input) => this.state.loadData(input).pipe(
    tap(() => this.loading.set(false)),
    catchError(() => { this.loading.set(false); return of([]); })
  ))
).subscribe();
```

#### Pattern 4: Workflow Loading Step

```typescript
// libs/ui/common/src/lib/forms/workflow-steps/loading-step/loading-step.component.ts
// A dedicated step component for async processing within multi-step workflows:
currentState = computed(() => /* LOADING | SUCCESS | ERROR */);
isLoading = computed(() => this.currentState() === LoadingStepState.LOADING);
// Shows spinner while LOADING, then success/error illustration
```

#### Coordinating Multiple Data Sources

Pages that need multiple async sources use **sequential `switchMap` chaining**:

```typescript
// apps/ui-vets/.../client-detail.component.ts
// Load client → then profile → then POA status (each depends on previous)
return this.clientConsumerService.getClient(uuid).pipe(
  tap((client) => this.clientStateService.setClient(client)),
  switchMap((client) =>
    this.profileConsumerService.getProfileByPublicProfile(client.publicProfile.uuid).pipe(
      switchMap((profile) => this.poaService.syncPOAStatus(client.publicProfile, profile)),
      catchError(() => this.poaService.syncPOAStatus(client.publicProfile)) // graceful degradation
    )
  )
);
```

WebSocket subscriptions for real-time updates run in **parallel** (separate subscription pipes with `takeUntil(destroy$)`), not blocking initial load.

**Key takeaway for BN Pools:** Use skeleton rows in tables (match expected row count to page size). Use a simple `loading` signal/state variable per data source. Chain dependent fetches with `async/await` or Promise chains. Run independent fetches in parallel with `Promise.all()`. Use React Suspense boundaries as the equivalent of Angular's loading signal pattern.

---

### 7. Empty State Patterns
How does this app handle the 'empty state' pattern — when a list or table has no data? Show me examples of empty state components and how they differ from loading states.

**Answer:**

Empty states are handled **inline within the grid component**, not as standalone components:

```html
<!-- libs/ui/common/src/lib/grid/grid.component.html -->
@if (loading() && !rows().length) {
  <!-- Shimmer skeleton rows (LOADING state) -->
} @else if (rows().length === 0) {
  <!-- EMPTY state -->
  <tr class="animate-fade-in bg-white">
    <td [attr.colspan]="state.columns().length + 1"
        class="text-tv-gray-500 py-4 text-center">
      No records found
    </td>
  </tr>
}
```

The distinction from loading is clear:
- **Loading + no rows yet** → show shimmer skeletons
- **Not loading + no rows** → show "No records found" message
- **Has rows** → show actual data

The empty state message fades in (`animate-fade-in`) to avoid flashing during fast loads.

This app does **not** have elaborate empty state illustrations or call-to-action components. It's a simple centered text message. For BN Pools you could expand on this pattern with illustrations and CTAs (e.g., "No pools yet — create your first one!").

**Key takeaway for BN Pools:** The key distinction is loading vs. empty. Use a tri-state: `loading && no data` → skeletons, `!loading && no data` → empty state with CTA, `has data` → render list. Consider adding illustrations and action buttons to empty states for better UX.

---

## Form Handling & Validation (Phase 4A)

### 8. Form Architecture
Show me the form architecture in this app. How are forms built — is there a form library, custom abstractions, or reactive forms? How is validation defined (inline, schema-based, server-side)? Walk me through a complex form with 10+ fields as an example.

**Answer:**

#### Primary Architecture: @ngx-formly (config-driven forms)

All complex forms use **Formly** — you define forms as JSON/TypeScript configuration, not HTML templates. The global config registers 50+ custom field types:

```typescript
// libs/ui/common/src/lib/forms/formly-config.ts (TV_FORMLY_CONFIG)
types: [
  // Basic inputs
  { name: 'input', component: InputFieldComponent },
  { name: 'number', component: NumberFieldComponent },
  { name: 'currency', component: CurrencyFieldComponent },
  { name: 'phone', component: PhoneFieldComponent },
  { name: 'ssn', component: SsnFieldComponent },
  { name: 'textarea', component: TextareaFieldComponent },

  // Selection
  { name: 'select', component: SelectFieldComponent },
  { name: 'radio', component: RadioFieldComponent },
  { name: 'radio-cards', component: RadioCardsFieldComponent },
  { name: 'checkbox', component: CheckboxFieldComponent },
  { name: 'multiselect-dropdown', component: MultiselectDropdownFieldComponent },
  { name: 'combobox', component: ComboboxFieldComponent },

  // Specialized
  { name: 'date', component: DateFieldComponent },
  { name: 'address', component: AddressFieldComponent },
  { name: 'city-state-country', component: CityStateCountryFieldComponent },
  { name: 'file', component: FileFieldComponent },
  { name: 'signature', component: SignatureFieldComponent },
  { name: 'autocomplete', component: AutocompleteFieldComponent },
  // ...50+ total types
],
wrappers: [
  { name: 'form-field', component: FormFieldWrapperComponent },
  { name: 'form-section', component: FormSectionWrapperComponent },
  // ...
]
```

#### Validation

Validators are registered globally in the Formly config:
```typescript
validators: [
  { name: 'required', validation: Validators.required },
  { name: 'email', validation: EmailValidator },
  { name: 'phone', validation: PhoneValidator },          // libphonenumber-js
  { name: 'ssn', validation: SSNValidator },              // 9-digit rules
  { name: 'postalCodeLength', validation: PostalCodeLengthValidator },
],
validationMessages: [
  { name: 'required', message: 'This field is required' },
  { name: 'email', message: 'This field should be a valid email' },
  { name: 'minLength', message: (_err, field) => `Should have at least ${field.props?.minLength} characters` },
  { name: 'invalidPhoneNumber', message: 'Please enter a valid phone number.' },
]
```

#### Complex Form Example: Profile Data (20-40+ fields)

The profile form spans personal data, military service, health, financial, and family sections. The data structure (`PROFILE_SELECTION_SET` in `libs/ui/common/src/lib/services/profile-consumer/profile-consumer.service.ts`) covers 300+ lines of GraphQL fields:

- `personalData`: firstName, lastName, middleName, SSN, DOB, addresses (multiple), phone numbers, email
- `serviceRecord`: service periods (branch, dates, rank, activities, awards, combat zones, injuries, POW, deployments, exposures)
- `healthData`: treatments, conditions
- `financialData`: banking info
- `education`: schools, degrees
- `employment`: employers, dates
- `spouses`, `children`: family members

Each section is rendered as a Formly form step within a workflow, using the `form-section` wrapper for visual grouping.

#### How a Form Step Works in a Workflow:

```typescript
// libs/ui/common/src/lib/forms/workflow-steps/form-step/form-step.component.ts
performSave() {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    this.helperService.focusOnFirstInvalidField(this.fields); // Auto-scroll to first invalid
    throw new Error('Form validation failed');
  }
  return of(this.form.getRawValue());
}
```

**Key takeaway for BN Pools:** The Formly pattern maps well to a schema-driven approach. For Next.js, consider React Hook Form + Zod schemas (or Formik) — define fields as config objects, render them dynamically, and validate with a schema. The key insight is separating form definition (config) from rendering (component library).

---

### 9. Multi-Step Forms & Wizards
How does this app handle multi-step forms or wizards? Show me the state management pattern — how does data persist across steps, how is step navigation controlled, and what happens if validation fails on a middle step?

**Answer:**

There are **two wizard systems** — a lightweight client-side one and a server-driven workflow system.

#### System 1: Client-Side Wizard (lightweight)

```typescript
// libs/ui/common/src/lib/wizard/wizard.ts
export class Wizard<T> {
  steps: WizardStep<T>[] = [];
  currentStepIndex = 0;
  loading = false;
  data?: T;          // Shared data across all steps
  isComplete = false;
}

export class WizardStep<T> {
  name = '';
  label = '';
  completed = false;
  inputs: Record<string, unknown> = {};
  component?: Type<AbstractWizardStepComponent<T>>;
}
```

The `WizardComponent` dynamically renders the current step:
```typescript
// libs/ui/common/src/lib/wizard/wizard.component.ts
loadStepComponent = effect(() => {
  const wizard = this.wizard();
  const currentStep = wizard.steps[wizard.currentStepIndex];
  this.stepContainer.clear();
  const component = this.stepContainer.createComponent(currentStep.component);
  component.instance.wizard = this.wizard; // Two-way signal binding
});
```

Steps advance by calling `updateWizard()`:
```typescript
// libs/ui/common/src/lib/wizard/wizard-step/abstract-wizard-step.component.ts
export abstract class AbstractWizardStepComponent<T> {
  wizard = model<Wizard<T> | null>(null);

  protected updateWizard(data: Partial<Wizard<T>>) {
    this.wizard.set({ ...this.wizard(), ...data });
  }

  // Step advances: this.updateWizard({ currentStepIndex: current + 1 });
  // Complete: this.updateWizard({ isComplete: true });
}
```

Data persists via the `wizard.data` property — each step reads/writes to it. Parent components react to completion:
```typescript
// Usage: VerificationWizardComponent
wizard = signal<Wizard<VerificationType>>(new Wizard({
  steps: [
    new WizardStep({ name: 'form', component: VerificationFormInputComponent }),
    new WizardStep({ name: 'confirmation', component: VerificationConfirmationComponent }),
  ],
}));
effect = effect(() => {
  if (this.wizard()?.isComplete) this.modalRef.close();
});
```

#### System 2: Server-Driven Workflows (complex, persistent)

For workflows that must survive page refreshes and track progress server-side:

```typescript
// libs/ui/common/src/lib/workflow/workflow-step/workflow-step.component.ts
// Backend persists WorkflowExecution state, frontend renders based on currentStepId
performSave() → workflowConsumerService.performOperation(WorkflowOperation.Next)
// Backend validates, persists data, advances step, pushes update via WebSocket
// Frontend re-renders with new step via GraphQL subscription
```

Back navigation: `WorkflowOperation.Previous`
Loading state: `workflowState.setIsLoading(true/false)` wraps the async operation.

#### Validation Failure on a Middle Step:

```typescript
// libs/ui/common/src/lib/forms/workflow-steps/form-step/form-step.component.ts
performSave() {
  if (this.form.invalid) {
    this.form.markAllAsTouched();                              // Show all validation errors
    this.helperService.focusOnFirstInvalidField(this.fields);  // Scroll to first error
    throw new Error('Form validation failed');                 // Blocks advance
  }
  return of(this.form.getRawValue());
}
```

The workflow **does not advance** — the user stays on the current step until validation passes. Server-side errors show as toast: `toastr.error(message, 'Workflow Error')`.

**Key takeaway for BN Pools:** For the golf stepper, the client-side `Wizard<T>` pattern is perfect. Create a wizard state object with steps, currentIndex, and shared data. Each step component reads/writes to shared state. Validate before advancing. For persistent progress (survives page refresh), store step state in the database.

---

### 10. Form Submission Error Handling
Show me how form submission error handling works. When a form submit fails (validation error, server error, network error), what's the UX pattern? How are field-level errors vs. form-level errors displayed?

**Answer:**

#### Field-Level Validation Errors (client-side)

Formly handles this automatically — each field type has built-in error display:
- Field border turns red
- Inline error message appears below the field (from `validationMessages` config)
- `form.markAllAsTouched()` triggers display of all errors at once
- `focusOnFirstInvalidField()` scrolls the user to the first problem

```typescript
// Validation messages are templated:
{ name: 'minLength', message: (_err, field) => `Should have at least ${field.props?.minLength} characters` }
{ name: 'required', message: 'This field is required' }
```

#### Form-Level Errors (server errors after submit)

Server errors from workflow operations display as **toast notifications**:
```typescript
// In workflow step component
onNextClick().pipe(
  catchError((error) => {
    this.toastr.error(error.message, 'Workflow Error', {
      positionClass: 'toast-workflow-center'  // Centered for workflow context
    });
    return of(null);
  })
).subscribe();
```

For non-workflow forms (e.g., settings, inline edits):
```typescript
this.someService.updateRecord(data).pipe(
  tap(() => this.toastr.success('Changes saved successfully', 'Success')),
  catchError((error) => {
    this.toastr.error('Failed to save changes');
    return of(null);
  })
).subscribe();
```

#### The Full Error Flow:

1. User clicks "Next" / "Submit"
2. **Client validation** runs → if invalid: `markAllAsTouched()` + `focusOnFirstInvalidField()` + block submit
3. **Server request** fires → if error: `catchError` → toast notification + optional optimistic revert
4. **Success** → toast success + advance step / close modal / navigate

**Key takeaway for BN Pools:** Use a two-tier approach: (1) Field-level errors rendered inline by your form library (React Hook Form + Zod). (2) Server errors shown as toast notifications. Always validate client-side first before making the API call.

---

## Data Fetching & State Management (Phase 4B)

### 11. Data Fetching Organization
How is data fetching organized in this app? Is there a service layer, repository pattern, or data access abstraction? Show me how a page that needs data from 3+ different endpoints/tables coordinates those fetches.

**Answer:**

#### Backend: Repository → Provider → Resolver (3-layer)

```
GraphQL Resolver (entry point, thin)
  ↓ calls
Provider / Service (business logic, validation, orchestration)
  ↓ calls
Repository (data access, extends CoreRepository<T>)
  ↓ uses
TypeORM (SQL generation, transactions)
```

```typescript
// libs/shared/src/lib/repositories/core.repository.ts
@Injectable()
export class CoreRepository<T extends CoreEntity> extends Repository<T> {
  async updateAndSave(manager, entity, data, options): Promise<T> { ... }
  async createAndSave(data, options?, manager?): Promise<T> { ... }
  // Handles OneToOne and OneToMany relation upserts automatically
}
```

50+ domain repositories extend `CoreRepository<T>`. Business logic goes in providers/services, **not** repositories (per coding standards).

#### Frontend: Consumer Service Pattern

All frontend data access goes through **Consumer Services**:

```typescript
// libs/ui/common/src/lib/base/base-consumer.service.ts
export abstract class BaseConsumerService {
  // Dynamically builds GraphQL selection sets from TypeScript objects
  buildSelectionSet(input: Record<string, unknown>, includeRelations = true): string { ... }
}
```

Every domain has a consumer: `ProfileConsumerService`, `ClientConsumerService`, `TaskConsumerService`, `NotesConsumerService`, etc. They use Apollo Angular's `watchQuery()`, `mutate()`, and `subscribe()`.

#### Multi-Source Page Coordination

Pages that need data from 3+ sources use **sequential `switchMap` chaining** for dependent data and **parallel subscriptions** for independent real-time streams:

```typescript
// apps/ui-vets/.../client-detail.component.ts
// Sequential (each depends on previous):
this.clientConsumerService.getClient(uuid).pipe(
  tap((client) => this.clientStateService.setClient(client)),         // Source 1: Client
  switchMap((client) =>
    this.profileConsumerService.getProfileByPublicProfile(             // Source 2: Profile
      client.publicProfile.uuid
    ).pipe(
      switchMap((profile) => this.poaService.syncPOAStatus(           // Source 3: POA status
        client.publicProfile, profile
      )),
      catchError(() => this.poaService.syncPOAStatus(client.publicProfile)) // graceful degradation
    )
  )
).subscribe();

// Parallel (independent real-time streams):
this.clientConsumerService.subscribeToClientUpdates(uuid)
  .pipe(takeUntil(this.destroy$))
  .subscribe();  // runs independently
```

**Key takeaway for BN Pools:** The Consumer Service pattern maps to custom hooks in React. Create a `usePool()`, `useMembers()`, `usePicks()` hook layer. For multi-source pages, use `Promise.all()` for parallel independent fetches, and sequential `await` for dependent fetches. React Query / SWR handles caching and revalidation automatically.

---

### 12. Caching & Revalidation
Show me how this app handles data caching and revalidation. When data is fetched, where is it stored? How does the app know when to refetch — time-based, event-based, manual invalidation?

**Answer:**

#### Apollo InMemoryCache

The primary cache is Apollo Client's `InMemoryCache`, configured with `addTypename: false` (manual cache control). Queries use explicit `fetchPolicy` per call:

```typescript
fetchPolicy: 'cache-first'    // Use cache if available (default for stable data like service periods)
fetchPolicy: 'network-only'   // Always hit the server (for data that must be fresh)
fetchPolicy: skipCache ? 'network-only' : 'cache-first'  // Caller decides
```

#### Event-Based Revalidation (primary pattern)

Rather than time-based TTL, the app uses **WebSocket subscriptions** to know when to refetch:

```typescript
// When server pushes an update for this client, refetch everything
this.clientConsumerService.subscribeToClientUpdates(uuid).pipe(
  takeUntil(this.destroy$),
  switchMap(() => this.loadClient(uuid, true))  // true = skipCache
).subscribe();
```

This is the dominant revalidation strategy. The backend publishes to Redis Pub/Sub when entities change, which triggers frontend refetches.

#### Manual Invalidation (modal-triggered refresh)

When a modal closes after a mutation, the parent component refetches:
```typescript
modalInstance.closed.pipe(
  switchMap(() => this.loadClient(uuid, true))  // Force refetch after modal save
).subscribe();
```

#### Signal-Based State (not cached, session-scoped)

State services like `UiStateService`, `ClientStateService`, `ProfileStateService` hold data in signals during the session. This is not a cache — it's session state that's populated on navigation and cleared on component destroy.

```typescript
// libs/ui/common/src/lib/services/ui-state/ui-state.service.ts
private _currentUser = signal<User | null>(null);
public currentUser = this._currentUser.asReadonly();
```

**Key takeaway for BN Pools:** Use React Query/SWR with `staleTime` for time-based caching, and `queryClient.invalidateQueries()` for manual invalidation after mutations. For real-time features, use Supabase Realtime subscriptions to trigger refetches — similar to this app's WebSocket subscription pattern. The combination of `staleTime` + `invalidateQueries` + realtime subscriptions covers all three revalidation strategies.

---

### 13. Optimistic Updates
How does this app handle optimistic updates? When a user takes an action (e.g., approving a member, updating a record), does the UI update immediately before the server confirms? Show me the pattern.

**Answer:**

Yes, the app uses optimistic updates with **signal-based revert on failure**:

```typescript
// apps/ui-vets/.../client-detail.component.ts — adding a highlight
addHighlight(newHighlight: string) {
  const client = this.clientStateService.client();
  const originalHighlights = this.highlightList();  // Save for revert

  // 1. Optimistic update — immediately update UI
  const updateArr = [...originalHighlights, newHighlight];
  this.highlightList.set(updateArr);
  this.clientStateService.setClient({ ...client, highlights: updateArr.join(';') });

  // 2. Fire API call
  return this.clientConsumerService.addHighlight(client.uuid, newHighlight).pipe(
    tap(() => this.toastr.success('Highlight added successfully')),

    // 3. Revert on failure
    catchError(() => {
      this.highlightList.set(originalHighlights);         // Revert signal
      this.clientStateService.setClient(client);          // Revert store
      this.toastr.error('Failed to save highlight');
      return of(null);
    })
  );
}
```

The pattern:
1. Save current state for potential revert
2. Immediately update all relevant signals/state
3. Fire the API call
4. On success: show success toast
5. On failure: revert all signals to saved state + show error toast

This pattern appears in both `ui-vets` and `ui-recruit` for highlights and task status updates.

**Key takeaway for BN Pools:** React Query has built-in optimistic update support via `onMutate` / `onError` / `onSettled`. The pattern is identical: save previous state in `onMutate`, update cache optimistically, revert in `onError`, and refetch in `onSettled` for consistency.

---

## Component Architecture & Patterns (Phase 4C)

### 14. Large Page Decomposition
Show me how this app structures large pages that handle multiple concerns (e.g., a detail page that shows different content based on entity type or user role). How is the code split — separate components, lazy loading, conditional rendering patterns?

**Answer:**

#### Pattern: Shell + Tabs + Shared State Service

The `ClientDetailComponent` is the canonical example:

```
client-detail/
  client-detail.component.ts            ← Shell (routing + global state loading)
  client-state/
    client-state.service.ts             ← Shared signals for all child tabs
  client-dashboard/
    client-dashboard.component.ts       ← Tab: Dashboard overview
  client-cases/
    client-cases.component.ts           ← Tab: Cases list
    client-case-detail/
      abstract-case-detail.component.ts ← Abstract base for polymorphic cases
      disability-case-detail/
        claim-case-detail/
        appeal-case-detail/
        form-case-detail/
  client-documents/
  client-tasks/
  client-messages/
  client-audit-trails/
```

The parent shell:
1. Loads the entity once (client data)
2. Writes it into `ClientStateService` (a signal-based state service)
3. Renders tabs as child routes (lazy-loaded)
4. All child tab components read from `ClientStateService`

```typescript
// Shell component
tabs = computed<Tab[]>(() => [
  { label: 'Dashboard', route: 'dashboard' },
  { label: 'Cases', route: 'cases' },
  { label: 'Documents', route: 'documents' },
  { label: 'Tasks', route: 'tasks' },
  { label: 'Messages', route: 'messages' },
  { label: 'Audit Trails', route: 'audit-trails' },
]);
```

#### Polymorphic Content: Abstract Base Components

For pages that show different content based on entity type:

```typescript
// apps/ui-vets/.../abstract-case-detail.component.ts
export abstract class AbstractCaseDetailComponent<T extends Case> {
  case = input.required<T>();
  refreshCase = output<void>();
  navigateToWorkflow = output<string>();
}
// Extended by: ClaimCaseDetailComponent, AppealCaseDetailComponent, FormCaseDetailComponent
```

The parent conditionally renders the right subclass:
```html
@switch (case.type) {
  @case ('claim') { <app-claim-case-detail [case]="case" /> }
  @case ('appeal') { <app-appeal-case-detail [case]="case" /> }
}
```

#### Shared State Service Pattern

```typescript
// apps/ui-recruit/.../recruit-detail-state.service.ts
@Injectable()  // NOT providedIn: 'root' — scoped to the detail page
export class RecruitDetailStateService {
  private readonly recruitSignal = signal<Recruit | null>(null);
  readonly recruit = computed(() => this.recruitSignal());
  readonly pipelineExecution = computed(() => this.pipelineExecutionSignal());
  readonly loading = signal<boolean>(true);
}
```

**Key takeaway for BN Pools:** Use a layout component that loads shared data and passes it via React Context (equivalent of the state service). Render tabs as nested routes. Use polymorphic components with a common interface for different entity types. Lazy-load tab content with `React.lazy()` or Next.js parallel routes.

---

### 15. Reusable Table/List Components
How does this app handle reusable table/list components? Is there a generic table component that handles sorting, filtering, pagination, and empty states? Show me the abstraction and how individual pages customize it.

**Answer:**

#### GridComponent<T> — the central abstraction

```typescript
// libs/ui/common/src/lib/grid/grid.component.ts
// + libs/ui/common/src/lib/grid/grid-state.service.ts
```

**GridColumn interface** — how pages define columns:
```typescript
// libs/ui/common/src/lib/grid/models/grid-column.ts
export interface GridColumn<T> {
  name: string;               // Supports dot notation for nested props ("user.name")
  label: string;
  cellTemplate?: Type<AbstractCellTemplateComponent<T>>;  // Custom cell renderer
  cellTemplateOptions?: unknown;   // Passed to the cell component
  sortable?: boolean;
  sortFields?: string[];      // Override sort field when name != DB column
  isAction?: boolean;
}
```

**GridOptions** — how pages configure behavior:
```typescript
// libs/ui/common/src/lib/grid/models/grid-options.ts
export interface GridOptions<T> {
  showCheckboxes: boolean;
  showSearch: boolean;
  showPagination: boolean;
  defaultPageSize: number;
  rowClickCallback?: (row: T) => void;
  filter?: {
    formFields: FormlyFieldConfig[];  // Filter form uses Formly!
    onApply: (value: Record<string, unknown>) => void;
  };
  primaryButton?: Button;     // "Create New" button
  selectButtons?: Button[];   // Bulk action buttons
}
```

**GridState<T>** — stateful data manager per grid instance:
```typescript
// libs/ui/common/src/lib/grid/grid-state.service.ts
export class GridState<T> {
  constructor(public loadData: (input: U) => Observable<T[]>) {}
  private _rows = signal<T[]>([]);
  private _currentInput = signal<U>({ offset: 0, limit: 10 });
  // Changing currentInput automatically triggers loadData via toObservable()
}
```

#### Usage Example (TaskListComponent):

```typescript
// libs/ui/tasks/src/lib/task-list/task-list.component.ts
state: GridState<Task> = new GridState<Task>(this.loadData);

columns = computed<GridColumn<Task>[]>(() => [
  { name: 'name', label: 'Name', sortable: true },
  { name: 'status', label: 'Status', sortable: true, cellTemplate: TaskStatusCellComponent },
  { name: 'actions', label: 'Actions', cellTemplate: TaskActionsCellComponent,
    cellTemplateOptions: {
      onView: (task: Task) => this.onViewTask(task),
      onEdit: (task: Task) => this.onEditTask(task),
    }
  },
]);
```

#### Custom Cell Templates

All custom cells extend `AbstractCellTemplateComponent<T>`. Notable example: `EditableCellTemplateComponent` embeds an inline Formly field with an `onChange` callback, enabling **inline editing directly in the grid**.

#### Built-in Features:
- **Sorting**: Grid handles `onSortColumn()` internally, updates `currentInput`
- **Pagination**: Built-in, controlled by `defaultPageSize` option
- **Search**: Built-in search bar (when `showSearch: true`)
- **Filtering**: Filter sidebar with Formly fields
- **Checkboxes**: Row selection with bulk action buttons
- **Loading**: Shimmer skeleton rows while `loading() && !rows().length`
- **Empty state**: "No records found" when `rows().length === 0`

**Key takeaway for BN Pools:** Create a generic `<DataTable>` component that accepts column definitions (with custom cell renderers), options (search, pagination, filters), and a data loader function. Use TanStack Table for React — it provides headless table logic (sorting, filtering, pagination) that you wrap with your own UI. The `GridState` pattern maps to React Query's `useInfiniteQuery` or a custom `useTableState` hook.

---

### 16. Modal/Dialog Patterns
Show me how modal/dialog patterns work in this app. Is there a central modal manager, or are modals colocated with their triggers? How is modal state managed, especially when a modal needs to trigger a data refresh on close?

**Answer:**

#### Central ModalService (imperative, root-provided)

```typescript
// libs/ui/common/src/lib/modal/modal.service.ts
@Injectable({ providedIn: 'root' })
export class ModalService {
  open<T, O extends ModalOptions>(
    component: Type<AbstractModalComponent<T, O>>,
    options?: O
  ): ModalInstance<T> {
    // Dynamically creates component, appends to document.body
    // Returns { closed: Observable<T>, dismissed: Observable<void> }
  }
}
```

#### How Callers Open Modals and Handle Results:

```typescript
const modalInstance = this.modalService.open(InputPromptModalComponent, {
  title: 'Add Highlight',
  placeholder: 'Enter highlight text...',
});

merge(
  modalInstance.closed.pipe(
    switchMap((newHighlight: string) => {
      // Modal closed with a value → save to backend → refresh UI
      return this.clientConsumerService.addHighlight(uuid, newHighlight).pipe(
        tap(() => this.loadClient(uuid, true))  // Refresh after save
      );
    })
  ),
  modalInstance.dismissed.pipe(map(() => null))  // Modal dismissed → no-op
).pipe(takeUntil(this.destroy$)).subscribe();
```

#### Modal Hierarchy:

- `AbstractModalComponent<T, O>` — base class with `options` and `modalRef` inputs
- `ModalOptions` — config (title, width, position, backdropClickDismiss)
- `ModalInstance<T>` — returned to caller with `closed` and `dismissed` observables
- `ModalRef<T>` — injected into modal content for calling `close(value)` or `dismiss()`
- `ModalWrapperComponent` — handles backdrop, animation, close on escape

#### ModalOptions.position: `'side'` renders as a right-side panel/drawer

#### Built-in Generic Modals:
- `ConfirmationModalComponent` — yes/no confirmation
- `InputPromptModalComponent` — single text field prompt
- `HtmlContentModalComponent` — render arbitrary HTML
- `UploadModalComponent` — file upload
- `MediaViewerModalComponent` / `VideoModalComponent` — media viewing

#### Data Refresh Pattern:

The key pattern is: **the caller subscribes to `closed` and triggers its own refresh**. The modal itself doesn't know about parent state — it just returns a value via `modalRef.close(result)`.

**Key takeaway for BN Pools:** Use a modal/dialog library (Radix Dialog, shadcn/ui Dialog) with an imperative open pattern. Return a Promise or callback from the modal so the caller can handle refresh. Pattern: `const result = await openModal(MyModal, options); if (result) { refetchData(); }`. Keep modals dumb — they return data, the caller decides what to do with it.

---

## Multi-Step Workflows & Guided Setup (Phase 3)

### 17. Guided Setup / Onboarding Workflows
Show me any guided setup or onboarding workflows in this app — where a user is walked through configuring something complex step-by-step. How is progress tracked, what prevents skipping required steps, and how does the UI communicate what's done vs. what's pending?

**Answer:**

#### Veteran Welcome Onboarding

The primary onboarding flow is the veteran welcome wizard (`apps/ui-vets/src/app/main/welcome/` and `apps/ui-vets/src/app/main/verification-wizard/`).

Steps (from E2E tests in `apps/ui-vets-e2e/src/e2e/welcome/veteran-welcome-onboarding.cy.ts`):

1. **WelcomeStep** — Landing page, "Get Started" button
2. **PrivacyStep** — Privacy policy acceptance
3. **TurboNumberStep** — Unique identifier assignment
4. **VaAuthStep** — VA authentication connection
5. **SetupOptionsStep** — Configuration choices
6. **DD-214 Upload** — Document upload
7. **Contact Info** — Address, phone, email
8. **Complete** — Success confirmation

#### How Progress is Tracked

The `Wizard<T>` model tracks:
- `currentStepIndex` — which step the user is on
- `steps[i].completed` — whether each step has been completed
- `isComplete` — whether the entire wizard is done
- `data` — accumulated data from all steps

For server-driven workflows, the backend persists `WorkflowExecution` state, so progress survives page refreshes:
```
WorkflowExecution {
  currentStepId: string
  status: 'IN_PROGRESS' | 'COMPLETED'
  data: JSON  // accumulated form data
}
```

#### What Prevents Skipping Steps

1. **Client-side wizard**: Steps only advance when `updateWizard({ currentStepIndex: current + 1 })` is called. There are no skip links — the user must interact with each step's component, which validates before advancing.

2. **Server-driven workflows**: The backend controls step advancement via `WorkflowOperation.Next`. The frontend sends `performOperation(Next)`, the backend validates and either advances or returns an error.

#### UI Communication (done vs. pending)

The `ProgressTimelineComponent` (used in recruit pipelines) shows:
- `isDone` — checkmark, completed styling
- `isCurrent` — highlighted, active styling
- `isSkipped` — greyed out
- `hasWarning` — warning icon

For the wizard, the `WizardStep.completed` flag can drive similar UI.

**Key takeaway for BN Pools (golf stepper):** Create a `Wizard` state object with steps, currentIndex, shared data, and completion flags. Render a progress indicator showing done/current/pending. Validate each step before allowing advancement. For the golf pool setup stepper, each step accumulates pool configuration (course, rules, scoring, invites) and the final step creates the pool.

---

### 18. Entity Lifecycle & Status Transitions
How does this app handle the pattern where an entity (e.g., a recruiting case, application) goes through a lifecycle with distinct phases? How is status tracked, what controls valid transitions, and how does the UI adapt to show phase-appropriate actions?

**Answer:**

#### Recruit Pipeline: The Primary Lifecycle System

```typescript
// libs/recruit/coastguard/src/lib/workflows/pipeline/v1/recruit-pipeline-coast-guard.v1.step-names.ts
export const CoastGuardStepNames = {
  NOT_CONTACTED: 'NOT_CONTACTED',
  NEW_LEAD: 'NEW_LEAD',
  PRESCREEN: 'PRESCREEN',
  INVITE_APPLICANT: 'INVITE_APPLICANT',
  APPLICANT_INFO: 'APPLICANT_INFO',
  MEDICAL_INFO: 'MEDICAL_INFO',
  MEPS_ELECTIONS: 'MEPS_ELECTIONS',
  GENERATE_FORMS: 'GENERATE_FORMS',
  SIGNING_FORMS: 'SIGNING_FORMS',
  MEPS_REQUEST: 'MEPS_REQUEST',
  MEPS_CONFIRMATION: 'MEPS_CONFIRMATION',
  MEPS_PREPARATION: 'MEPS_PREPARATION',
  MEPS_COMPLETE: 'MEPS_COMPLETE',
} as const;
```

#### How Status is Tracked

Each recruit has a `PipelineExecution` that stores:
- Current step name
- Execution history (which steps were completed, timestamps)
- Associated data per step

The pipeline is versioned — `v1`, `v1.1.0` — so recruits started on an older pipeline continue with their original step sequence.

#### What Controls Valid Transitions

Transitions are controlled by the **workflow engine**. Each step defines a `next()` function wired in the factory. Steps are ordered linearly, and advancement requires completing the current step's requirements (form submission, document signing, etc.).

Step-to-subordinate-workflow mapping:
```typescript
// In RecruitStatusBoardComponent
const stepToWorkflowName: Record<string, string> = {
  PRESCREEN: RecruitWorkflowName.RecruitPrescreen,
  APPLICANT_INFO: RecruitWorkflowName.ApplicantQuestionnaire,
  MEDICAL_INFO: RecruitWorkflowName.MedicalQuestionnaire,
};
```

When a recruiter clicks the "next action" for a step, it opens the associated workflow (e.g., the prescreen questionnaire), and completing that workflow advances the pipeline step.

#### How the UI Adapts

The `ProgressTimelineComponent` renders the pipeline as a horizontal timeline with step markers. The `RecruitStatusBoardComponent` shows:
- A `NextActionVariant` card for the current step (driven by `StepConfigService`)
- Phase-appropriate action buttons (e.g., "Send Invite" for INVITE_APPLICANT, "Generate Forms" for GENERATE_FORMS)
- Different layouts depending on pipeline position

For **vets/disability**, case types (`claim`, `appeal`, `form`) have their own detail components that show type-appropriate workflows and actions.

**Key takeaway for BN Pools:** Define your entity lifecycle as named steps/statuses in an enum. Store current status in the database. Define valid transitions (even if they're linear). Show status-appropriate actions in the UI — a pool in "DRAFT" shows "Configure" and "Publish", a pool in "ACTIVE" shows "View Picks" and "Leaderboard", a pool in "COMPLETED" shows "Results". Use a `StepConfig` mapping from status to UI configuration.

---

## Real-time & Collaborative Features

### 19. Real-time Updates
Does this app have any real-time or near-real-time features — live updates, notifications, or collaborative editing? If so, what technology powers it (WebSockets, polling, SSE) and how is it integrated into the component architecture?

**Answer:**

#### Technology: GraphQL Subscriptions over WebSocket (graphql-ws), backed by Redis Pub/Sub

**Backend setup:**
```typescript
// libs/websockets/src/lib/websockets.module.ts
@Global()
@Module({
  providers: [{
    provide: 'WEBSOCKET',
    useFactory: (configService) => {
      return new RedisPubSub({
        publisher: new Redis(config),
        subscriber: new Redis(config),
      });
    },
  }],
})
export class WebsocketsModule {}
```

**Frontend setup** (Apollo Client split link):
```typescript
// apps/ui-vets/src/app/app.config.ts
const transportLink = split(
  ({ query }) => definition.operation === OperationTypeNode.SUBSCRIPTION,
  ws,   // WebSocket link for subscriptions
  http  // HTTP link for queries/mutations
);
```

#### Real-Time Features:

1. **Notification count badge** — live unread count pushed to all clients:
```typescript
// libs/ui/common/src/lib/services/notifications/notifications-consumer.service.ts
subscription NotificationCountUpdated {
  notificationCountUpdated  // Returns number
}
```

2. **Entity-level live updates** — when a client/recruit record changes, all viewers are notified:
```typescript
// Client detail subscribes to changes
this.clientConsumerService.subscribeToClientUpdates(uuid).pipe(
  takeUntil(this.destroy$),
  switchMap(() => this.loadClient(uuid, true))  // Re-fetch on any update
).subscribe();
```

3. **Workflow step updates** — when a workflow advances (e.g., applicant completes a questionnaire), the recruiter's view updates live.

4. **DocuSign envelope updates** — when a recruit signs documents, the status updates in real-time:
```typescript
this.recruitService.subscribeToEnvelopeUpdates(uuid).pipe(
  switchMap(() => this.recruitService.getRecruit(uuid)),
  tap((recruit) => this.recruitDetailState.setRecruit(recruit))
);
```

5. **AI voice calls** — Retell AI WebSocket client for live call interaction (recruit only):
```
libs/integrations/connectors/retell/src/websocket/retell-websocket.types.ts
```

#### Integration Pattern

Components subscribe to GraphQL subscriptions in `ngOnInit` with `takeUntil(this.destroy$)` for cleanup. The subscription triggers a refetch of the relevant data (not a direct state update from the subscription payload). This ensures data consistency — the subscription is just a "something changed" signal.

**Key takeaway for BN Pools:** Use Supabase Realtime (Postgres changes + Broadcast) as your equivalent. Subscribe to table changes for live leaderboard updates, pick confirmations, and deadline notifications. The pattern is: subscribe to a "data changed" event → refetch via React Query `invalidateQueries()`. Don't try to reconstruct state from the event payload — just use it as an invalidation signal.

---

### 20. Notification System
How does this app handle notifications or alerts to users? Is there an in-app notification system, email notifications, or both? Show me the architecture — how are notifications generated, stored, and delivered.

**Answer:**

#### Full-Stack Architecture:

```
Domain Service triggers notification
  ↓
NotificationTriggerService.trigger(type, params)
  ↓
NotificationConfigRegistry looks up config for this type
  ↓
NotificationsAPIService sends enriched message to AWS SQS
  ↓
notification-handler app (SQS consumer, no HTTP server)
  ↓ (parallel)
├── Writes Notification entity to PostgreSQL (in-app)
├── Sends email via AWS SES
└── Sends push notification via Firebase FCM
```

#### Notification Entity:
```typescript
// libs/notifications/src/lib/notification.entity.ts
@Entity({ name: 'notifications' })
export class Notification extends CoreEntity {
  type: string;               // e.g. "task_assigned"
  entityType: string;         // e.g. "task", "recruit"
  entityId: string;           // UUID of related entity
  status: NotificationStatus; // UNREAD | READ
  unreadEventCount: number;
  firstUnreadDate: Date;
  lastUnreadDate: Date;
  userId: string;
  subject?: string;
  body?: string;
  endpoint?: string;          // deep-link URL
  workflowNotificationContent?: WorkflowNotificationContent;
}
```

#### Domain-Specific Notification Configs:

Each domain registers its own notification types:
```typescript
// libs/recruit/src/lib/recruit-notification-configs.ts
// 30+ types: applicant_invited, medical_questionnaire_completed,
//            recruit_transferred, prescreen_completed, etc.

// libs/tasks/src/lib/task-notification-configs.ts
// libs/messages/src/lib/message-notification-configs.ts
// libs/vets/poa/src/lib/poa-notification-configs.ts
```

Registration happens at module boot:
```typescript
NotificationsModule.forFeature([
  { type: 'recruit_transferred', ... },
  { type: 'applicant_invited', ... },
])
```

#### Frontend Notification State:

```typescript
// libs/ui/common/src/lib/services/notifications/notifications-state.service.ts
@Injectable({ providedIn: 'root' })
export class NotificationsStateService {
  private readonly notificationsById = signal<Record<string, InAppNotification>>({});
  private readonly orderedUuids = signal<string[]>([]);
  private readonly totalUnread = signal<number>(0);

  // Derived views
  public readonly allNotifications = computed(() =>
    this.orderedUuids().map(id => this.notificationsById()[id]).filter(Boolean)
  );
  public readonly recentNotifications = computed(() =>
    this.allNotifications().slice().sort(this.sortUnreadFirst).slice(0, 10)
  );
}
```

#### Frontend Components:
- `NotificationsDropdownComponent` — bell icon in navbar, shows unread count badge
- `NotificationsItemComponent` — individual notification row
- `NotificationsPageComponent` — full paginated notifications list
- `NotificationPreferencesComponent` — user opt-in/out settings

Live count is pushed via GraphQL subscription (`notificationCountUpdated`).

**Key takeaway for BN Pools:** Use Supabase Edge Functions or a simple API route to trigger notifications. Store notifications in a `notifications` table with `type`, `entity_type`, `entity_id`, `user_id`, `status` (UNREAD/READ), `body`. Use Supabase Realtime to push count updates. For email, use Resend or SendGrid. The config registry pattern (each domain registers its notification types) keeps things organized as you add more pool types.

---

## DevOps & Environment (Phase 7)

### 21. Docker Local Dev Setup
Walk me through the Docker setup for local development. What services run in containers, how is the database seeded with test data, and what does the developer experience look like from `git clone` to running app?

**Answer:**

#### docker-compose.yml Services:

| Service | Port | Purpose |
|---|---|---|
| `postgres` | 5432 | PostgreSQL 14 with pgvector. **6 databases**: turbo, turbovets, turborecruit, turboactiveduty, turbonumber, docuseal |
| `redis` | 6379 | Redis 7 with TLS. Caching + pub/sub |
| `nginx` | 443 | SSL termination, proxies all backends and UIs |
| `localstack` | 4566 | Emulates AWS: IAM, Lambda, S3, SES, SNS, SQS |
| `backend-vets` | 3000 | NestJS backend |
| `backend-recruit` | 3000 | NestJS backend |
| `backend-active-duty` | 3000 | NestJS backend |
| `turbonumber` | 3001 | Phone number assignment |
| `calls-service` | 3010 | AI voice calls (Retell) |
| `notification-handler` | — | SQS consumer, no HTTP |
| `ui-vets` | 4000 | Angular SSR |
| `ui-recruit` | 4000 | Angular SSR |
| `ui-active-duty` | 4000 | Angular SSR |
| `text-embeddings` | 8090 | HuggingFace BAAI/bge (optional `huggingface` profile) |

#### Docker Compose Profiles

Profiles control which services run:
- `preamble` — base image builds
- `product-line-vets` — vets backend + UI + deps
- `product-line-recruit` — recruit backend + UI + deps
- `product-line-active-duty` — active-duty backend + UI + deps
- `product-line-all` — everything
- `ci` — CI-specific configuration

#### Database Seeding

Each product-line backend has a matching `-seed` service:
```yaml
backend-vets-seed:
  command: npx nx run backend-vets:seed
  # Runs seed scripts, then exits
```

Seed data includes default org roles, test users, feature flags, and sample data for development.

#### Multi-Instance Support

The `INSTANCE_ID` environment variable offsets all ports by `N * 100`, enabling multiple developers (or worktrees) to run full stacks simultaneously without port conflicts. See `docs/ai/multi-instance.md` for details.

#### Dockerfile (multi-stage build):

```dockerfile
# Stage 1: build
FROM node:18 AS build_app
COPY . .
RUN npx nx run ${SERVICE_NAME}:build:production

# Stage 2: production
FROM node:18-slim AS prod_app
COPY --from=build_app /app/dist /app/dist
# + config files, release notes
```

FIPS-compliant base images available via `Dockerfile.base.fips`.

#### Developer Experience:

```bash
git clone <repo>
cp .env.example .env     # Configure local env
docker compose --profile product-line-vets up -d  # Start vets stack
# Wait for seed to complete
npm start                 # Or: npx nx serve ui-vets
```

**Key takeaway for BN Pools:** Your setup is simpler (one product line), but the pattern is similar. Docker Compose with postgres + your app. Use profiles if you want optional services. Seed scripts run automatically on first start. Consider Supabase CLI (`supabase start`) which gives you Postgres + Auth + Realtime + Storage + Edge Functions in one command — much simpler than managing individual containers.

---

### 22. CI/CD Pipeline
Show me the CI/CD pipeline configuration. What runs on PR (lint, test, build, deploy preview)? What runs on merge to main? How are database migrations handled in the pipeline?

**Answer:**

#### On PR:

| Workflow | What It Does |
|---|---|
| `unit-test.yml` | Uses `nx show projects --affected` to find changed projects, groups them into a matrix, runs Jest tests in parallel |
| `e2e-pr.yml` | Runs Cypress E2E tests |
| `graphql-schema-check.yml` | Detects GraphQL schema drift |
| `graphql-inspector.yml` | Schema inspection |
| `claude-auto-review.yml` | AI-powered PR review (excludes Dependabot PRs) |
| Lint/format | Part of affected project checks |

#### On Merge to Main (`cd.yml`):

```
get-app-version
  ↓
set-environment-details (determine image tag)
  ↓
build-lint-format (parallel: build, lint, format check)
build-test-push-app-images → base images → per-service Docker builds
  + container-structure-tests + push to GHCR
unit-tests (affected projects matrix)
  ↓
migrate-dev-databases (vets, recruit, active-duty in parallel)
  ↓
deploy-dev → ECS update
  ↓
e2e tests (Cypress)
  ↓
migrate-uat-databases
  ↓
deploy-uat
  ↓
uat-smoke-tests
  ↓
update-latest-git-tag + retag-to-latest
  ↓
send-slack-notification (on failure only)
```

#### Database Migrations:

Migrations are TypeORM migration files. In the pipeline:
- `migrate-dev-databases` job runs migrations against dev databases (all 3 product lines in parallel)
- `migrate-uat-databases` runs after dev deployment succeeds
- Migrations are generated locally with `nx run backend-vets:migrations:generate`

#### Other Workflows:
- `scan-images.yml` — container security scanning
- `generate-sbom.yml` — software bill of materials
- `create-release-tag.yml` — release tagging (format: `YYYY.MM.N`)
- `promote-prerelease-to-stable.yml` — promote pre-releases
- `deploy-version-to-env.yml` — reusable deployment to any environment

**Key takeaway for BN Pools:** For a simpler app, a basic pipeline is: PR → lint + typecheck + test → merge to main → build → deploy. Use Vercel for hosting (automatic preview deploys on PR). Supabase migrations run via `supabase db push` or `supabase migration up`. GitHub Actions for tests + Vercel for deploys is the simplest CI/CD setup.

---

### 23. Multi-Environment Management
How does this app manage multiple environments (dev, staging, production)? How are environment-specific configs managed, and what's the promotion flow for getting changes from dev to production?

**Answer:**

#### Environment Config Sources:

1. **`.env` file** (gitignored) — local development secrets
2. **Docker environment blocks** — per-service secrets (`JWT_ACCESS_TOKEN_SECRET`, `FIELD_ENCRYPTION_KEY`, etc.)
3. **`config/product-lines/` YAML configs** — product-line-specific configuration, copied into container images
4. **`PRODUCT_LINE` env var** — selects which product-line config to load at runtime
5. **`INSTANCE_SUB_TYPE` var** — for recruit variants (coastguard, army, etc.)

#### Promotion Flow:

```
Developer branch → PR → merge to main
  ↓
main → auto-deploy to DEV (with migrations)
  ↓
DEV passes E2E tests → auto-deploy to UAT
  ↓
UAT passes smoke tests → tagged as release (YYYY.MM.N)
  ↓
Manual promotion → PRODUCTION (via deploy-version-to-env.yml)
```

Image tags follow `YYYY.MM.N` format for releases. The `promote-prerelease-to-stable.yml` workflow handles promoting a pre-release tag to stable.

#### Infrastructure:

All environments run on **AWS ECS** (Elastic Container Service). Deployments update ECS task definitions with new container image tags.

**Key takeaway for BN Pools:** Use Vercel's built-in environments: `development` (local), `preview` (PR branches), `production` (main branch). Environment variables are managed per-environment in the Vercel dashboard. Supabase has separate projects for staging vs. production. The promotion flow is simply: merge PR to main → Vercel auto-deploys to production.

---

## Testing Patterns

### 24. Testing Strategy & Examples
What testing patterns does this app use? Show me examples of unit tests for business logic, component tests for UI, and any integration/e2e tests. What's the test coverage strategy — what gets tested and what doesn't?

**Answer:**

#### Unit Tests (Jest) — colocated with source files

**Backend test pattern** (NestJS):
```typescript
// Uses Test.createTestingModule with provider overrides
const module = await Test.createTestingModule({
  providers: [MyService, { provide: MyRepository, useValue: mockRepository }],
}).compile();
const service = module.get<MyService>(MyService);
```

**Infrastructure stubs** (`libs/testing/src/lib/apply-infra-stubs.ts`):
```typescript
export function applyInfraStubs(builder: TestingModuleBuilder): TestingModuleBuilder {
  return builder
    .overrideProvider(getDataSourceToken()).useValue(stubDataSource)
    .overrideProvider(CACHE_MANAGER).useValue(mockCache);
}
```

Other stubs available:
- `pub-sub.stub.ts` — no-op Redis PubSub for subscription tests
- `bull-queue.stub.ts` — BullMQ job queue stubs
- `firebase.stub.ts` — Firebase FCM push notification stubs
- `logingov-strategy.stub.ts`, `microsoft-strategy.stub.ts` — OAuth stubs
- `data-source.stub.ts` — minimal TypeORM DataSource stub

**Frontend component test pattern** (Angular):
```typescript
// Uses TestBed with standalone components
await TestBed.configureTestingModule({
  imports: [MyComponent],
  providers: [provideHttpClient(), { provide: MyService, useValue: mockService }],
}).compileComponents();
const fixture = TestBed.createComponent(MyComponent);
```

#### E2E Tests (Cypress) — in `apps/ui-*-e2e/`

```typescript
// apps/ui-vets-e2e/src/e2e/welcome/veteran-welcome-onboarding.cy.ts
describe('Veteran Welcome Onboarding', () => {
  withDbReset();          // Reset DB to clean state
  withLogin('veteran');   // Login as a veteran user

  it('completes veteran onboarding with DD-214 upload', () => {
    cy.intercept('POST', '**/google.maps.places**/GetPlace').as('getPlaceDetails');
    cy.get('[data-testid="WorkflowFooter-continueButton"]').click();
    cy.wait('@getPlaceDetails');
  });
});
```

Key E2E patterns:
- `withDbReset()` — utility to reset database to a known state
- `withLogin(role)` — login as a specific user role
- `data-testid` attributes for element selection (not CSS classes)
- `cy.intercept()` for waiting on async API calls

#### Test Coverage Strategy:

- **Guards and authorization** — tested (see question 25)
- **Service/provider business logic** — tested with mocked dependencies
- **Notification config registry** — tested with no mocks (pure service)
- **Critical user flows** — E2E tested (onboarding, workflows)
- **CI runs affected tests only** — `nx show projects --affected` determines what to test

**Key takeaway for BN Pools:** Use Vitest for unit tests (faster than Jest for Next.js). Use Playwright for E2E tests. Test business logic in isolation with mocked deps. Test critical user flows E2E (pool creation, pick submission, leaderboard). Use `data-testid` attributes for reliable element selection. Don't test implementation details — test behavior.

---

### 25. Permission Testing
How does this app test permission/authorization logic? Are there tests that verify 'user with role X can do Y but not Z'? Show me the pattern for testing role-based access.

**Answer:**

#### Guard Testing Pattern:

```typescript
// libs/organization/src/lib/guards/organization-license.guard.spec.ts
describe('OrganizationLicenseGuard', () => {
  // Setup: mock execution context, mock providers
  beforeEach(() => {
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue(mockGqlContext);
  });

  it('should pass when no user (public route)', async () => {
    mockGqlContext.getContext.mockReturnValue({ req: { user: null } });
    expect(await guard.canActivate(mockContext)).toBe(true);
  });

  it('should bypass license check for ISA Admin', async () => {
    const admin = UserFixture.createAdmin();
    mockGqlContext.getContext.mockReturnValue({ req: { user: admin } });
    expect(await guard.canActivate(mockContext)).toBe(true);
    // Verify license service was NOT called
  });

  it('should throw UnauthorizedException for expired license', async () => {
    const agent = UserFixture.createAgent();
    mockGqlContext.getContext.mockReturnValue({ req: { user: agent } });
    mockLicenseService.isValid.mockResolvedValue(false);
    await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
  });

  it('should pass when @SkipOrgLicenseCheck is present', async () => {
    mockReflector.get.mockReturnValue(true); // decorator present
    expect(await guard.canActivate(mockContext)).toBe(true);
  });
});
```

#### UserFixture — canonical test helper for creating users with specific roles:

```typescript
// libs/auth/src/lib/fixtures/user.fixture.ts
export class UserFixture {
  static create(overrides: Partial<User> = {}): User     // Base user
  static createVeteran(overrides?): User                  // UserContextType.Client
  static createClient(overrides?): User                   // UserContextType.Client
  static createAgent(overrides?): User                    // UserContextType.Agent
  static createAdmin(overrides?): User                    // UserContextType.Admin
}

// Usage:
const admin = UserFixture.createAdmin();
const agent = UserFixture.createAgent({ orgRole: { adminLevel: AdminLevel.NONE } });
```

#### Testing Approach:

1. **Create mock execution context** with `GqlExecutionContext.create` spy
2. **Create user with specific role** using `UserFixture`
3. **Mock provider responses** (license validity, org membership, etc.)
4. **Assert guard outcome** — `true` (allowed), `throw ForbiddenException` (denied), or redirect

The tests verify scenarios like:
- No user → pass through (public route)
- ISA Admin → bypass all checks
- TurboVets org member → bypass license check
- Valid license → pass
- Invalid license → `UnauthorizedException` with `ERRORS.LICENSE_EXPIRED.message`
- `@SkipOrgLicenseCheck` decorator → bypass

**Key takeaway for BN Pools:** Create a `UserFactory` helper that generates test users with specific roles (`createAdmin()`, `createCommissioner()`, `createMember()`). Test your middleware/guards with: (1) unauthenticated request → reject, (2) wrong role → reject, (3) correct role → allow, (4) edge cases (expired, suspended). For Supabase RLS, test by creating Supabase clients authenticated as different users and verifying they can/can't access specific rows.
