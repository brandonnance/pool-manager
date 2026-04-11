# UI Patterns

Conventions for forms, loading states, errors, slugs, and shadcn usage across BN Pools.

---

## Forms — React Hook Form + Zod

All forms must use **React Hook Form** (RHF) with a **Zod** resolver. Raw `useState` per field is not allowed for new forms.

### The rule

1. **Schema in `lib/form-schemas.ts`** — one Zod schema per form, plus an inferred `type FormValues = z.infer<typeof schema>`.
2. **Wire the schema** with `useForm<Values>({ resolver: zodResolver(schema), defaultValues: ... })`.
3. **Render fields** with shadcn `<Form>` + `<FormField>` + `<FormItem>` + `<FormControl>` + `<FormMessage>`. Never render bare `<Input>` wired to `field` without the surrounding `<FormField>` — you lose field-level error messages.
4. **Submit** via `form.handleSubmit(onSubmit)`. The async `onSubmit(values)` handler does the work; do NOT do additional `e.preventDefault()` / `setIsLoading` boilerplate.
5. **Loading state** from `form.formState.isSubmitting`, not a separate `isLoading` useState.
6. **Reset on dialog close** with `form.reset(DEFAULTS)` inside `onOpenChange`.

### Minimal template

```tsx
const FORM_DEFAULTS: FormValues = { ... }

const form = useForm<FormValues>({
  resolver: zodResolver(schema),
  defaultValues: FORM_DEFAULTS,
})

const onSubmit = async (values: FormValues) => {
  setError(null)
  const { error } = await supabase.from('...').insert({ ... })
  if (error) { setError(error.message); return }
  form.reset(FORM_DEFAULTS)
  setOpen(false)
  router.refresh()
}

return (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={form.control}
        name="fieldName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Label</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Saving...' : 'Save'}
      </Button>
    </form>
  </Form>
)
```

### Field-level vs. form-level errors

- **Field-level** (Zod validation): rendered by `<FormMessage />` inside the `<FormField>`. Always use these for anything the user can fix by changing input.
- **Form-level** (server errors, auth failures, constraint violations): local `useState<string | null>(null)` rendered in an `<Alert variant="destructive">` at the top or bottom of the form.

Never surface a server error through `form.setError('root', ...)` unless you intend to clear it on the next keystroke — that's usually not what you want for things like "slug already taken" where you want the user to change the slug field specifically. In that case, set it on the field: `form.setError('publicSlug', { message: '...' })`.

### Conditional fields

Use `form.watch('fieldName')` to derive visibility or styling. `watch()` triggers a React Compiler warning (`Compilation Skipped: Use of incompatible library`) — this is a known, acceptable trade-off. Do not try to memoize around it.

For a handful of fields, destructure at the top:
```tsx
const poolType = form.watch('poolType')
const squaresEventType = form.watch('squaresEventType')
```

### Zod schema guidance

- **Required strings**: `z.string().min(1, 'Field is required').trim()`.
- **Optional strings**: `z.string().trim().optional().or(z.literal(''))` — the `.or(z.literal(''))` lets empty strings pass validation when the user clears the field.
- **Numeric strings** (HTML `<input type="number">` always returns string): validate with `.refine((val) => !isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 0)`. Parse inside `onSubmit`.
- **Cross-field validation**: use `.refine(data => ..., { path: ['fieldName'] })` or `.superRefine((data, ctx) => ctx.addIssue({ path: ['fieldName'], message: '...' }))` when you need multiple issues or conditional paths.
- **Enums**: `z.enum(['a', 'b', 'c'])` — the inferred type will be a discriminated union.

### What NOT to do

- ❌ Don't use `useState` for individual form fields.
- ❌ Don't set `disabled` on the submit button based on `!name.trim()` — Zod handles required validation.
- ❌ Don't call `e.preventDefault()` manually — `form.handleSubmit()` does it.
- ❌ Don't use `form.setError('root', ...)` for server errors (prefer local useState + Alert).
- ❌ Don't compute time/date values like `Date.now()` at the top of the component body — the React Compiler purity lint rule will flag it. Extract into a helper function above the component.

---

## Slug Validation (Phase 4D utilities)

Shared slug helpers live in `lib/slug.ts`. Consumers should NOT re-implement regex matching or availability checks.

### Rules

- Slug format: lowercase letters, numbers, hyphens. Min 3 chars.
- URL prefix is per pool-type (`/view/`, `/view/mm/`, `/pools/golf/`). The slug *column* is on the type-specific table (`sq_pools.public_slug`, `mm_pools.public_slug`, etc.) — do NOT centralize it on `pools`.

### API

```ts
import {
  formatSlugInput,       // normalizes input → lowercase, strips invalid chars
  validateSlugFormat,    // returns error string | null
  generateSlugFromName,  // derives a slug from a pool name
  checkSlugAvailability, // async, returns boolean
} from '@/lib/slug'
```

### Pattern in a form

```tsx
// 1. Auto-generate on name change (optional UX nicety)
useEffect(() => {
  if (name) form.setValue('publicSlug', generateSlugFromName(name), { shouldValidate: true })
}, [name])

// 2. Debounced availability check (non-schema, runs as a side effect)
useEffect(() => {
  if (!publicSlug || slugError) { setSlugAvailable(null); return }
  const t = setTimeout(() => {
    checkSlugAvailability(publicSlug, 'sq_pools').then(setSlugAvailable)
  }, 500)
  return () => clearTimeout(t)
}, [publicSlug, slugError])

// 3. Block submit when taken
<Button disabled={form.formState.isSubmitting || slugAvailable === false || checkingSlug}>
```

Format validation belongs in the Zod schema; uniqueness is a database-facing check and stays as a side effect.

---

## Loading States

- **Page / section loading**: shadcn `<Skeleton />`. Match the shape of the content it's replacing (row count = page size for tables).
- **Inline loading** (buttons, etc.): conditional button label ("Saving..." / "Save"). Prefer `form.formState.isSubmitting` over a separate `useState`.
- **Optimistic state for long operations**: for now, just show loading text. Optimistic-update patterns via React Query are a later add.

---

## Error Handling

| Error type | Where it shows | How |
|------------|----------------|-----|
| Field validation | Below field | `<FormMessage />` from Zod |
| Server error (one form) | Top/bottom of form | `<Alert variant="destructive">` |
| Server error (page-level) | Sonner toast | `toast.error('...')` |
| Confirmation feedback | Sonner toast | `toast.success('...')` |

Never use `window.alert()` or browser confirm dialogs. For destructive confirms, use shadcn `<AlertDialog>`.

---

## shadcn Component Usage

Preferred components and what they replace:

| Use this | For |
|----------|-----|
| `<Form>`, `<FormField>`, `<FormItem>`, `<FormControl>`, `<FormMessage>` | All forms (never bare `<Input value={} onChange={} />`) |
| `<Dialog>` | Modals (create, edit, confirm with custom content) |
| `<AlertDialog>` | Destructive confirms ("Delete pool?") |
| `<DataTable>` (from `ui/data-table.tsx`) | Any sortable/searchable/paginated table. Built on TanStack Table. |
| `<Breadcrumb>` | Page hierarchy navigation — replaces custom `<Link>` chains. |
| `<Accordion>` | Collapsible sections (golf standings, pool settings). |
| `<Command>` | Search/autocomplete (team selector, golfer search). |
| `<Sonner>` (`toast` from `sonner`) | Top-level notifications. |
| `<Skeleton>` | Loading placeholders. |

### DataTable conventions

- Column defs live in a Client Component wrapper; page passes data to the wrapper as a prop.
- Pass `mobileCard` prop to render a card view on narrow screens.
- Don't rebuild table markup by hand. If you find yourself writing `<table><thead>...` in a new component, stop and use `<DataTable>`.

---

## Migration Checklist (for converting old forms)

When converting an old `useState`-based form:

1. Add/extend the Zod schema in `lib/form-schemas.ts`.
2. Replace individual `useState` hooks with one `useForm` call.
3. Wrap the markup with `<Form {...form}>` and each field with `<FormField>`.
4. Replace `handleSubmit` signature: `async (e) => { e.preventDefault(); ... }` → `async (values: FormValues) => { ... }`.
5. Wire submit via `form.handleSubmit(onSubmit)`.
6. Delete `isLoading` useState — use `form.formState.isSubmitting`.
7. Keep a single `error` useState for server errors; render in `<Alert>`.
8. Reset the form on dialog close: `form.reset(DEFAULTS)`.
9. Run `npx tsc -p tsconfig.json --noEmit` and `npx eslint <file>` — expect 0 errors; `watch()` warnings are acceptable.
