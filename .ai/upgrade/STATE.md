# Upgrade State — 0.4.8 → 0.6.7

Branch: `chore/upgrade-om-0.6.7`
Current stage: **S1 → 0.5.0 (in progress)**
Current gate: S1 G6-G9 delta triage
Iterations: 2

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
| 19 | S1 | G8/G9 read+page replay | ⏳ | 483 sweep deltas (425 `added`, 5 `removed`, 8 `status`, 45 `body`) + 46 page deltas — under triage | 2026-08-20 |

## Accepted deltas

_(behavioural differences accepted, with justification)_

- None yet.

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
