# Open Mercato 0.4.8 → 0.6.7 — Upgrade Analysis

Generated 2026-08-20 by static comparison of published npm tarballs
(`@open-mercato/{core,shared,ui,cli,events,queue,cache,search,scheduler,ai-assistant}` at
`0.4.8` and `0.6.7`) against this app's `src/` tree. Every number below is measured, not estimated.

---

## 1. Baseline facts

| Fact | Value |
|---|---|
| Current pin | `0.4.8` (all `@open-mercato/*`) |
| Target pin | `0.6.7` (`latest` dist-tag) |
| Stable releases in between | `0.4.9, 0.4.10, 0.5.0, 0.6.0, 0.6.1 … 0.6.7` (11 hops, 2 minor bumps) |
| App custom code | 600 `.ts/.tsx` files, **74,150 lines** |
| App modules | 9 (`bounties, competitions, example, incidents, judging, projects, sponsors, teams, tracks`) — `example` is **disabled** in `src/modules.ts` |
| Ejected core modules | **none** — big de-risker |
| API route files | 118 (`route.ts`), of which only **20 use `makeCrudRoute`** → 98 hand-written |
| App entity files | 9 |
| App migrations | 34 |
| Portal pages | 32, already on `[orgSlug]/portal/…` with 77 `page.meta.ts` |
| **Automated tests** | **0** ← the single largest process risk |
| `node_modules` | **not installed** |
| `.env` | **absent** (only `.env.example`) |

Local infra is available: `mercato-postgres` (pgvector pg17), `mercato-redis`, `mercato-meilisearch` containers are running.

---

## 2. What did NOT break (verified, de-risks the job)

These were checked mechanically, not assumed:

- **All 153 distinct `@open-mercato/*` import paths** used by `src/` still resolve to a real
  source file in `0.6.7`. Zero module-path removals.
- **Zero exported symbols** that the app imports were removed. (Script resolved every
  `import { … } from '@open-mercato/…'` symbol against the 0.6.7 source, including one level
  of `export *` barrels. One false positive: `FilterValues` from `ui/backend/FilterBar`,
  a barrel-resolution artifact, present in both versions.)
- `CrudForm` and `DataTable` grew ~50% but the public prop diffs are **purely additive optional props**
  (`disableInitialFocus`, `optimisticLockUpdatedAt`, `readOnly`, `collapsibleGroups`,
  `sortableGroups`, `bulkActions`, `virtualized`, `extensionTableId`, …).
- `ui/backend/utils/apiCall` and `ui/backend/utils/crud` are **byte-identical** across versions
  (69 + 52 app imports unaffected).
- `shared/lib/di/container`, `shared/lib/auth/server`, `shared/modules/registry`,
  `shared/modules/setup`, `configs/lib/module-config-service` export diffs are all **additive**.
- All 118 API routes already export `openApi` — the 0.6.7 hard requirement is already satisfied.
- Portal layout already matches the 0.6.7 convention (`frontend/[orgSlug]/portal/**` + `page.meta.ts`).

**Conclusion: this is not an API-removal migration. It is a runtime/ORM/dependency migration.**

---

## 3. Breaking changes, ranked by risk

### 🔴 R1 — MikroORM 6 → 7: `getKnex()` is gone (lands in **0.6.0**)

> **CORRECTED 2026-08-20 after a full survey of `src/`.** The original estimate here
> ("21 files / ~24 sites / 3 modules, mostly mechanical") was derived from a `getKnex` file
> grep and **understated the work materially**. Real figures below.

MikroORM 7 replaced knex with **kysely** (`@mikro-orm/postgresql@7` deps: `kysely 0.29.2`, no knex).
`connection.getKnex()` no longer exists.

**Measured surface — 26 files, 55 distinct query call sites, 5 modules:**

| Module | Files | Query sites | TRIVIAL | MODERATE | HARD |
|---|---|---|---|---|---|
| competitions | 14 | 30 | 4 | 15 | **11** |
| bounties | 5 | 11 | 4 | 6 | 1 |
| teams | 4 | 8 | 1 | 5 | 2 |
| judging | 2 | 5 | 0 | 4 | 1 |
| tracks | 1 | 1 | 1 | 0 | 0 |
| **Total** | **26** | **55** | **10** | **30** | **15** |

`incidents`, `projects`, `sponsors` are clean. There are **zero** `import { Knex }` statements,
so nothing to delete on that front.

**Not all 55 sites need porting.** They split into two populations:

- **`(em as any).getConnection().getKnex()` + builder/`raw` chains** — these BREAK. Concentrated in
  `competitions`, `teams`, `judging`.
- **`em.getConnection().execute(sql, params)`** — already in the 0.6.7-compatible form and
  **needs no change**. This is most of `bounties` (`activity`, `leaderboard`, `submit-pr`,
  `judge/prs`, `data/enrichers.ts`) and the single `tracks` site, plus
  `competitions/api/admin/{resend-invitation,bulk-invite}`.

Every call site is written behind `as any`, so **TypeScript will not flag a single one**.
They fail only at runtime.

**The 15 HARD sites** — these are the ones that will consume the schedule. Each needs a
hand-verified port, not a codemod:

- `competitions/api/portal/chat/route.ts` — `DISTINCT ON (thread_id)` (Postgres-specific) with
  `CASE` + `LEFT JOIN` + `ORDER BY`; three separate raw CTE-ish queries in one file.
- `competitions/api/portal/chat/[threadId]/route.ts` — **`UPDATE … SET … FROM … WHERE`**
  (Postgres join-update). A **write path**.
- `competitions/api/portal/chat/find-thread/route.ts` — `JOIN` + `OR` + `LIMIT` thread lookup.
- `competitions/api/admin/participant-invitations/route.ts` — nested `knex.raw()` used as a
  *where-value* (scalar subquery), plus `orWhere(function(){…})`.
- `competitions/api/admin/invitations/route.ts` — **dynamic chain reassignment**: the query object
  is conditionally rebuilt from optional query params.
- `competitions/api/portal/search-participants/route.ts` — nested callback building `OR` across
  two columns via `whereILike`/`orWhereILike`.
- `teams/api/portal/browse-teams/route.ts` — the worst single file: conditional `whereRaw` ILIKE,
  **`query.clone().clearSelect().count()`** (knex-specific API with no direct kysely equivalent),
  and `orderBy` on a **dynamically interpolated column name**.
- `judging/api/portal/export-results/route.ts` — `leftJoin` onto a **subquery** (aggregate
  `avg` + `groupBy`, aliased) plus `orderByRaw` with `COALESCE`.

**Two write paths** are affected: `competitions/api/portal/update-profile/route.ts:123` (simple
UPDATE, TRIVIAL) and `competitions/api/portal/chat/[threadId]/route.ts:138` (UPDATE…FROM, HARD).

**Result-key convention:** every consumer reads **snake_case** keys (`row.display_name`,
`row.team_name`, `.rows[0].unread_count`) because that is what knex returned. Porting to
`em.getConnection().execute()` preserves this exactly. Porting to the kysely *builder* does too —
kysely does not auto-camelCase either. The hazard is only if a rewriter "helpfully" introduces a
camelCase plugin or renames aliases; **it must not**.

**Two subscribers are affected as well**, which the route-only framing missed:
`competitions/subscribers/notify-team-invitation.ts` and `notify-member-joined.ts`. These run
out-of-band, so an API-contract replay will **not** cover them — they need their own check.

**Replacement patterns**, taken from how the framework migrated its own equivalent route
(`core/modules/messages/api/unread-count/route.ts`, 0.4.8 vs 0.6.7):

```ts
// 0.4.8
const knex = (em as any).getConnection().getKnex()
const rows = await knex('message_recipients as r')
  .join('messages as m', 'm.id', 'r.message_id')
  .where('r.recipient_user_id', userId)

// 0.6.7 — option A: kysely builder (framework's own choice for joins/aggregates)
import { type Kysely, sql } from 'kysely'
const db = em.getKysely<any>()
const rows = await db.selectFrom('message_recipients as r')
  .innerJoin('messages as m', 'm.id', 'r.message_id')
  .where('r.recipient_user_id', '=', userId)
  .select(sql<number>`count(*)`.as('count'))
  .executeTakeFirst()

// 0.6.7 — option B: raw SQL (framework uses this 16x for straightforward queries)
const rows = await em.getConnection().execute<Array<{ id: string }>>(sql, params)
```

**Recommended porting policy**, given the above:
- `knex.raw(...)` sites → **option B**. Near-mechanical: the SQL string already exists.
- HARD builder chains (`DISTINCT ON`, `UPDATE…FROM`, subquery joins, `clone().clearSelect()`,
  dynamic column ordering) → **option B as well**. Hand-writing the SQL is safer and more
  reviewable than fighting kysely's type system to reproduce a dynamic knex chain.
- Simple/MODERATE builder chains → **option A** where it reads cleanly, **option B** otherwise.

### 🔴 R2 — Entity decorators move package (lands in **0.6.0**)

`0.6.7` core entities import from `@mikro-orm/decorators/legacy`, not `@mikro-orm/core`:

```ts
- import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core'
+ import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy'
```

- 9 app entity files affected. `@mikro-orm/decorators` must be added to `package.json`.
- Mechanical, and **tsc will catch it** — low effort, high certainty.
- `Migration` still lives in `@mikro-orm/migrations` — the 34 app migrations need no import change.

### 🟠 R3 — Core DB migration surge

Core migration counts per module, `0.4.8 → 0.6.7`:

| Module | Δ | Module | Δ |
|---|---|---|---|
| `customers` | 3 → **21** | `auth` | 3 → **11** |
| `workflows` | 5 → 10 | `staff` | 4 → 8 |
| `query_index` | 3 → 6 | `audit_logs` | 2 → 5 |
| `messages` | 3 → 5 | `attachments` | 4 → 5 |
| `customer_accounts` | 1 → 4 | `payment_gateways` | 2 → 4 |
| `integrations` | 1 → 3 | `dictionaries` | 1 → 3 |
| `shipping_carriers` | 1 → 3 | `directory` | 2 → 3 |
| plus `api_keys, business_rules, catalog, configs, entities, inbox_ops, perspectives, sales` +1–2 each |

New core modules now exist: `communication_channels` (4 migrations), `wms` (6), `sync_excel` (1) —
**opt-in only**, do not enable during the upgrade.

Auth and customers carry encryption/tenant-scoping reshapes (e.g. the new partial unique index
`users_tenant_email_hash_uniq` on `(tenant_id, email_hash)` over live rows, replacing global
email uniqueness). **Anything in the app that assumed globally-unique user emails must be reviewed.**

Migrations are forward-only and cumulative — a single jump applies them all in order. The risk is
not ordering, it is **data-shape assumptions in the 98 hand-written routes**.

### 🟠 R4 — `ai` SDK 6 → 7 (lands in **0.6.6**)

`@open-mercato/core` moves `ai ^6.0.168 → ^7.0.4`. The app pins `ai ^6.0.146`,
`@ai-sdk/anthropic ^3.0.66`, `@ai-sdk/openai ^2.0.80`. Only **2 app files** import from `ai`/`@ai-sdk`,
so app-side effort is small, but the peer-version alignment must be resolved or install will conflict.

### 🟡 R5 — Other dependency majors

| Dep | 0.4.8 | 0.6.7 | App exposure |
|---|---|---|---|
| `recharts` (ui) | ^2.15 | ^3.9.2 | **0 app files** |
| `react-day-picker` (ui) | ^9.6 | ^10.0.1 | **0 app files** |
| `rate-limiter-flexible` (shared) | ^9 | ^11.2 | indirect |
| `html-to-text` (core) | ^9 | ^10 | indirect |
| `@xyflow/react` | ^12.6 | ^12.11 | minor |
| `date-fns` | ^4.1 | pinned `4.4.0` | check for range conflicts |

New transitive weight in core: `sharp`, `pdfjs-dist`, `mammoth`, `leaflet`, `svix`, `sanitize-html`,
`resend`, `ts-pattern`, `zod ^4.4.3`. Shared gains `pino`, `undici`, `re2js`, `reflect-metadata`.
**`reflect-metadata` matters** — it must be imported before entities load under MikroORM 7 decorators.

### 🟡 R6 — `AppContainer` is now generic

```ts
- export type AppContainer = AwilixContainer
+ export type AppContainer = AwilixContainer<DynamicCradle>
```
116 app files import `shared/lib/di/container`. Expect type-level fallout on any code that
declares its own container-typed variables or DI registrars. tsc will catch all of it.

### 🟡 R7 — Mutation-guard contract replaced

0.6.7 `AGENTS.md` mandates, for hand-written write routes:
`getAllMutationGuardInstances()` + `bridgeLegacyGuard(container)` + `runMutationGuards(...)`
from `shared/lib/crud/mutation-guard-registry`, replacing `validateCrudMutationGuard` /
`runCrudMutationGuardAfterSuccess`.

The app currently uses **neither** (0 hits) — so nothing breaks, but **98 hand-written write routes
are out of contract** and bypass guards, audit, and optimistic locking. Treat as a post-upgrade
hardening backlog, not an upgrade blocker.

### 🟡 R8 — `withAtomicFlush` requirement

New in 0.6.x (`shared/lib/commands/flush.ts`). 0.6.7 `AGENTS.md`:
> Never run raw `em.find` / `em.findOne` between scalar mutations and `em.flush()` on the same
> `EntityManager` without `withAtomicFlush`.

App has **0 usages** against 159 `em.findOne`, 112 `em.find`, 42 `em.flush`, 38 `em.persistAndFlush`.
Needs a targeted audit for the interleaved-read hazard, which under MikroORM 7's changed
flush semantics can silently persist partial state.

### 🟢 R9 — `DataTable.advancedFilter` legacy shape

0.6.7 accepts the legacy flat `AdvancedFilterState` via a `flatToTree`/`treeToFlat` bridge, but the
source comment says the bridge is provided **for one minor version** and back-conversion is
**lossy for nested groups**. Migrate app callers to the tree shape.

### 🟢 R10 — Agentic assets (`.ai/`) restructured

The CLI's shipped agent scaffolding changed shape completely:

| 0.4.8 | 0.6.7 |
|---|---|
| `shared/ai/skills/<name>/SKILL.md` | `shared/ai/skills/**om-**<name>/SKILL.md` (renamed, `om-` prefixed) |
| — | `shared/ai/skills/tiers.json` + `tiers.schema.json` |
| — | `shared/scripts/install-skills.sh` → canonical `.agents/skills/` |
| `guides/{core,ui,…}.md` | + `guides/modules/<module>.md` (~40 files) + `guides/module-facts.json` + `guides/module-system.md` |
| — | `shared/ai/qa/tests/playwright.config.ts` |
| — | `shared/ai/skills/om-prepare-test-env`, `om-implement-spec`, `om-help`, `om-auto-*-pr` |

This repo's `.ai/guides/*.md` (1,174 lines) and `.ai/skills/*` are stale 0.4.8 copies, and
`AGENTS.md`'s Task→Context routing table points at paths that no longer match the framework.
**Refreshing these is part of the upgrade** — otherwise every future agent session runs on
0.4.8-era instructions.

---

## 4. The gift: an official upgrade skill exists

`@open-mercato/cli@0.6.7` ships
`dist/agentic/shared/ai/skills/om-auto-upgrade-0.4.10-to-0.5.0/SKILL.md` — an executable
companion to the 0.5.0 upgrade notes ("biggest Open Mercato release so far, 250+ post-Hackathon fixes").

It applies 10 codemods. **Measured applicability to this app:**

| Codemod | App files affected |
|---|---|
| `lucide-brand-icons` (`Linkedin`→`Briefcase`, `Twitter`→`AtSign`) | **1** |
| `meilisearch-class-rename` | 0 |
| `meilisearch-jest-esm` | 0 (no jest specs) |
| `stripe-api-version-type` / `stripe-retrieve-current` | 0 |
| `react-markdown-classname-wrap` | 0 |
| `cron-parser-api` | 0 |
| `simplewebauthn-uint8array` | 0 |
| `react-email-cli` | check `package.json` scripts |
| `lucide-metadata-icons` | check 77 `page.meta.ts` |

So the 0.5.0 hop is **nearly free for this app**. The skill also explicitly states MikroORM 7 was
**deferred** at 0.5.0 — confirming 0.6.0 is where the wall is.

**Run the skill, but do not expect it to carry the upgrade.** The real work is R1–R3.

---

## 5. The version wall — where each break lands

```
0.4.8 ──▶ 0.4.9 ──▶ 0.4.10 ──▶ 0.5.0 ──────▶ 0.6.0 ──────▶ 0.6.6 ──▶ 0.6.7
   │                              │             │              │
   │                       official codemod   MikroORM 7     ai SDK
   │                       skill (10 fixes,   knex→kysely     6 → 7
   │                       1 applies here)    decorators move
   │                                          core migration surge
   └── low-risk patches ─────────┘             ◀── THE WALL ──▶
```

**Recommended staging — 3 install/verify cycles, 4 gates:**

| Stage | Target | Content | Risk |
|---|---|---|---|
| **S1** | `0.5.0` | bump 0.4.8→0.4.10→0.5.0 in one install; run the official codemod skill; typecheck + build + smoke | Low |
| **S2** | `0.6.0` | **MikroORM 7**: decorators move, all 21 knex→kysely rewrites, `reflect-metadata`, core migrations apply | **High** |
| **S3** | `0.6.7` | incremental 0.6.1→0.6.7; `ai` 6→7; UI dep majors; DataTable filter tree; guard/flush hardening | Medium |
| **S4** | — | `.ai/` + `AGENTS.md` refresh, adopt 0.6.7 integration test runner, final regression | Low |

Do **not** collapse S2 into a single jump-to-0.6.7. The knex rewrites need to be verified against a
running app while the surrounding surface is otherwise stable.

---

## 6. Testing strategy — the hard part

**There are zero tests across 74,150 lines.** The 21 knex rewrites cannot be validated by
`tsc` (they are behind `as any`) and cannot be validated by tests (there are none). Without
intervention this upgrade is unverifiable.

### 6.1 Capture a golden baseline BEFORE touching anything

This is non-negotiable and must happen while the app still runs on 0.4.8.

1. `yarn install` at 0.4.8, create `.env` from `.env.example`, point at a **dedicated upgrade
   database** (never the dev DB), `yarn initialize`, seed a representative fixture:
   ≥1 competition, tracks, teams, projects, judges, sponsors, bounties, incidents, chat threads.
2. Snapshot the DB: `pg_dump -Fc` → `.ai/upgrade/baseline/db-0.4.8.dump`. This is the reset point
   for every re-run of the loop.
3. Record a **route contract baseline**: drive all 118 API routes (auth'd as admin, as a portal
   participant, and as a judge) and persist `{ path, method, status, response-shape-hash, row-counts }`
   → `.ai/upgrade/baseline/api-contract.json`.
4. Record a **page baseline**: all 32 portal pages + the backend pages, capturing HTTP status,
   absence of error boundaries, and console errors → `.ai/upgrade/baseline/pages.json`.
5. Prioritise the **21 knex-touching routes** — for those, persist full normalised response bodies,
   not just shape hashes. These are the ones that will silently break.

### 6.2 Verify after each stage

Gate ladder, run in order, stop at first failure:

```
1. yarn install                       — resolves without peer conflicts
2. yarn generate                      — codegen succeeds
3. yarn typecheck                     — 0 errors
4. yarn db:migrate                    — applies clean on the baseline dump
5. yarn build                         — production build succeeds
6. boot + readiness                   — "Application is ready at <baseUrl>"
7. replay api-contract.json           — diff vs baseline, zero unexplained deltas
8. replay pages.json                  — zero new 5xx / error boundaries / console errors
9. targeted knex-route body diff      — byte-level for the 21 rewritten routes
```

Gates 1–6 are machine-checkable and cheap. Gates 7–9 are what actually catch R1.

### 6.3 Adopt the framework's own test runner at S4

0.6.7 ships an ephemeral integration runner (Playwright + testcontainers) plus an
`om-prepare-test-env` skill:

- `yarn mercato test:ephemeral` — boot isolated app + DB, port 5001, state in `.ai/qa/ephemeral-env.json`
- `yarn mercato test:integration [filter]` — provision-or-reuse, then run
- `yarn mercato test:integration:interactive`
- specs discovered under `.ai/qa/tests/`, config `.ai/qa/tests/playwright.config.ts`

Convert the baseline replay harness into real Playwright specs here, so the app leaves the
upgrade **with** a regression suite rather than a throwaway script. Prefer the fully-managed
ephemeral mode: it cannot touch dev data.

---

## 7. Pre-flight checklist (do these before the loop starts)

- [ ] `git checkout -b chore/upgrade-om-0.6.7` off `main` (clean tree confirmed).
- [ ] **Delete the disabled `example` module** (98 files / 8,717 lines / 1 knex site) — it is
      commented out in `src/modules.ts` and is pure upgrade surface. Removes 12% of the work.
- [ ] `yarn install` at 0.4.8 and confirm the app builds and boots **today**. An unverified
      baseline makes every later failure ambiguous.
- [ ] Create `.env` from `.env.example`; provision `om_upgrade` DB on `mercato-postgres`.
- [ ] Confirm private-registry access for `@open-mercato/enterprise` if enterprise flags are used
      (`OM_ENABLE_ENTERPRISE_MODULES`) — `enterprise@0.6.7` exists but is not currently installed.
- [ ] Decide `ai` SDK strategy: align app to `ai ^7` alongside core, or hold at 0.6.5 (last `ai ^6`
      release) if the 2 AI files prove costly.
- [ ] Confirm nothing depends on globally-unique user emails (R3 auth reshape).

## 8. Explicit non-goals for this upgrade

Keep these out of scope or the loop will never converge:

- Enabling the new `communication_channels`, `wms`, `sync_excel` modules.
- Migrating the 98 hand-written routes to `makeCrudRoute`.
- Adopting optimistic locking (`optimisticLockUpdatedAt`) across forms.
- Feature work of any kind.

Each becomes a follow-up ticket, filed by the loop, not fixed by it.
