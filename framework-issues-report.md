# Open Mercato Framework — Issues & Improvement Proposals

Report generated from [comerito/om-hackathon-starter](https://github.com/comerito/om-hackathon-starter) issues.
Date: 2026-03-25

---

## Table of Contents

1. [#2 — Wrong icons for admin side menu](#issue-2)
2. [#3 — Wrong link to backend pages](#issue-3)
3. [#4 — Command handler not registered](#issue-4)
4. [#5 — QueryProvider not set in backend pages](#issue-5)
5. [#6 — DataTable not showing all data](#issue-6)
6. [#7 — Portal sidebar has wrong links](#issue-7)
7. [#8 — Portal sidebar duplicates](#issue-8)
8. [AI Guide Gaps — Missing Documentation](#ai-guide-gaps)

---

<a id="issue-2"></a>
## Issue #2 — Wrong icons for admin side menu

**Status:** OPEN
**Severity:** Medium (visual bug)

### Description

After running `yarn generate`, the admin sidebar displays wrong/broken icons for modules. The module's `page.meta.ts` defines icons via inline `React.createElement('svg', ...)`, but the generated code doesn't handle icon serialization correctly — the icon ReactNode is embedded as a JS expression in the generated module registry, which can break during import/evaluation.

### Root Cause Analysis

The module registry generator (`@open-mercato/cli/src/lib/generators/module-registry.ts`) reads `page.meta.ts` metadata and embeds it as-is in the generated `modules.generated.ts`. The `icon` field is a `ReactNode` (JSX), which must be importable from the meta module. The generator correctly imports the metadata module:

```typescript
// Generated code pattern
import * as BM_competitions_index from '@app/modules/competitions/backend/page.meta'
// ...uses (BM_competitions_index.metadata as any).icon
```

However, the issue arises when:
1. Icons are defined using `React.createElement` in `.meta.ts` files, which may fail in certain bundler contexts
2. There's no type-safe validation that the icon is a valid React component
3. No fallback icon is provided when an icon fails to render

### Proposed Framework Changes

#### Core Code Fix (`@open-mercato/ui`)

**File: `packages/ui/src/backend/AppShell.tsx`** — Add fallback icon rendering:

```typescript
// When rendering sidebar icons, wrap in error boundary or provide fallback
function SidebarIcon({ icon }: { icon?: ReactNode }) {
  if (!icon) return <DefaultModuleIcon />
  try {
    return <>{icon}</>
  } catch {
    return <DefaultModuleIcon />
  }
}
```

**File: `packages/ui/src/backend/utils/nav.ts`** — Validate icon at build time:

Add a runtime check that icons are valid ReactNodes when building nav groups, and log a warning if an icon is invalid.

#### Core Code Fix (`@open-mercato/cli`)

**File: `packages/cli/src/lib/generators/module-registry.ts`** — Add icon validation:

During generation, validate that `page.meta.ts` exports a valid `icon` field. If the export is `undefined` or throws, emit a warning and use `undefined` so the UI can show a fallback.

#### AI Guide Improvement

**File: `.ai/guides/core.md`** — Add icon documentation section:

```markdown
### Module Icons

Backend sidebar icons are defined in `page.meta.ts`:

// RECOMMENDED: Import from lucide-react
import { Trophy } from 'lucide-react'
export const metadata = {
  icon: <Trophy className="size-4" />,
}

// AVOID: React.createElement for SVGs (fragile in bundler contexts)
```

**File: `.ai/skills/module-scaffold/SKILL.md`** — Update scaffold template to use lucide-react icons instead of inline SVG `React.createElement`.

---

<a id="issue-3"></a>
## Issue #3 — Wrong link to backend pages

**Status:** OPEN
**Severity:** High (broken navigation)

### Description

Backend page links are generated with a double module name in the URL path. Example:
- Generated: `/backend/competitions/competitions/create` (404)
- Expected: `/backend/competitions/create`

### Root Cause Analysis

The module registry generator at `packages/cli/src/lib/generators/module-registry.ts:78-80` has two route path construction strategies:

**New-style pages** (`page.tsx`):
```typescript
const routePath = type === 'frontend'
  ? '/' + (segs.join('/') || '')
  : '/backend/' + (segs.join('/') || modId)
```

Where `segs` are the directory segments relative to the `backend/` folder. For `backend/competitions/create/page.tsx`, segs = `['competitions', 'create']`, giving `/backend/competitions/create` — **correct**.

**Old-style pages** (direct `.tsx` files like `backend/competitions/create.tsx`):
```typescript
: '/backend/' + [modId, ...segs, name].filter(Boolean).join('/')
```

This always prepends `modId`, so `backend/competitions/create.tsx` would give `/backend/competitions/competitions/create` — **incorrect** when the file is already inside a `competitions/` subdirectory.

The issue also manifests when AI agents or developers create links programmatically using patterns like:
```typescript
href={`/backend/${moduleId}/${subpath}`}
```
...when the actual route pattern doesn't include the module ID prefix for subpages.

### Proposed Framework Changes

#### Core Code Fix (`@open-mercato/cli`)

**File: `packages/cli/src/lib/generators/module-registry.ts`** — Fix old-style route path construction:

```typescript
// Old approach (line 113):
: '/backend/' + [modId, ...segs, name].filter(Boolean).join('/')

// Fixed approach — only prepend modId if segs don't already start with it:
: '/backend/' + (segs[0] === modId
    ? [...segs, name].filter(Boolean).join('/')
    : [modId, ...segs, name].filter(Boolean).join('/'))
```

Alternatively, the more robust fix is to make the old-style path construction consistent with the new-style:

```typescript
const routeSegsPath = routeSegs.join('/')
const routePath = type === 'frontend'
  ? '/' + (routeSegsPath || '')
  : '/backend/' + (routeSegsPath || modId)
```

#### Core Code Fix (`@open-mercato/shared`)

Add a `buildBackendLink(moduleId, subpath)` utility function that constructs correct backend URLs, preventing manual string concatenation errors:

```typescript
// packages/shared/src/modules/navigation/links.ts
export function buildBackendLink(path: string): string {
  return `/backend/${path.replace(/^\//, '')}`
}
```

#### AI Guide Improvement

**File: `.ai/guides/core.md`** — Add backend URL construction guidance:

```markdown
### Backend Page URLs

Backend page URLs follow this pattern:
- Root page: `/backend/<module_id>` (from `backend/page.tsx`)
- Subpages: `/backend/<relative_path>` (from `backend/<path>/page.tsx`)

The `<relative_path>` is the directory path relative to the module's `backend/` folder.

Example for module `competitions`:
- `backend/page.tsx` → `/backend/competitions`
- `backend/competitions/create/page.tsx` → `/backend/competitions/create`
- `backend/competitions/[id]/edit/page.tsx` → `/backend/competitions/[id]/edit`

**IMPORTANT**: Do NOT construct links as `/backend/${moduleId}/${subpath}`. The subpath
already includes the module directory structure. Use the pattern from `page.meta.ts` routes.
```

---

<a id="issue-4"></a>
## Issue #4 — Command handler not registered

**Status:** OPEN
**Severity:** Critical (blocks all CRUD operations)

### Description

Creating entities fails with: `Command handler not registered for id competitions.competition.create`

The command handler was registered with ID `competitions.competitions.create` (plural entity), but the framework's CRUD route dispatches to `competitions.competition.create` (singular entity).

### Root Cause Analysis

There are **two separate problems** that both led to this issue:

**Problem A — Naming Convention Ambiguity:**

The CRUD factory and cache system in `@open-mercato/shared/src/lib/crud/cache.ts:113-142` includes a `singularizeSegment()` function that converts resource names from plural to singular. When the framework auto-derives command IDs from API routes, it singularizes the entity segment. So an API at `/api/competitions/competitions` dispatches to command ID `competitions.competition.create` (singular).

But the AGENTS.md and AI guides document the command ID convention as `module.entity.action` with "singular entity, past tense" for *events*, but don't explicitly clarify the convention for *command IDs*.

The developer registered the command as `competitions.competitions.create` (plural) while the framework expected `competitions.competition.create` (singular).

**Problem B — Command file not imported:**

Even with the correct ID, command handlers must be imported (side-effect import) in the module's `index.ts` to register at boot time. The issue comments confirm that initially the import was missing:

```typescript
// Fixed index.ts
import './commands/competitions'  // Side-effect import triggers registerCommand()
```

### Proposed Framework Changes

#### Core Code Fix (`@open-mercato/shared`)

**File: `packages/shared/src/lib/commands/command-bus.ts`** — Improve the error message to help diagnose mismatches:

```typescript
private resolveHandler<TInput, TResult>(commandId: string): CommandHandler<TInput, TResult> {
  const handler = commandRegistry.get<TInput, TResult>(commandId)
  if (!handler) {
    // List similar registered handlers to help debug
    const registered = commandRegistry.listAll()
    const similar = registered.filter(id =>
      id.split('.')[0] === commandId.split('.')[0]
    )
    const hint = similar.length > 0
      ? ` Registered commands for this module: [${similar.join(', ')}]`
      : ` No commands registered for module "${commandId.split('.')[0]}".`
      + ' Ensure the command file is imported (side-effect) in the module index.ts.'
    throw new Error(`Command handler not registered for id ${commandId}.${hint}`)
  }
  return handler
}
```

**File: `packages/shared/src/lib/commands/index.ts`** — Add a validation helper:

```typescript
export function registerCommand<TInput, TResult>(handler: CommandHandler<TInput, TResult>) {
  // Validate command ID format: module.entity.action (all singular for entity)
  const parts = handler.id.split('.')
  if (parts.length < 3) {
    console.warn(`[commands] Command ID "${handler.id}" should follow format "module.entity.action"`)
  }
  commandRegistry.set(handler.id, handler)
}
```

#### Core Code Fix (`@open-mercato/cli`)

**File: Generator** — During `yarn generate`, validate that all modules with command files have corresponding side-effect imports in `index.ts`. Emit a warning if a `commands/*.ts` file exists but isn't imported.

#### AI Guide Improvement

**File: `.ai/guides/core.md`** — Add explicit command handler documentation:

```markdown
### Command Handlers

Command IDs use the format: `<module_id>.<entity_singular>.<action>`

- Module ID: plural (`competitions`)
- Entity: **singular** (`competition`, NOT `competitions`)
- Action: verb (`create`, `update`, `delete`, `advance_stage`)

Examples:
- `competitions.competition.create`
- `sales.order.update`
- `customers.person.delete`

**CRITICAL**: Command files MUST be imported in the module's `index.ts`:

```typescript
// index.ts
import './commands/competitions'   // ← Side-effect import registers handlers
import './commands/participations'

export const metadata: ModuleInfo = { ... }
```

Without this import, the command handler will never be registered on the CommandBus.
```

**File: `.ai/skills/module-scaffold/SKILL.md`** — Ensure scaffolded modules always include command file imports in `index.ts`.

**File: `.ai/skills/troubleshooter/SKILL.md`** — Add this as a known error pattern:

```markdown
### "Command handler not registered for id X"

1. Check if the command file is imported in `src/modules/<module>/index.ts`
2. Check if the command ID follows the singular entity convention: `module.entity.action`
3. Verify the command file calls `registerCommand(handler)` at module scope
```

---

<a id="issue-5"></a>
## Issue #5 — QueryProvider not set in backend pages

**Status:** OPEN
**Severity:** Critical (crashes pages using React Query)

### Description

Backend pages that use `useQueryClient()` or `useQuery()` crash with: `No QueryClient set, use QueryClientProvider to set one`

The error occurs because the backend layout (`src/app/(backend)/backend/layout.tsx`) does NOT wrap children with `QueryProvider`. Only the frontend/auth layout (`src/components/AppProviders.tsx`) includes `QueryProvider`.

### Root Cause Analysis

The app has two layout trees:
1. **Frontend**: `AppProviders` → `ThemeProvider` → `QueryProvider` → `FrontendLayout` → children
2. **Backend**: `I18nProvider` → `AppShell` → children (NO `QueryProvider`)

The `AppShell` component (`@open-mercato/ui/src/backend/AppShell.tsx`) doesn't include `QueryProvider`. This means any backend page using React Query hooks will crash.

The `QueryProvider` component exists in `@open-mercato/ui/src/theme/QueryProvider.tsx` and is exported, but it's only used in the frontend layout by convention.

### Proposed Framework Changes

#### Core Code Fix (`@open-mercato/ui`)

**Option A (Recommended)**: Include `QueryProvider` inside `AppShell`:

```typescript
// packages/ui/src/backend/AppShell.tsx
import { QueryProvider } from '../theme/QueryProvider'

export function AppShell({ children, ...props }) {
  return (
    <QueryProvider>
      {/* existing AppShell layout */}
      {children}
    </QueryProvider>
  )
}
```

This ensures all backend pages automatically have React Query available, matching the frontend layout behavior.

**Option B**: Document that the standalone app's backend layout must include `QueryProvider`:

Update the standalone app template to wrap the backend layout with QueryProvider.

#### AI Guide Improvement

**File: `.ai/guides/ui.md`** — Add explicit QueryProvider requirement:

```markdown
### React Query in Backend Pages

Backend pages that use `useQuery`, `useMutation`, or `useQueryClient` MUST be wrapped
in `QueryProvider`. The `AppShell` component does NOT provide this automatically.

If your backend layout doesn't include `QueryProvider`, add it:

```typescript
import { QueryProvider } from '@open-mercato/ui/theme/QueryProvider'

// In backend layout.tsx, wrap AppShell's children:
<QueryProvider>
  <AppShell>
    {children}
  </AppShell>
</QueryProvider>
```

Alternatively, use `apiCall` from `@open-mercato/ui/backend/utils/apiCall` for
data fetching in backend pages — it doesn't require React Query.
```

**File: `.ai/skills/backend-ui-design/SKILL.md`** — Add note about React Query availability in backend vs frontend contexts.

**File: `.ai/skills/troubleshooter/SKILL.md`** — Add error pattern:

```markdown
### "No QueryClient set, use QueryClientProvider to set one"

This means the component is using React Query hooks (`useQuery`, `useQueryClient`, etc.)
but no `QueryClientProvider` exists in the component tree.

In backend pages: The backend layout does not include `QueryProvider` by default.
Either add `QueryProvider` to the backend layout, or use `apiCall` instead of React Query.
```

---

<a id="issue-6"></a>
## Issue #6 — DataTable not showing all data

**Status:** OPEN
**Severity:** High (data loss in display)

### Description

The DataTable on the competitions page doesn't display all records. The screenshot shows a table with clearly missing rows.

### Root Cause Analysis

This is likely caused by one or more of:

1. **Default pageSize**: The CRUD factory and DataTable have default pagination. If the API defaults to a small page size and the frontend doesn't request all pages, data appears missing.

2. **Missing pagination controls**: If the DataTable component isn't configured with proper pagination state (`page`, `pageSize`, `totalCount`), it shows only the first page without controls to navigate.

3. **Filtering by organization_id**: If some records were created without proper `organization_id` scoping, they won't appear when the API filters by the current org.

4. **Soft-delete filter**: Records with `deletedAt` set are filtered out by default.

### Proposed Framework Changes

#### Core Code Fix (`@open-mercato/ui`)

**File: `packages/ui/src/backend/DataTable.tsx`** — Improve empty/partial state messaging:

```typescript
// When total count > displayed count, show a clear indicator
{totalCount > data.length && (
  <div className="text-sm text-muted-foreground">
    Showing {data.length} of {totalCount} records
  </div>
)}
```

**File: `packages/shared/src/lib/crud/factory.ts`** — Always return `totalCount` in list responses:

Ensure the CRUD factory's GET handler always returns `{ items: [...], totalCount: N, page: N, pageSize: N }` so the client can detect incomplete data.

#### AI Guide Improvement

**File: `.ai/guides/ui.md`** — Add DataTable pagination guidance:

```markdown
### DataTable Pagination

DataTable MUST be configured with pagination to show all data:

```typescript
<DataTable
  columns={columns}
  data={items}
  page={page}
  pageSize={pageSize}
  totalCount={totalCount}
  onPageChange={setPage}
/>
```

If using a custom API (not CRUD factory), ensure the response includes:
- `items`: Array of records for the current page
- `totalCount`: Total number of records matching the query
- `page`: Current page number
- `pageSize`: Records per page

The default `pageSize` is 25. Never exceed 100.
```

---

<a id="issue-7"></a>
## Issue #7 — Portal sidebar has wrong links to portal pages

**Status:** OPEN
**Severity:** High (broken navigation)

### Description

Portal sidebar menu items injected by modules have incorrect hrefs — they're missing the `/{orgSlug}/` prefix.

### Root Cause Analysis

The framework has a fundamental limitation in how portal menu injection works:

1. **Built-in items**: `PortalShell` (`@open-mercato/ui/src/portal/PortalShell.tsx:174-178`) correctly prefixes built-in nav items with `/${orgSlug}/`:
   ```typescript
   const dashboardHref = orgSlug ? `/${orgSlug}/portal/dashboard` : '/portal/dashboard'
   ```

2. **Injected items**: Module widgets (e.g., `competitions/widgets/injection/portal-nav/widget.ts`) declare static `menuItems` with `href` values. These are loaded by `usePortalInjectedMenuItems()` which reads them as-is. **The framework does NOT auto-prefix injected hrefs with `/${orgSlug}/`.**

3. **Current workaround**: The competitions module uses a getter with `window.location.pathname.match()` to extract orgSlug at runtime:
   ```typescript
   get menuItems() {
     const slug = getOrgSlug()  // parses from window.location
     const prefix = slug ? `/${slug}/portal` : '/portal'
     return [...]
   }
   ```
   This is fragile — it depends on `window` being available (fails during SSR) and on the current URL containing the slug.

### Proposed Framework Changes

#### Core Code Fix (`@open-mercato/ui`) — Recommended

**File: `packages/ui/src/portal/PortalShell.tsx`** — Auto-prefix injected menu item hrefs:

```typescript
const mergedNavItems = useMemo(() => {
  if (!authenticated) return []
  const builtIn = [
    { id: 'portal-dashboard', labelKey: 'portal.nav.dashboard', href: dashboardHref },
  ]

  // Auto-prefix injected items' hrefs with orgSlug
  const prefixedInjected = injectedMainItems.map(item => ({
    ...item,
    href: item.href && orgSlug && !item.href.startsWith(`/${orgSlug}`)
      ? `/${orgSlug}${item.href.startsWith('/') ? '' : '/'}${item.href}`
      : item.href,
  }))

  return mergeMenuItems(builtIn, prefixedInjected)
}, [authenticated, dashboardHref, injectedMainItems, orgSlug])
```

This way, module widgets can declare simple hrefs like `/portal/agenda` and the shell handles the orgSlug prefix.

#### Alternative: Pass orgSlug to widget context

**File: `packages/ui/src/portal/hooks/usePortalInjectedMenuItems.ts`** — Accept `orgSlug` parameter and pass it to widget resolution so widgets can receive it in their context instead of parsing `window.location`.

#### AI Guide Improvement

**File: `.ai/guides/core.md` or new `.ai/guides/portal.md`** — Document portal menu injection:

```markdown
### Portal Menu Injection

Portal menu items injected via `menu:portal:sidebar:main` should use hrefs
relative to the portal root (e.g., `/portal/agenda`). The PortalShell will
auto-prefix with `/${orgSlug}`.

**IMPORTANT**: Do NOT try to resolve orgSlug in the widget file.
Use simple `/portal/...` paths. The framework handles prefixing.

Example widget:
```typescript
const widget: InjectionMenuItemWidget = {
  metadata: { id: 'mymodule.portal-nav' },
  menuItems: [
    { id: 'mymodule.portal-page', label: 'My Page', href: '/portal/my-page' },
  ],
}
```

Until the framework auto-prefixes (see tracked issue), use a runtime getter
as a workaround.
```

---

<a id="issue-8"></a>
## Issue #8 — Portal sidebar duplicates

**Status:** OPEN
**Severity:** Medium (UI clutter)

### Description

The portal sidebar shows duplicate navigation entries — e.g., "Dashboard" appears twice.

### Root Cause Analysis

The duplication happens because:

1. **PortalShell** renders a built-in "Dashboard" item with ID `portal-dashboard`:
   ```typescript
   const builtIn = [
     { id: 'portal-dashboard', labelKey: 'portal.nav.dashboard', href: dashboardHref },
   ]
   ```

2. **Module widget** also injects a "Dashboard" item with ID `competitions.portal-dashboard`:
   ```typescript
   { id: 'competitions.portal-dashboard', label: 'Dashboard', href: `${prefix}/dashboard` }
   ```

3. The `mergeMenuItems()` function deduplicates by `id`. Since the IDs are different (`portal-dashboard` vs `competitions.portal-dashboard`), both items survive the merge and render.

### Proposed Framework Changes

#### Core Code Fix (`@open-mercato/ui`)

**Option A** — Deduplicate by `href` in addition to `id`:

**File: `packages/ui/src/backend/injection/mergeMenuItems.ts`**:

```typescript
export function mergeMenuItems(builtIn: MenuItem[], injected: MenuItem[]): MergedMenuItem[] {
  const merged = [...builtIn]
  const existingHrefs = new Set(builtIn.map(i => i.href).filter(Boolean))
  const existingIds = new Set(builtIn.map(i => i.id))

  for (const item of injected) {
    // Skip if same ID or same href already exists
    if (existingIds.has(item.id)) continue
    if (item.href && existingHrefs.has(item.href)) continue

    merged.push(item)
    existingIds.add(item.id)
    if (item.href) existingHrefs.add(item.href)
  }

  return merged
}
```

**Option B** — Allow injected items to declare `replaces: 'portal-dashboard'` to explicitly replace a built-in item:

```typescript
// Widget can declare it replaces a built-in
{ id: 'competitions.portal-dashboard', replaces: 'portal-dashboard', ... }
```

#### AI Guide Improvement

**File: `.ai/guides/core.md`** — Document portal navigation deduplication:

```markdown
### Avoiding Portal Navigation Duplicates

The PortalShell renders a built-in "Dashboard" item (`portal-dashboard`).
If your module injects its own dashboard link, use the same ID to replace
the built-in item:

```typescript
// Use 'portal-dashboard' as ID to replace the built-in, not a module-prefixed ID
{ id: 'portal-dashboard', label: 'Dashboard', href: '/portal/dashboard' }
```

Or set `navHidden: true` in your portal page metadata to prevent auto-injection
and manage the sidebar item manually.
```

---

<a id="ai-guide-gaps"></a>
## AI Guide Gaps — Missing Documentation

Beyond the specific issues above, the following documentation gaps were identified:

### 1. No Portal Development Guide

There is no dedicated guide for building portal (customer-facing) pages. The existing guides cover backend and API development well, but portal pages have different patterns:
- orgSlug routing
- Customer auth vs staff auth
- Portal menu injection
- PortalShell usage
- Portal event bridge

**Recommendation**: Create `.ai/guides/portal.md` covering:
- Portal page structure and routing (`frontend/[orgSlug]/portal/...`)
- Customer authentication (`getCustomerAuthFromRequest`, `useCustomerAuth`)
- Portal menu injection (`menu:portal:sidebar:main`)
- PortalShell and PortalLayoutShell usage
- Portal-specific metadata (`requireCustomerAuth`, `requireCustomerFeatures`)

### 2. Command Handler Registration Not Documented

The `.ai/guides/core.md` documents entities, API routes, and events, but does NOT document:
- Command handler pattern and registration
- Command ID naming convention (`module.entity_singular.action`)
- The requirement to side-effect import command files in `index.ts`
- Relationship between CRUD routes and command IDs

**Recommendation**: Add a "Command Handlers" section to `.ai/guides/core.md`.

### 3. Backend vs Frontend Provider Context Not Documented

No guide explains the different React context providers available in backend vs frontend layouts:
- Backend: `I18nProvider`, `AppShell` (no QueryProvider)
- Frontend: `I18nProvider`, `ThemeProvider`, `QueryProvider`, `FrontendLayout`

**Recommendation**: Add a "Layout Providers" section to `.ai/guides/ui.md` explaining what's available in each layout context.

### 4. Module Scaffold Missing Critical Files

The module scaffold skill should ensure:
- `index.ts` includes side-effect imports for command files
- `page.meta.ts` uses lucide-react icons (not inline SVG)
- Portal widgets use simple hrefs without orgSlug parsing

### 5. Troubleshooter Missing Common Errors

The troubleshooter skill should include patterns for:
- "Command handler not registered for id X"
- "No QueryClient set, use QueryClientProvider"
- Portal sidebar wrong links / duplicates
- Backend page 404 due to wrong URL pattern
- Sidebar icons not rendering

---

## Summary of Proposed Changes

| Area | Change Type | Priority |
|------|-------------|----------|
| `PortalShell` — auto-prefix injected hrefs with orgSlug | Core code fix | **High** |
| `PortalShell` — deduplicate by href in mergeMenuItems | Core code fix | **Medium** |
| Backend layout — include QueryProvider in AppShell | Core code fix | **High** |
| CommandBus — better error messages with registered handlers list | Core code fix | **High** |
| CLI generator — fix old-style backend route path duplication | Core code fix | **High** |
| CLI generator — validate icon exports in page.meta.ts | Core code fix | **Low** |
| CRUD factory — always return totalCount in list responses | Core code fix | **Medium** |
| Create `.ai/guides/portal.md` | AI guide | **High** |
| Add command handler docs to `.ai/guides/core.md` | AI guide | **High** |
| Add layout provider docs to `.ai/guides/ui.md` | AI guide | **Medium** |
| Update troubleshooter with common error patterns | AI guide | **Medium** |
| Update module scaffold with command imports and icon patterns | AI guide | **Medium** |
