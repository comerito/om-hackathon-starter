# Upgrade State — 0.4.8 → 0.6.7

Branch: `chore/upgrade-om-0.6.7`
Current stage: **S3 → 0.6.7 (in progress)**
Current gate: S3 core-delta triage
Iterations: 4

Baseline surface after `example` removal: **502 files / 65,432 lines**
(was 600 / 74,150 — the analysis doc's figures predate the deletion).

## Gate ledger

| # | Stage | Gate | Verdict | Evidence | Date |
|---|-------|------|---------|----------|------|
| 1 | PRE-FLIGHT | P0 branch created | ✅ | `chore/upgrade-om-0.6.7` off `main` @ `fcffed1`, tree clean | 2026-08-20 |
| 2 | PRE-FLIGHT | P1 yarn toolchain | ✅ | lockfile is Berry (`__metadata: version 8`, `cacheKey 10c0`) but `yarn -v` = 1.22.22; pinned `packageManager: yarn@4.12.0`; `corepack yarn --version` → `4.12.0`. Commit `8a2f490` | 2026-08-20 |
| 3 | PRE-FLIGHT | P2 remove `example` | ✅ | disabled in `src/modules.ts`, zero other refs; deleted 103 files / 8,717 lines / 1 `getKnex()` site. Commit `1338352` | 2026-08-20 |
| 4 | PRE-FLIGHT | P3 install @ 0.4.8 | ✅ | `corepack yarn install --immutable` exit 0; 352 pkgs added; all `@open-mercato/*` resolve to `0.4.8`. Peer warnings pre-existing (YN0086) | 2026-08-20 |
| 5 | PRE-FLIGHT | P4 `.env` + isolated DB | ✅ | `om_upgrade` DB created on `mercato-postgres`; `.env` from `.env.example` with `DATABASE_URL=…/om_upgrade`, `APP_URL/PORT=3006`. Dropped `NODE_EXTRA_CA_CERTS` (no `certs/` dir). `.env` is gitignored | 2026-08-20 |
| 6 | PRE-FLIGHT | P5 `yarn generate` @ 0.4.8 | ✅ | 25 generated files + OpenAPI; "Found 332 API route files", "Generated 310 API paths"; done in 845ms | 2026-08-20 |
| 7 | PRE-FLIGHT | P6 `yarn typecheck` @ 0.4.8 | ✅ | **exit 0, zero `error TS`**. Any TS error at S2/S3 is upgrade-caused, not pre-existing | 2026-08-20 |
| 8 | PRE-FLIGHT | P6b `yarn initialize` | ✅ | exit 0; per-module migration tables created; 165 entities reindexed; users `superadmin@/admin@/employee@acme.com` pw `secret`; 1 tenant, 1 org | 2026-08-20 |
| 9 | PRE-FLIGHT | P7 fixture seeding | ✅ | **66 writes, 0 errors** via the app's real HTTP API. 1 competition, 3 tracks, 10 customer users, 10 participations, 3 teams + 5 members + 1 invitation, 3 projects, 4 criteria, 1 panel (2 judges + 3 tracks), 6 scores, 2 sponsors, 3 prizes, 3 peer votes, 2 incidents, 1 chat thread with 3 messages, 2 bulk invitations | 2026-08-20 |
| 10 | PRE-FLIGHT | P8 harness green twice | ✅ | **ZERO DELTAS across two consecutive full cycles**: writes 0/66, reads 0/2661 (15 quarantined), pages 0/160. `run.sh verify` exit 0 | 2026-08-20 |

### S1 → 0.5.0

| # | Stage | Gate | Verdict | Evidence | Date |
|---|-------|------|---------|----------|------|
| 11 | S1 | codemods | ✅ n/a | **Zero of the framework's 10 `auto-upgrade-0.4.10-to-0.5.0` codemods apply.** Meilisearch/Stripe/cron-parser/simplewebauthn/react-markdown/react-email: 0 matches. `lucide-brand-icons` matched 1 file (6 sites) but `Linkedin`/`Twitter` **still exist** in the installed `lucide-react@0.556.0` — that is an *app* pin the framework upgrade does not move, so the codemod's premise does not hold. Applying it would substitute a worse icon for no reason. Verified by `import * as L from 'lucide-react'` | 2026-08-20 |
| 12 | S1 | G1 install | ✅ | exit 0. Needed two fixes: `@mikro-orm/*` `^6.6.2`→`^6.6.10` (0.5.0 packages request `^6.6.10`; lockfile had pinned 6.6.9 → YN0060), and `zod` `^4.1.13`→`^4.4.3` to dedupe a nested `@open-mercato/search/node_modules/zod@4.4.3` | 2026-08-20 |
| 13 | S1 | G2 generate | ✅ | exit 0. **341 route files → 341 API paths** (0.4.8 was 332 → 310, silently dropping 22) | 2026-08-20 |
| 14 | S1 | G3 typecheck | ✅ | **exit 0, zero errors.** First run had 63, ALL in `node_modules`, none in `src/`: 61 from the duplicated zod (nominal type mismatch), 2 from missing `@types/semver`. Fixed by deduping zod + adding `@types/semver` and `@types/sanitize-html` | 2026-08-20 |
| 15 | S1 | G4 db:migrate | ✅ | exit 0 onto a restore of the 0.4.8 baseline. **9 migrations across 7 modules**: auth 2, customers 2, business_rules 1, customer_accounts 1, integrations 1, messages 1, sales 1 | 2026-08-20 |
| 16 | S1 | G5 build | ✅ | `yarn build` exit 0, static generation 4/4 | 2026-08-20 |
| 17 | S1 | G6 boot | ✅ | app ready on :3006, scheduler confirmed off | 2026-08-20 |
| 18 | S1 | G7 write replay | ✅ | **0 deltas / 66 writes** | 2026-08-20 |
| 19 | S1 | G8/G9 read+page replay | ✅ | 529 deltas triaged: **96 EXPECTED, 3 REGRESSION (core module, unused by this app), 0 UNCERTAIN**. **Zero deltas on app-module routes.** No data loss anywhere | 2026-08-20 |
| 20 | S1 | re-baseline @ 0.5.0 | ✅ | 0.4.8 baseline archived to `baseline/archive-0.4.8/`; new reference recorded: 66 writes, **3080 reads** (up from 2660 — new coverage), 160 pages, 0 error signals | 2026-08-20 |

### S2 → 0.6.0 (MikroORM 6 → 7)

| # | Stage | Gate | Verdict | Evidence | Date |
|---|-------|------|---------|----------|------|
| 21 | S2 | G1 install | ✅ | `@open-mercato/*` → 0.6.0, `@mikro-orm/*` → `^7.1.5` (7.1.13 resolved), added `@mikro-orm/decorators` + `reflect-metadata`. **`knex` is gone from node_modules; `kysely@0.29.5` is in.** exit 0, no project peer errors | 2026-08-20 |
| 22 | S2 | entity decorators | ✅ | all 8 `src/modules/*/data/entities.ts` → `@mikro-orm/decorators/legacy`. `FilterQuery` *type* stays on `@mikro-orm/core` (matches framework practice) | 2026-08-20 |
| 23 | S2 | persist/flush | ✅ | **`persistAndFlush`/`removeAndFlush` REMOVED in v7** — a breaking change the original analysis missed. 41 sites / 27 files converted to `persist(x)`+`flush()` / `remove(x)`+`flush()`. Framework did the same (0.4.8: 97 uses → 0.6.7: 0) | 2026-08-20 |
| 24 | S2 | G2 generate | ✅ | exit 0. Framework auto-detected the v7 migration and purged its stale generated cache | 2026-08-20 |
| 25 | S2 | G3 typecheck | ✅ | **exit 0.** First run: 41 errors, **all in `src/`, all TS2339**, all `persistAndFlush`/`removeAndFlush`. After conversion: 0 | 2026-08-20 |
| 26 | S2 | G4 db:migrate | ✅ | exit 0 onto the 0.4.8 baseline. **29 migrations across 10 modules**: customers 13, auth 5, ai_assistant 3, audit_logs 2, + 1 each for business_rules / customer_accounts / dictionaries / integrations / messages / sales. No errors | 2026-08-20 |
| 27 | S2 | knex → raw SQL | ✅ | 21 files ported by 5 parallel agents on disjoint sets. Zero knex artifacts remain in `src/` | 2026-08-21 |
| 28 | S2 | `ANY(?)` fix | ✅ | 8 sites (4 **pre-existing** in `bounties`) — see finding S2-F1 | 2026-08-21 |
| 29 | S2 | G5 build | ✅ | exit 0 | 2026-08-21 |
| 30 | S2 | **harness coverage fix** | ✅ | The first S2 verify was nearly worthless: **17 of 22 ported routes returned 400 before reaching any SQL**. Added a fixture-param variant (34 routes) → fixture 200s went ~3 → **76** | 2026-08-21 |
| 31 | S2 | G7 write replay | ✅ | **0 deltas / 66 writes** — includes the ported `UPDATE…FROM` and `UPDATE customer_users` write paths | 2026-08-21 |
| 32 | S2 | G8 read replay | ✅ | 235 deltas, **6 on app modules — both causes explained and benign** (see S2-A/S2-B). 180 `added` = new 0.6.0 routes | 2026-08-21 |
| 33 | S2 | G9 page replay | ✅ | **0 deltas / 160** | 2026-08-21 |
| 34 | S2 | subscriber log check | ✅ | No `syntax error`, no `getKnex is not a function`, no `ANY(...)` failures. Only the 3 pre-existing bugs already on record | 2026-08-21 |

**Porting policy for S2 (decided, and independently confirmed by the cookbook):** port everything
to `em.getConnection().execute<T>(sql, params)` with hand-written SQL rather than the kysely
builder. Rationale: it preserves exact SQL semantics, keeps snake_case result keys automatically,
turns dynamic query building back into plain string+array assembly, and avoids kysely type
gymnastics. The cookbook found **no framework precedent** for `UPDATE…FROM`, `DISTINCT ON`,
subquery joins, or `avg()` — and recommends exactly this fallback for them. Binding is `?`
positional with a params array; `execute()` returns a **plain array**, not `.rows`.
`src/modules/bounties/api/leaderboard/route.ts:42` is in-repo precedent.

**Reference:** `.ai/upgrade/KYSELY-PORTING-COOKBOOK.md` (1563 lines, every pattern cited to
framework source with file:line).

### S3 → 0.6.7

| # | Stage | Gate | Verdict | Evidence | Date |
|---|-------|------|---------|----------|------|
| 35 | S3 | G1 install | ✅ | `@open-mercato/*` → 0.6.7, `ai` `^6.0.146` → `^7.0.71`, `@ai-sdk/{anthropic,openai}` → `^4`. Needed two extra fixes: **`react-is`** (new peer of `@open-mercato/ui@0.6.7`, via recharts 3) and a **`resolutions: { typescript: ^5.9.3 }`** — something pulled `typescript@7.0.2` and Yarn's builtin TS compat patch crashed on it (`ENOENT … _tsc.js`) | 2026-08-21 |
| 36 | S3 | G2 generate | ✅ | exit 0. **411 route files → 411 API paths** (0.6.0 was 341) | 2026-08-21 |
| 37 | S3 | G3 typecheck | ✅ | **exit 0, zero errors — first try.** The `ai` 6→7 major needed **no app changes**: the app only uses `generateObject` + `anthropic`, in 2 `bounties` files | 2026-08-21 |
| 38 | S3 | G4 db:migrate | ✅ | exit 0. **41 migrations across 19 modules** (ai_assistant 7, customers 5, workflows 5, staff 4, auth 3, query_index 3, …) | 2026-08-21 |
| 39 | S3 | G5 build | ✅ | exit 0 | 2026-08-21 |
| 40 | S3 | G7 write replay | ✅ | **0 deltas / 66 writes** | 2026-08-21 |
| 41 | S3 | G8 read replay | ✅ | 382 deltas, **3 on app modules — all the known-benign `resolve-users` map ordering** (data verified byte-identical). 275 `added` = new 0.6.7 routes | 2026-08-21 |
| 42 | S3 | G9 page replay | ✅ | **0 deltas / 160** | 2026-08-21 |
| 43 | S3 | log check | ✅ | **no SQL errors, no subscriber handler errors** in the whole S3 run | 2026-08-21 |
| 44 | S3 | core-delta triage | ⏳ | 6 status + 98 body deltas on core routes, under triage | 2026-08-21 |

**S3 items that turned out to be non-issues** (all verified, not assumed):
- `DataTable.advancedFilter` — **not used anywhere in the app**, so the legacy-flat→tree migration
  the analysis flagged is moot.
- `recharts` 2→3 and `react-day-picker` 9→10 — **zero app files**, transitive only, as predicted.
- **The auth email-uniqueness reshape DID land at 0.6.7**: `users_email_unique` is gone, replaced
  by `users_tenant_email_hash_uniq`. It does not affect this app — every app query against
  `customer_users` is by **id**, and the one email lookup (`checkin`) is already tenant-scoped.
  The backend `users` table is never queried by app code.

## Accepted deltas

_(behavioural differences accepted, with justification)_

### S1-A: 23 portal pages now require authentication (SECURITY FIX — accept)

All 46 page deltas are the same change: `200 → 307` redirecting to
`/acme-corp/portal/login`. Broken down by principal:

| principal | portal session? | unchanged | changed | of which → 307 |
|---|---|---|---|---|
| alice | yes | **40** | 0 | 0 |
| bob | yes | **40** | 0 | 0 |
| admin | no (backend only) | 17 | **23** | 23 |
| anon | no | 17 | **23** | 23 |

Real portal users are completely unaffected. Only principals **without** a portal
session are redirected. At 0.4.8 those 23 portal pages — including `/portal/chat`,
`/portal/agenda`, `/portal/announcements`, `/portal/bounties/judge` — **rendered for
unauthenticated visitors**. 0.5.0 enforces the `requireCustomerAuth` declared in each
page's `page.meta.ts` server-side, via the `(frontend)` catch-all.

**Verdict: ACCEPT.** This is a security fix, not a regression, and it closes a real
exposure in the app as it stands on `main`.

### S1-B: 425 newly-covered routes (codegen fix — accept)

0.4.8 reported "Found 332 API route files → Generated 310 API paths", silently dropping
22 route files from the OpenAPI spec, including the app's own CRUD roots
(`/api/tracks/tracks`, `/api/teams/teams`, `/api/projects/projects`, `/api/judging/panels`,
`/api/sponsors/sponsors`). 0.5.0 reports 341 → 341. The `added` deltas are therefore new
**coverage**, not new behaviour.

Consequence: the 0.4.8 baseline never covered those routes, so they cannot be diffed
against it. **S2 must use the S1 (0.5.0) recording as its reference baseline.**

### S1-D: feature_toggles 403 → 200/404 for admin (RBAC wildcard fix — accept)

8 status deltas, all on `/api/feature_toggles/*` for the `admin` principal.

- The routes require `feature_toggles.view` (verified in the installed 0.5.0
  `feature_toggles/api/{overrides,global}/route.ts`).
- The admin role's `role_acls.features_json` contains **`feature_toggles.*`** — a scoped
  wildcard. It does **not** contain a bare `*` (111 grants, checked).
- So at 0.4.8 the wildcard `feature_toggles.*` was NOT being expanded to satisfy
  `feature_toggles.view`, and the admin was wrongly denied. 0.5.0 resolves it correctly.

This is the exact defect the framework's own 0.6.7 AGENTS.md warns about: *"Never compare
raw feature arrays with exact string checks when wildcard grants apply."*

**Verdict: ACCEPT — a fix, not a hole.** The grant is module-scoped, only that module's
routes changed, and no principal without an explicit grant gained access (`anon`,
`alice`, `bob`, `carol` are unchanged on these routes).

### S2-A: `resolve-users` row order (accept)

`GET /api/competitions/portal/resolve-users` returned the same 3 users with identical data but
in a different order (Dana/Evan/Fiona → Fiona/Dana/Evan). Investigated rather than assumed:

- The query has **no `ORDER BY`** — it never did, and the port preserved that faithfully.
- Order is **stable within a run**: 3 consecutive live calls at 0.6.0 returned
  `Dana | Evan | Fiona` every time, matching 0.5.0.
- The difference is between *migration paths*, not ORM versions: the 0.5.0 baseline DB had
  **9** migrations applied, the 0.6.0 run had **29** (customers alone contributes 13, rewriting
  `customer_users`), which changes physical heap order for an unordered scan.
- The response is a **map keyed by user id**, so ordering is semantically irrelevant to consumers.

**Verdict: ACCEPT.** Not a port regression. Latent nondeterminism (unordered query) left as-is
per the preserve-behaviour rule; filed as a follow-up.

### S2-B: `current-demo` `server_time` (harness gap, fixed)

`GET /api/judging/portal/current-demo` reported a body delta on every run solely because
`server_time` is epoch **milliseconds as a NUMBER**. The normaliser's timestamp regex only
matches strings, and numbers pass through untouched. Fixed by adding `server_time` (and
`generated_at`, `last_modified`, `request_id`) to `VOLATILE_KEYS`. **Not a regression.**

### S1-E: routine additive core changes (accept, 88 deltas)

Verified additive-only, item and total counts identical in every case:
`/api/customers/people` `/companies`, `/api/catalog/variants`, `/api/auth/users`
(new fields only); `/api/directory/organization-switcher` (+`canViewAllOrganizations`);
`/api/scheduler/targets` (commands 263→275, **12 added / 0 removed**);
`/api/customers/todos` (`totalPages 0→1` on an empty result); `/api/configs/upgrade-actions`
(version string); `/api/customers/deals/{id}` (401 message text — 0.5.0 adds route metadata so
the framework guard rejects before the handler); `/api/integrations` (now honours `pageSize`).

Two that are benign here but are **breaking contract changes for other consumers**:
- `/api/ai_assistant/tools`: 4→3 tools; `discover_schema`/`find_api`/`call_api` replaced by
  `search`/`execute` ("Code Mode" redesign). Breaks anything hardcoding tool names.
- `/api/configs/system-status`: `FORCE_QUERY_INDEX_ON_PARTIAL_INDEXES` *advertised default*
  moved `true→false`. No effect here (explicitly set in `.env`), but any deployment relying on
  the implicit default flips behaviour.

### S1-C: 1 removed route (codegen fix — accept)

`/api/attachments/image/{id}/{[...slug}]` — a malformed generated path (note the mangled
brackets) present at 0.4.8 and gone at 0.5.0.

## Corrections to the analysis doc

1. **R1 was materially understated.** The original figure (21 files / ~24 sites / 3 modules,
   "mostly mechanical") came from a `getKnex` file grep. A full survey found **26 files,
   55 distinct query sites, 5 modules** (adds `bounties` and `tracks`), of which **15 are HARD**
   — `DISTINCT ON`, `UPDATE…FROM`, subquery-as-join-target, `clone().clearSelect()`, dynamically
   interpolated `orderBy` columns, and nested `knex.raw` used as a where-value.
   `.ai/upgrade/UPGRADE-0.6.7-ANALYSIS.md` §3 R1 has been rewritten with the real table.
2. **Good news within that:** the `em.getConnection().execute()` sites (most of `bounties`,
   the one `tracks` site, and two `competitions/api/admin` routes) are **already in the
   0.6.7-compatible form and need no change**.
3. **Two subscribers use `getKnex()`** — `competitions/subscribers/notify-team-invitation.ts`
   and `notify-member-joined.ts`. They run out-of-band, so the API-contract replay will **not**
   cover them. They need a dedicated check at S2.

## Skipped

- None yet.

## Follow-up backlog

_(out-of-scope items discovered during the upgrade)_

0. **`GET /api/teams/resources` is broken (500)** — see R-2. One-line fix in
   `src/modules/teams/api/resources/route.ts:6`. **Highest-value item in this list.**
0b. **`feature_toggles.*` now also grants `feature_toggles.manage`.** At 0.4.8 the routes were
   `requireRoles: ['superadmin']`; at 0.5.0 they are feature-gated, and `setup.ts` grants
   `admin: ['feature_toggles.*']`. So tenant admins can now **write** feature toggles where
   previously only superadmin could. Intended by the framework, but worth an explicit decision.
1. **Yarn toolchain was broken on `main`.** A Berry-format lockfile with no
   `packageManager` field means a fresh clone with Yarn classic on PATH cannot install.
   Fixed here on the upgrade branch; worth cherry-picking to `main` independently.
2. **98 hand-written write routes** bypass the mutation-guard contract
   (`runMutationGuards` registry). Out of scope per the plan; file as hardening work.
3. **MikroORM migration snapshots may need regenerating at S2.** The repo tracks
   `src/modules/*/migrations/.snapshot-open-mercato.json` (5 files, named after the canonical
   `open-mercato` DB). MikroORM 7 may change the snapshot format; if `yarn db:generate` rewrites
   them, that diff is part of the upgrade and must be committed deliberately, not by accident.
   The `.snapshot-om_upgrade.json` files this work produced are gitignored as local artifacts.
4. **0 `withAtomicFlush` usages** against 42 `em.flush()` / 38 `persistAndFlush` /
   271 `em.find(One)` sites. Audit deferred to the S4 report.

## Findings (pre-existing at 0.4.8 — NOT upgrade regressions)

Recorded now so they are never mistaken for upgrade damage later.

1. **Three core routes race on cold start under concurrent load.** At sweep
   concurrency 4, `GET /api/dashboards/layout`, `GET /api/customers/pipeline-stages`
   and `GET /api/search/index` intermittently returned **500 with an empty body**.
   Hitting each 12x **sequentially** on the same build returned 200 every time.
   These are genuine first-hit initialisation races in `@open-mercato` 0.4.8, not
   harness artifacts. The sweep now runs sequentially so the baseline is trustworthy;
   the races themselves are a **framework bug worth reporting upstream**.
2. **`GET /api/workflows/events/{id}` returns 500 for a non-existent id.** CORRECTED: the app
   log shows `invalid input syntax for type bigint` — `workflow_events.id` is a **bigint**, and the
   harness supplies a uuid sentinel. So this is largely a harness artifact; the residual (minor)
   app issue is that the route surfaces a driver exception as a 500 instead of validating the id
   and returning 400/404. Low priority.

3. **`teams.invitation.created` subscriber has NEVER worked.** Found via the app log during S1
   (the HTTP replay cannot see it — subscribers run out-of-band and the route still returns 201):
   ```
   [events] Handler error for "teams.invitation.created":
   Error: Undefined binding(s) detected when compiling FIRST. Undefined column(s): [id]
     query: select "name" from "teams_team" where "id" = ? limit ?
     at src/modules/competitions/subscribers/notify-team-invitation.ts:29
   ```
   Cause: `src/modules/teams/api/invitations/route.ts:36` declares
   `events: { module: 'teams', entity: 'invitation' }`, so the CRUD factory **auto-emits** the
   event with its generic payload (`id` / `tenantId` / `organizationId`). But
   `notify-team-invitation.ts` reads `payload.teamId`, which nothing in the codebase ever sets —
   grep confirms `teams.invitation.created` is emitted only by the factory. So the team-invitation
   notification has been silently broken since it was written. **Pre-existing, not an upgrade
   regression.** Filed as backlog item; the S2 port must preserve behaviour, not fix it inline.
3. **Yarn toolchain was unusable on `main`** — see backlog item 1.

## Decisions taken

- **Fixtures: seed through the app's own API** (user decision). Higher fidelity than direct SQL —
  keeps `query_index`, search index and events consistent, and exercises write paths on the way in.
- **Baseline depth: deep on everything** (user decision). Full normalised response bodies for all
  API routes across all three principals, not just the knex-touching ones. Converts directly into
  the S4 Playwright suite.
- **Determinism:** `AUTO_SPAWN_WORKERS=false`, `SCHEDULE_AUTO_REINDEX=false` **and
  `AUTO_SPAWN_SCHEDULER=false`** in `.env` so background jobs cannot mutate data between runs.
  `run.sh` hard-fails if it sees the scheduler start. Must stay off at every stage.
- **Sweep runs sequentially** (`OM_HARNESS_CONCURRENCY=1`). Concurrency 4 was ~4x faster but
  not reproducible — see finding 1. A baseline that randomly contains 500s cannot be diffed.
- **"Deep on everything" is split by necessity.** 315 of the 520 operations are mutating and
  cannot be blindly replayed without destroying reproducibility. So: `seed.mjs` is the
  write-path baseline (a scripted, ordered, recorded write sequence) and `sweep.mjs` covers
  all 205 reads deeply. Together this is full coverage; blind-firing POSTs would not be.

## S2 preparation (verified against published 0.6.0 metadata)

**No `auto-upgrade-0.5.0-to-0.6.0` skill exists.** `@open-mercato/cli@0.6.0` ships only
`auto-upgrade-0.4.10-to-0.5.0`. S2 is entirely manual.

Dependency requirements introduced at 0.6.0:

| package | requirement | note |
|---|---|---|
| `@mikro-orm/core` | `^7.0.14` | **the wall** |
| `@mikro-orm/postgresql` | `^7.0.14` | knex → kysely |
| `@mikro-orm/migrations` | `^7.0.14` | |
| `@mikro-orm/decorators` | `^7.0.14` | **new package** — entity decorators move here |
| `reflect-metadata` | `^0.2.2` | **new** — must load before entities |
| `semver` | `^7.7.4` | |
| `sanitize-html` | `^2.17.2` | |
| `ai` | `^6.0.168` | still v6 at 0.6.0; the 6→7 jump lands at **0.6.6**, i.e. in S3 |

Since `^7.0.14` admits `7.1.5` (what 0.6.7 wants), S2 will install `^7.1.5` directly to
avoid a second MikroORM bump in S3.

## S2-F3: two NEW core routes 500 at 0.6.0

`GET /api/customers/interactions/counts` and `/api/customers/interactions/conflicts` — both
introduced at 0.6.0, both return `{"error":"Internal server error"}`. They are part of the
`customers.interactions` feature which defaults to `unified: false` (see R-1), so they appear to
500 rather than degrade gracefully when the flag is off.

**Does not affect this app** — it does not use customer interactions. Framework issue; report
upstream alongside R-1.

## S2-F1: `= ANY(?)` is broken under MikroORM 7 (8 sites, 4 pre-existing)

The single most important find of S2, and one the replay could never have caught on its own.

MikroORM 7's `connection.execute()` does **not** bind parameters. `AbstractSqlConnection.prepareQuery`
calls `platform.formatQuery()`, which textually inlines every `?`, then hands the finished string
to kysely as `CompiledQuery.raw(...)`. `BasePostgreSqlPlatform.escape()` renders a JS **array** as
a comma-joined list of quoted literals — *not* a Postgres array literal. Verified against the real
platform:

```
formatQuery('... id IN (?)',   [['a','b']])  ->  ... id IN ('a', 'b')      OK
formatQuery('... id = ANY(?)', [['a','b']])  ->  ... id = ANY('a', 'b')    SYNTAX ERROR
```

Three of the five porting agents discovered this independently and used `IN (?)`; one did not and
used `= ANY(?)`. **Four further sites were pre-existing app code** — `bounties/api/portal/judge/prs`
and `bounties/data/enrichers` — which already used `execute()` with `= ANY(?)` before this upgrade.

All 8 converted to `IN (?)`; every site sits behind a `length > 0` guard so `IN ()` is unreachable,
and escaping still goes through `escapeLiteral`, so there is no injection risk.

**The replay cannot verify the 4 bounties sites** — the fixture has no bounties data (GitHub-backed,
not seedable), so those code paths are unreachable in testing. They are correct by construction and
by the platform test above, but they are the least-verified change in this upgrade.

## S2-F2: `yarn generate` does not purge stale generated bundles

When reverting the code from 0.6.0 to 0.5.0 to re-record a baseline, `yarn generate` succeeded but
`.mercato/generated/di.generated.mjs` still contained `import … from "@mikro-orm/decorators/legacy"`
inlined from the 0.6.0 entities, so the app died at boot with
`Cannot find package '@mikro-orm/decorators'`. `rm -rf .mercato/generated` before regenerating fixes
it. Going *forward* 0.5.0 → 0.6.0 the framework detects the v7 migration and purges automatically;
going backward it does not. Relevant to anyone bisecting or rolling back.

## S2 schema findings

1. **The auth email-uniqueness reshape has NOT landed at 0.6.0.** After migrating, `users` still
   carries the **global** `users_email_unique` btree index. The tenant-scoped partial index
   (`users_tenant_email_hash_uniq` on `(tenant_id, email_hash)` over live rows) described in
   0.6.7's entity comments arrives later in the 0.6.x line. **This is an S3 concern, not S2** —
   re-check it after the 0.6.7 bump, and only then audit for code assuming globally-unique emails.

2. **App module migrations contain FULL-SCHEMA dumps, including core tables.**
   `src/modules/projects/migrations/Migration20260329045045.ts` and
   `src/modules/competitions/migrations/Migration20260331002513.ts` each create/alter core tables
   they have no business owning — `users`, `inbox_emails`, `onboarding_requests`,
   `customer_users`, and many more (893+ lines in one case). This is the classic
   `mikro-orm migration:create` footgun: the diff was taken against the whole metadata graph
   rather than the module's own entities.

   It is not blocking (these were already applied at `initialize`, and migrations are tracked
   per module), but it is a real hazard: on a fresh install the ordering between an app module's
   full-schema migration and the core module's own migrations is not guaranteed, and a future
   core schema change can collide with a stale copy frozen inside an app migration.
   **Filed as a follow-up — do not attempt to fix during the upgrade.**

## REGRESSIONS found (not caused by this app, but must be tracked)

### R-1 (framework, does NOT affect this app): `/api/customers/activities` loses custom fields

0.5.0 rewrote the route as a `@deprecated` compatibility bridge (SPEC-046b). Row count is
unchanged (11/11) but every item lost its custom-field data: `customFields[]` removed, the
flattened `cf_*` keys removed, and `customValues` hardcoded to `null` at
`core/src/modules/customers/api/activities/route.ts:238`. The 0.4.8 `decorateCustomFields`
block is gone. The shipped 0.5.0 admin UI still reads those fields
(`components/detail/ActivitiesSection.tsx:322`), so the custom-fields block renders empty.
The canonical successor `/api/customers/interactions` returns `{"items":[]}` because
`customers.interactions.unified` defaults to `false` — so nothing serves this data at present.

**Impact on THIS app: none.** `grep -rl "customers/activities|customer_activity|CustomerActivity" src/`
returns nothing — the app does not use customer activities. **Report upstream; do not block on it.**

### R-2 (pre-existing APP bug, newly visible): `GET /api/teams/resources` returns 500

```
[QueryEngine] Could not resolve entity "teams:resource" via ORM metadata.
Falling back to table name "resources".
[crud] unexpected error: select * from "resources" - relation "resources" does not exist
```

Cause: the entity class is `TeamResource` (`src/modules/teams/data/entities.ts:202`,
`tableName: 'teams_resource'`), so codegen emits the id **`teams:team_resource`**
(`.mercato/generated/entities.ids.generated.ts:264`). But
`src/modules/teams/api/resources/route.ts:6` hardcodes `ENTITY_ID = 'teams:resource'`.
Resolution fails, the QueryEngine falls back to the bare table name `resources`, which does
not exist.

**Pre-existing — not caused by the upgrade.** It was invisible at 0.4.8 only because that
version's OpenAPI codegen dropped this route from the spec, so the baseline never called it.
Fix is one line (`'teams:resource'` → `'teams:team_resource'`), but it is an **app bugfix, not
upgrade work**, so it is filed rather than fixed inline — mixing it in would make the upgrade
diff harder to review. It is stable at 500, so it does not impede S2/S3 comparison.

## Coverage gaps (explicit — the baseline does NOT cover these)

1. **Bounties PR submission.** `POST /api/bounties/portal/submit-pr` calls a real GitHub API
   via Octokit against `GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` with `GITHUB_TOKEN`; none are set,
   and the PR must genuinely exist upstream. So `bounties_pull_request` and
   `bounties_activity_log` are **empty** in the fixture, and the bounties read routes are only
   covered in their empty state. `bounties` has 11 raw-SQL sites — but all are already
   `em.getConnection().execute()`, which survives MikroORM 7 unchanged, so the risk is low.
   To close this gap, point `GITHUB_REPO_*` at a scratch repo with a few real PRs.
2. **`GET /api/events/stream`** is skipped — it is SSE and never closes the response. It hung
   the first sweep for 7 minutes before the timeout guard was added.
3. **`GET /api/audit_logs/audit-logs/access`** is quarantined from the diff: it records the
   harness's own traffic and so differs by construction (15 entries).
4. **Subscribers are only weakly covered.** `notify-team-invitation` and `notify-member-joined`
   (both use `getKnex()`) are fired by seed step 33 (team invitation), but they run out-of-band
   and their failure would not surface in any HTTP response. **S2 must check the app log for
   subscriber errors explicitly**, not rely on the replay.

## Blocked

- None.

## Notes

- Sibling repo `~/projects/auroria-open-mercato` pins `yarn@4.12.0` and carries
  `packageExtensions` for `cmdk`, `ts-jest`, `@radix-ui/react-tooltip`,
  `@testing-library/react`, `react-big-calendar`. `cmdk` is a **new** `@open-mercato/ui`
  dependency at 0.6.7 — if G1 fails on peer resolution at S2/S3, that file is the
  known-good reference for the required `packageExtensions`.
