# Agent Context Routing — hackathon-starter

<!-- CODEX_ENFORCEMENT_RULES_START -->
## CRITICAL rules — always follow without exception

1. **After editing any entity file** (`src/modules/<id>/data/entities.ts`):
   - STOP immediately before any further action
   - Tell the user: "I modified an entity in module <id>. Should I create a migration?"
   - If yes: run `yarn db:generate`
   - Show the generated migration to the user before applying
   - Ask for confirmation, then run `yarn db:migrate`
   - Run `yarn generate` after migration is applied

2. **After editing `src/modules.ts`**: immediately run `yarn generate`

3. **MikroORM 7 rules** (the framework moved 6 → 7; these are not optional):
   - Entity decorators import from `@mikro-orm/decorators/legacy`, NOT `@mikro-orm/core`
   - `persistAndFlush` / `removeAndFlush` NO LONGER EXIST — use `em.persist(x)` then `await em.flush()`
   - knex is gone (kysely replaced it). `getConnection().getKnex()` does not exist.
     Use `em.getConnection().execute<T>(sql, params)` or `em.getKysely<any>()`.
   - `execute()` **INLINES** parameters, it does not bind them. A JS array renders as a
     comma-joined list of literals, so **`IN (?)` is correct and `= ANY(?)` is a SYNTAX ERROR**.
     Always guard the empty-array case — `IN ()` does not parse.
   - `getKysely()` is on the **EntityManager** (`em.getKysely()`), NOT on `getConnection()`.
   - **Never** run `em.find` / `em.findOne` between a scalar mutation and `em.flush()` — v7
     silently drops the pending UPDATE. Multi-phase mutations MUST use
     `withAtomicFlush(em, phases, { transaction: true, label: '<module>.<command>' })` from
     `@open-mercato/shared/lib/commands/flush` (it flushes after *each* phase; options are
     `transaction` (default false), `isolationLevel`, `label`). Keep `emitCrudSideEffects` and
     cache invalidation OUTSIDE the block — they must fire after commit.
   - See `.ai/upgrade/KYSELY-PORTING-COOKBOOK.md` for verified before/after patterns
     (§17 covers the `= ANY(?)` failure above)

4. **Portal pages** MUST ship a sibling `page.meta.ts`. `requireCustomerAuth` /
   `requireCustomerFeatures` are enforced SERVER-SIDE by the `(frontend)` catch-all.

5. **Custom (non-`makeCrudRoute`) write routes must run the mutation-guard registry.**
   Preferred entrypoint — it wraps the store, the legacy bridge and the runner, and returns a
   ready-to-return `Response` when a guard blocks:
   ```ts
   import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
   ```
   The lower-level primitives live in **two different modules** — do not import both from one:
   - `runMutationGuards`, `bridgeLegacyGuard`, `matchesEntity` → `@open-mercato/shared/lib/crud/mutation-guard-registry`
   - `getAllMutationGuardInstances` → `@open-mercato/shared/lib/crud/mutation-guard-**store**`

   Map the route to `create` / `update` / `delete` (action endpoints are usually `update`), pass
   `{ userFeatures }`, merge the returned `modifiedPayload` before writing, and run the returned
   `afterSuccessCallbacks` after success (catching and logging callback failures).

   `validateCrudMutationGuard` (`@open-mercato/shared/lib/crud/mutation-guard`) is **deprecated but
   still present** — core still calls it. Do not use it in new code: it resolves only the single
   DI-registered `crudMutationGuardService` and silently bypasses every guard in the global store.

6. **Never edit `.mercato/generated/*`**: edit the source and run `yarn generate` instead

7. **Before significant features**: check `.ai/specs/` for an existing spec.
   If none exists, ask the user whether to create one first.

---
<!-- CODEX_ENFORCEMENT_RULES_END -->


Read this file before any task. Load ONLY the files listed for your task type.
Do NOT load the entire src/ tree — Open Mercato apps can have many modules.

## What This Project Is

A standalone Open Mercato application built ON TOP of the framework.
The framework lives in `node_modules/@open-mercato/*`. Never edit `node_modules` directly.
To customise a built-in module beyond extensions, eject with `yarn mercato eject <module>`.

## Task → Context Map

Match your task, then load the listed file(s) BEFORE writing code. A task may match multiple rows.

### Module Development

| Task | Load |
|---|---|
| Scaffold a new module from scratch | `.ai/skills/om-module-scaffold/SKILL.md` |
| Design entities and relationships | `.ai/skills/om-data-model-design/SKILL.md` |
| Build backend UI (forms, tables, pages) | `.ai/skills/om-backend-ui-design/SKILL.md` |
| Build an integration provider | `.ai/skills/om-integration-builder/SKILL.md` |

### Extending Core Modules (UMES)

| Task | Load |
|---|---|
| Extend a core module (add fields, columns, menus, interceptors, enrichers) | `.ai/skills/om-system-extension/SKILL.md` |
| Eject and customize a core module | `.ai/skills/om-eject-and-customize/SKILL.md` |
| Add a response enricher to another module's API | `.ai/guides/core.md` → Response Enrichers |
| Add an API interceptor (before/after hooks) | `.ai/guides/core.md` → API Interceptors |
| Inject widgets into forms/tables/menus | `.ai/guides/core.md` → Widget Injection |
| Replace or wrap a UI component | `.ai/guides/core.md` → Component Replacement |

### Per-Module Reference (NEW at 0.6.x)

| Task | Load |
|---|---|
| Anything specific to ONE core module | `.ai/guides/modules/<module>.md` (54 available) |
| How the module system fits together | `.ai/guides/module-system.md` |
| Machine-readable module index | `.ai/guides/module-facts.json` |

### Framework Feature Usage

| Task | Load |
|---|---|
| Add/modify an entity, create migration | `.ai/guides/core.md` → Module Files, then `yarn db:generate` |
| Add a REST API endpoint | `.ai/guides/core.md` → API Routes |
| Add a backend page | `.ai/guides/ui.md` → CrudForm / DataTable |
| Add event subscribers or emit events | `.ai/guides/events.md` |
| Add real-time browser updates (SSE) | `.ai/guides/events.md` → DOM Event Bridge |
| Add search to a module | `.ai/guides/search.md` |
| Add caching | `.ai/guides/cache.md` |
| Add background workers | `.ai/guides/queue.md` |
| Use i18n (translations) | `.ai/guides/shared.md` → i18n |
| Use encrypted queries | `.ai/guides/shared.md` → Encryption |
| Use apiCall / UI components | `.ai/guides/ui.md` |
| Add permissions (RBAC) | `.ai/guides/core.md` → Access Control |
| Add notifications | `.ai/guides/core.md` → Notifications |
| Add custom fields | `.ai/guides/core.md` → Custom Fields |

### Quality & Process

| Task | Load |
|---|---|
| Debug / fix errors | `.ai/skills/om-troubleshooter/SKILL.md` |
| Review code changes | `/code-review` slash command (no longer a repo-local skill) |
| Write a spec | `.ai/specs/SPEC-000-template.md` |
| Implement an existing spec | `.ai/skills/om-implement-spec/SKILL.md` |
| "What should I do next?" / orientation | `.ai/skills/om-help/SKILL.md` |
| Prepare / run integration tests | `.ai/skills/om-prepare-test-env/SKILL.md` |
| Disable modules this project does not use | `.ai/skills/om-trim-unused-modules/SKILL.md` |

## Module Anatomy

Each module in `src/modules/<id>/` is self-contained and auto-discovered:

```
src/modules/<id>/
├── index.ts              # Module metadata
├── data/
│   ├── entities.ts       # MikroORM entity classes
│   ├── validators.ts     # Zod validation schemas
│   ├── extensions.ts     # Cross-module entity links
│   └── enrichers.ts      # Response enrichers
├── api/
│   ├── <resource>/route.ts  # REST handlers (auto-discovered by method)
│   └── interceptors.ts      # API route interception hooks
├── backend/              # Admin UI pages (auto-discovered)
│   └── page.tsx          # → /backend/<module>
├── frontend/             # Public pages (auto-discovered)
├── subscribers/          # Event handlers (export metadata + default handler)
├── workers/              # Background jobs (export metadata + default handler)
├── widgets/
│   ├── injection/        # UI widgets injected into other modules
│   ├── injection-table.ts # Widget-to-slot mappings
│   └── components.ts     # Component replacement/wrapper definitions
├── di.ts                 # Awilix DI registrations
├── acl.ts                # Permission features
├── setup.ts              # Tenant init, role features, seed data
├── events.ts             # Typed event declarations
├── search.ts             # Search indexing configuration
├── ce.ts                 # Custom entities / custom field sets
├── translations.ts       # Translatable fields per entity
├── notifications.ts      # Notification type definitions
├── notifications.client.ts  # Client-side notification renderers
├── encryption.ts         # Tenant encryption maps for sensitive / GDPR fields
└── generators.ts         # Module-level generator plugins (import type ONLY — no runtime imports)
```

Backend and frontend pages are paired with a sibling `page.meta.ts` (`requireAuth` /
`requireFeatures` / `pageGroup` / `pageGroupKey` / `pageOrder`; portal pages use
`requireCustomerAuth` / `requireCustomerFeatures`).

Register in `src/modules.ts`: `{ id: '<id>', from: '@app' }`

## Critical Conventions

- After any module/entity change: `yarn generate`
- After any entity edit: run `yarn db:generate` as a schema-diff probe. Default to the generated
  SQL. If it emits unrelated churn from another module's stale snapshot, delete the noise, keep
  only the SQL for your module, and update that module's
  `src/modules/<module>/migrations/.snapshot-open-mercato.json` in the same change — the snapshot
  update is mandatory, otherwise the migration regenerates forever. Never hand-edit a migration
  that has already been applied; add a new one.
- **Every `api/**/route.ts` that exports a handler MUST also export per-method `metadata`.**
  Without it the generator warns and every method silently defaults to auth-required. The legacy
  top-level `export const requireAuth` / `requireFeatures` is no longer recognised.
  ```ts
  export const metadata = {
    GET: { requireAuth: true, requireFeatures: ['mymodule.view'] },
    POST: { requireAuth: true, requireFeatures: ['mymodule.manage'] },
  }
  ```
  Public endpoints must opt out explicitly with `{ requireAuth: false }`.
- **New feature IDs must be granted, not just declared.** Adding a feature to `<module>/acl.ts`
  requires also adding it to `defaultRoleFeatures` in that module's `setup.ts`, then running
  `yarn mercato auth sync-role-acls` so existing tenants pick it up. Feature IDs are frozen once
  shipped — add a new one alongside rather than renaming.
- **Sensitive / GDPR fields go through encryption maps, never hand-rolled crypto.** Declare them
  in `src/modules/<module>/encryption.ts` (the module registry field `defaultEncryptionMaps`,
  typed `ModuleEncryptionMap[]` from `@open-mercato/shared/modules/encryption` — note
  `defaultEncryptionMaps` is a registry property, not an importable symbol). Read those columns
  with `findWithDecryption` / `findOneWithDecryption`, never raw `em.find`. Run
  `yarn mercato entities seed-encryption --tenant <id>` after adding maps.
- Use `withScopedPayload(payload, ctx, translate, options)` from
  `@open-mercato/shared/lib/api/scoped` for ad-hoc scoped queries (`translate` is required).
- Detail/read-model APIs exposing `customFields` MUST return bare keys via
  `normalizeCustomFieldResponse()`; keep `cf_` / `cf:` prefixes for requests, filters and form IDs.
- NEVER edit `.mercato/generated/*` — auto-generated
- NEVER edit `node_modules/@open-mercato/*` — eject instead
- Custom modules use `from: '@app'` in `src/modules.ts`
- Confirm migrations with user before `yarn db:migrate`

## Naming Conventions

- Module IDs: plural, snake_case (`order_items`)
- Event IDs: `module.entity.action` (singular entity, past tense: `sales.order.created`)
- DB tables: plural, snake_case with module prefix (`catalog_products`)
- DB columns: snake_case (`created_at`, `organization_id`)
- JS/TS identifiers: camelCase
- Feature IDs: `<module>.<action>` (`my_module.view`, `my_module.create`)
- UUID primary keys, explicit foreign keys, junction tables for M2M

## Key Imports Quick Reference

Every specifier below was verified against the installed 0.6.7 packages.

```typescript
// Entities — decorators come from the LEGACY subpath (@mikro-orm/decorators has no root export)
import { Entity, PrimaryKey, Property, ManyToOne, Index, Unique } from '@mikro-orm/decorators/legacy'

// Translations
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

// API calls (MUST use — never raw fetch)
import { apiCall, apiCallOrThrow } from '@open-mercato/ui/backend/utils/apiCall'

// CRUD forms — NOTE: '@open-mercato/ui/backend/crud' does NOT resolve. Two modules:
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { createCrud, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { createCrudFormError } from '@open-mercato/ui/backend/utils/serverErrors'

// CRUD API routes
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { withScopedPayload } from '@open-mercato/shared/lib/api/scoped'
import { normalizeCustomFieldResponse } from '@open-mercato/shared/lib/custom-fields/normalize'

// Mutation guards for CUSTOM write routes (two different modules — see CRITICAL rule 5)
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { runMutationGuards, bridgeLegacyGuard } from '@open-mercato/shared/lib/crud/mutation-guard-registry'
import { getAllMutationGuardInstances } from '@open-mercato/shared/lib/crud/mutation-guard-store'

// Multi-phase entity mutations (MikroORM 7 flush safety)
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'

// UI components (MUST use — never raw <button>)
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { LoadingMessage, ErrorMessage } from '@open-mercato/ui/backend/detail'
import { FormHeader, FormFooter } from '@open-mercato/ui/backend/forms'
import { flash } from '@open-mercato/ui/backend/FlashMessages'

// Encrypted queries (MUST use instead of em.find)
import { findWithDecryption, findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'

// Encryption maps: the TYPE is imported; `defaultEncryptionMaps` is what YOUR
// src/modules/<module>/encryption.ts EXPORTS — it is not importable from shared.
import type { ModuleEncryptionMap } from '@open-mercato/shared/modules/encryption'
export const defaultEncryptionMaps: ModuleEncryptionMap[] = [/* ... */]

// Events
import { createModuleEvents } from '@open-mercato/shared/modules/events'

// Widget injection
import { InjectionPosition } from '@open-mercato/shared/modules/widgets/injection-position'

// Types
import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import type { ResponseEnricher } from '@open-mercato/shared/lib/crud/response-enricher'
import type { ApiInterceptor } from '@open-mercato/shared/lib/crud/api-interceptor'
```

## Key Commands

| Command | Purpose |
|---|---|
| `yarn dev` | Start dev server |
| `yarn generate` | Regenerate `.mercato/generated/` |
| `yarn db:generate` | Create migration for entity changes |
| `yarn db:migrate` | Apply pending migrations |
| `yarn initialize` | Bootstrap DB + first admin account |
| `yarn build` | Build for production |
| `yarn mercato eject <module>` | Copy a core module into `src/modules/` |
| `yarn mercato module add <package>` | Install and enable an official module package |
| `yarn mercato auth sync-role-acls` | Push newly declared ACL features onto existing tenants |
| `yarn mercato entities seed-encryption --tenant <id>` | Apply new encryption maps to a tenant |
| `yarn mercato configs cache structural --all-tenants` | Purge navigation/sidebar structural cache |
| `yarn install-skills` | Install/refresh agent skills (see note below) |

> **Skills layout.** This repo is currently on the *legacy* layout: `.claude/skills` is a directory
> symlink to `.ai/skills`, so every `om-*` skill in `.ai/skills/` is already discoverable as-is —
> nothing needs to be run for the skills listed in the tables above to work.
>
> `yarn install-skills` (→ `scripts/install-skills.sh`) migrates to the 0.6.x canonical layout: it
> creates the cross-agent directory `.agents/skills/`, symlinks the local tiered skills selected by
> `.ai/skills/tiers.json` into it, and **additionally performs a network install**
> (`npx skills add` / `npx skills update`) of the external `open-mercato/skills` collection — which
> is where `om-code-review`, `om-spec-writing`, `om-integration-tests` and the `om-auto-*` PR
> skills now live. It requires `jq` and network access; `--no-external` skips the network step and
> `--list` prints the tier table without installing anything. **It has not been run in this repo.**

## Architecture Rules

- NO direct ORM relationships between modules — use foreign key IDs
- Always filter by `organization_id` for tenant-scoped entities
- Validate all inputs with Zod; derive types via `z.infer`
- Use DI (Awilix) for services; avoid `new`-ing directly
- No `any` types — use Zod schemas with `z.infer`, narrow with runtime checks
- Every dialog: `Cmd/Ctrl+Enter` submit, `Escape` cancel
- Keep `pageSize` at or below 100
- Every API route MUST export `openApi`

## Stack

Next.js App Router, TypeScript, MikroORM, Awilix DI, Zod
