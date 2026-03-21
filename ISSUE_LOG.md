# Issue Log — Open Mercato Framework

Issues discovered during HackOn platform development that require framework-level fixes.

---

## ISSUE-001: Portal menu injection widgets cannot resolve `orgSlug` in hrefs

**Severity:** High
**Affects:** Any app module injecting portal sidebar navigation
**Discovered:** 2026-03-20 during HackOn Phase 2

### Problem

`InjectionMenuItemWidget.menuItems[].href` is typed as `string` — a static value defined at module load time. Portal URLs require an `orgSlug` prefix (e.g., `/acme-corp/portal/team`), but the slug is only known at runtime from the URL or portal context.

Built-in portal nav items work because they're constructed inside `PortalShell.tsx` where `orgSlug` is available:

```typescript
// PortalShell.tsx line 177 — works because orgSlug is in scope
const dashboardHref = orgSlug ? `/${orgSlug}/portal/dashboard` : '/portal/dashboard'
```

Injected menu items are static data widgets loaded via `usePortalInjectedMenuItems()`. The hook passes `href` through unchanged — no orgSlug resolution:

```typescript
// usePortalInjectedMenuItems.ts — items used as-is
entries.push({ ...menuItem, labelKey: normalizedLabelKey, features })
```

**Result:** Injected portal nav links navigate to `/portal/team` instead of `/acme-corp/portal/team` → 404.

### Current Workaround

Using a `get menuItems()` getter that reads `window.location.pathname` at access time:

```typescript
const widget: InjectionMenuItemWidget = {
  metadata: { id: 'teams.portal-nav' },
  get menuItems() {
    const match = window.location.pathname.match(/^\/([^/]+)\/portal/)
    const prefix = match ? `/${match[1]}/portal` : '/portal'
    return [
      { id: 'teams.portal-my-team', label: 'My Team', href: `${prefix}/team`, ... },
    ]
  },
}
```

This works but is fragile — relies on `window` availability, regex parsing, and the getter being called on every render cycle.

### Proposed Fix

**Option A (minimal, recommended): Resolve portal hrefs in `usePortalInjectedMenuItems`**

The hook already runs inside the portal context where `orgSlug` is available. Add automatic href resolution for items whose `href` starts with `/portal/`:

```typescript
// usePortalInjectedMenuItems.ts
export function usePortalInjectedMenuItems(surfaceId: PortalMenuSurfaceId) {
  const { widgets, isLoading } = useInjectionDataWidgets(surfaceId)
  const portalCtx = usePortalContext()                    // ← ADD
  const orgSlug = portalCtx?.orgSlug ?? ''                // ← ADD
  // ...

  const items = React.useMemo(() =>
    rawItems
      .filter(/* feature gate */)
      .map((item) => ({                                   // ← ADD
        ...item,
        href: item.href && orgSlug && item.href.startsWith('/portal/')
          ? `/${orgSlug}${item.href}`
          : item.href,
      })),
    [rawItems, grantedFeatures, orgSlug],                 // ← ADD orgSlug dep
  )

  return { items, isLoading }
}
```

Widget definitions would then use simple `/portal/...` paths:

```typescript
{ id: 'teams.portal-my-team', href: '/portal/team', ... }
```

**Pros:** Zero breaking changes. Existing widgets without `/portal/` prefix are unaffected. Convention is intuitive — portal-relative paths just work.

**Cons:** Implicit behavior. Developers must know to use `/portal/` prefix for auto-resolution.

**Option B (explicit): Add `portalRelative` flag to `InjectionMenuItem`**

```typescript
export type InjectionMenuItem = {
  // ...existing fields...
  href?: string
  portalRelative?: boolean  // ← NEW: when true, href is prefixed with /{orgSlug}
}
```

Resolution in `usePortalInjectedMenuItems`:

```typescript
href: item.portalRelative && orgSlug
  ? `/${orgSlug}${item.href}`
  : item.href
```

**Pros:** Explicit opt-in, no magic. Clear in widget definitions.

**Cons:** New field on a frozen type. Slightly more verbose for widget authors.

**Option C (flexible): Support href as function**

```typescript
export type InjectionMenuItem = {
  // ...existing fields...
  href?: string | ((ctx: { orgSlug: string }) => string)  // ← EXTEND
}
```

Resolution in the hook or rendering:

```typescript
const resolvedHref = typeof item.href === 'function'
  ? item.href({ orgSlug })
  : item.href
```

**Pros:** Maximum flexibility. Works for any dynamic URL pattern.

**Cons:** Breaking type change if consumers do `typeof item.href === 'string'` checks. Function values can't be serialized.

### Recommendation

**Option A** — it's the smallest change (5 lines in one file), zero breaking changes, and follows the principle of least surprise: portal menu items naturally use portal-relative paths.

---

## ISSUE-002: `yarn db:generate` creates polluted migrations for new modules

**Severity:** Critical
**Affects:** Any app adding a new `@app` module with entities
**Discovered:** 2026-03-19 during HackOn Phase 1

### Problem

`dbGenerate` in `@open-mercato/cli` processes modules alphabetically, creating a separate MikroORM instance per module. However, MikroORM maintains a **global metadata registry** via `@Entity()` decorators. When a module's `data/entities.ts` is imported, its decorators register entities globally.

By the time a later module (alphabetically) is processed, all previously imported modules' entities are in the global metadata. MikroORM's `createMigration()` then generates a migration containing **all accumulated entities**, not just the target module's.

**Example:** The `competitions` module (processed after `catalog`, `customers`, etc.) gets a 1,182-line migration with 207 `CREATE TABLE` statements for tables across all core modules — not just the 5 competition tables.

Core modules aren't affected because their snapshots already match the accumulated state. But **any new module** gets a polluted migration on first `db:generate`.

### Current Workaround

1. Run `yarn db:generate` (creates polluted migration + correct snapshot)
2. Delete the polluted migration file
3. Hand-write a clean migration with only the module's tables
4. Run `yarn db:generate` again to verify "no changes"

### Proposed Fix

**Clear MikroORM's global metadata registry between module iterations** in `dbGenerate`:

```typescript
// cli/src/lib/db/commands.ts — inside the module loop
for (const entry of ordered) {
  // ← ADD: Clear global metadata before loading each module's entities
  const { MetadataStorage } = await import('@mikro-orm/core')
  MetadataStorage.clear()                                    // ← or equivalent reset

  const entities = await loadModuleEntities(entry, resolver)
  if (!entities.length) { ... continue }
  // ... rest of migration generation
}
```

If `MetadataStorage.clear()` doesn't exist, fork the entity loading into a child process or use `MikroORM.init()` with `discovery: { disableDynamicFileAccess: true }` to prevent metadata leakage.

**Alternative:** Run `loadModuleEntities` in an isolated `vm` context or worker thread so decorator side effects don't pollute the parent process.

### Impact

Without this fix, every developer adding a new module must manually clean up migrations — a significant DX friction that can lead to accidentally applying destructive migrations (dropping FK constraints on core tables).

---

## ISSUE-003: Example module snapshot contains full database schema

**Severity:** Medium
**Affects:** Starter/template projects with the `example` module
**Discovered:** 2026-03-19 during HackOn Phase 1

### Problem

The `.snapshot-open-mercato.json` in `src/modules/example/migrations/` shipped with the starter template contains the schema for **all core module tables** (~200 tables), not just the 3 example entities. This is a side effect of ISSUE-002 — the snapshot was generated with the full accumulated metadata.

When `db:generate` runs, it compares the example's 3 entities against this bloated snapshot, detecting a massive diff and generating a bogus migration that drops FK constraints on core tables.

### Proposed Fix

Regenerate the example module's snapshot with an isolated MikroORM instance (after fixing ISSUE-002), so it contains only the `example_items`, `todos`, and `example_customer_priorities` tables.

For the starter template: ship a clean snapshot or no snapshot at all (let `db:generate` create it fresh on first run).

---
