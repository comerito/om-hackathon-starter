# Open Mercato 0.4.8 → 0.6.7 — Upgrade Report

Branch `chore/upgrade-om-0.6.7`. All framework packages now at **0.6.7**.

---

## 1. Outcome

| | |
|---|---|
| Framework | `0.4.8` → **`0.6.7`** (13 packages) |
| MikroORM | `6.6.9` → **`7.1.13`** (knex → kysely) |
| AI SDK | `ai@6.0.146` → **`ai@7.0.71`** |
| Node/TS | unchanged (Node 24, TS 5.9.3 — pinned via `resolutions`) |
| API routes discovered | 310 → **411** |
| DB migrations applied | **79** across three stages (9 + 29 + 41) |
| App code changed | 49 files |
| `yarn typecheck` | **0 errors** |
| `yarn build` | **passes** |

### Verification at 0.6.7, against a 0.6.0 baseline

| check | result |
|---|---|
| write replay (66 scripted API writes) | **0 deltas** |
| page replay (40 pages × 4 principals) | **0 deltas** |
| read replay — app-module routes | **0 real deltas** (3 quarantined: verified-identical map ordering) |
| app log: SQL errors | **none** |
| app log: subscriber handler errors | **none** |
| Playwright integration specs | **4/4 pass** |

---

## 2. What actually changed in app code

| change | files | caught by |
|---|---|---|
| Entity decorators → `@mikro-orm/decorators/legacy` | 8 | `tsc` |
| `persistAndFlush`/`removeAndFlush` → `persist`+`flush` | 27 (41 sites) | `tsc` |
| knex → raw SQL via `execute()` | 21 | **nothing — replay only** |
| `= ANY(?)` → `IN (?)` | 5 (8 sites) | **nothing — platform test only** |
| Removed disabled `example` module | −103 files | — |

`tsc` caught 49 of the 90 changed call sites. **The other 41 were invisible to it**, because every
knex call site was written as `(em as any).getConnection().getKnex()`. That is the single most
important fact about this upgrade.

---

## 3. The five things that would have shipped broken

Each of these was invisible to the compiler and to a status-code smoke test.

1. **`getKnex()` removed** — 21 files, 55 query sites. Every one behind `as any`.
2. **`= ANY(?)` is a syntax error under MikroORM 7.** `execute()` *inlines* parameters rather than
   binding them; a JS array renders as `'a', 'b'`, so `ANY('a','b')` fails to parse. **Four of the
   eight sites were pre-existing app code** in `bounties` that this upgrade broke.
3. **`persistAndFlush` removed in v7** — 41 sites. Not in the original analysis; found by `tsc`.
4. **`teams.invitation.created` subscriber has never worked** — the route auto-emits the CRUD
   factory's generic payload, but the subscriber reads `payload.teamId`, which nothing sets.
   Only visible in the app log; the HTTP response is a clean 201.
5. **`GET /api/teams/resources` 500s** — the route hardcodes entity id `teams:resource` while the
   `TeamResource` class generates `teams:team_resource`. Pre-existing; invisible at 0.4.8 only
   because that version's codegen silently dropped the route from the OpenAPI spec.

---

## 4. Accepted behavioural changes

| id | change | verdict |
|---|---|---|
| S1-A | 23 portal pages now redirect unauthenticated visitors to login | **security fix** — at 0.4.8 the participant portal rendered for anyone. Real portal sessions (alice/bob) unaffected, 40/40 unchanged. |
| S1-D | `feature_toggles/*` 403 → 200 for admin | **RBAC fix** — the admin role holds the scoped wildcard `feature_toggles.*` (no bare `*`); 0.4.8 failed to expand it. Note it also now grants `.manage`. |
| S1-B | 425 routes newly covered | **codegen fix** — 0.4.8 emitted 310 of 332 route files; 0.5.0 emits 341/341. |
| S1 | `audit-logs/actions` now honours `pageSize` | pagination fix; `default` variant still returns all 40. |
| S2-A | `resolve-users` map ordering | same data, unordered query, order follows physical heap layout after a different migration set. |

---

## 5. Known issues — filed, deliberately NOT fixed

Fixing these inside the upgrade would have made the diff unreviewable. All are pre-existing.

| # | issue | effort |
|---|---|---|
| **R-2** | `GET /api/teams/resources` 500s — `ENTITY_ID` should be `teams:team_resource` | **one line** |
| — | `teams.invitation.created` subscriber reads a payload field nothing emits | small |
| — | App module migrations (`projects`, `competitions`) contain **full-schema dumps** creating core tables (`users`, `inbox_emails`, …). Fresh-install ordering hazard. | medium |
| — | `my-invitations` / `my-membership` look up `customer_users` with **no tenant filter** — latent cross-tenant read of name/email | small |
| — | 98 hand-written write routes bypass the `runMutationGuards` contract | large |
| — | 0 uses of `withAtomicFlush` against 42 `em.flush()` sites | audit |
| — | `jest.config.cjs` is referenced by `yarn test` but does not exist | trivial |

### Framework issues to report upstream

| # | issue |
|---|---|
| **R-1** | `/api/customers/activities` drops all custom-field data at 0.5.0 (`customValues` hardcoded `null`); the shipped admin UI still reads it, and the successor `/interactions` API returns `[]` because `unified` defaults false. **This app does not use it.** |
| S2-F3 | `/api/customers/interactions/{counts,conflicts}` return 500 at 0.6.x when the feature flag is off |
| S2-F2 | `yarn generate` does not purge stale generated bundles when moving *backwards* between versions |
| — | `dashboards/layout`, `customers/pipeline-stages`, `search/index` race on cold start under concurrency, returning 500 with an empty body |
| — | `/api/workflows/events/{id}` surfaces a driver exception as 500 instead of validating the id |

---

## 6. What the app gained

- **A regression suite where there was none.** 0 tests before; now a replay harness
  (`yarn upgrade:verify`) covering 66 writes / ~3,400 reads / 160 page renders, plus 4 Playwright
  integration specs (`.ai/qa/tests/`) pinning the specific defects found here.
- **A working toolchain.** `main` could not `yarn install` from a clean clone — Berry lockfile,
  no `packageManager` pin.
- **Refreshed agent instructions** matching 0.6.7 conventions.
- **12% less code** — the dead `example` module is gone.

---

## 7. How to verify this yourself

```bash
git checkout chore/upgrade-om-0.6.7
corepack yarn install
cp .env.example .env          # point DATABASE_URL at a THROWAWAY database
corepack yarn initialize
bash .ai/upgrade/harness/reset.sh init     # snapshot the clean state
yarn upgrade:record                        # record a baseline
yarn upgrade:verify run2                   # must report zero deltas
```

Baselines for each stage are archived under `.ai/upgrade/baseline/archive-*/`.

---

## 8. Residual risk, stated plainly

- **The 4 `bounties` `ANY(?)` fixes are the least-verified change in this upgrade.** The fixture
  has no bounties data — PR submission requires a real GitHub repo and token — so those code paths
  were never executed. They are correct by construction and by a direct platform test, but they
  were not exercised end-to-end. **Point `GITHUB_REPO_OWNER/NAME/TOKEN` at a scratch repo with a
  few real PRs and re-run the harness before trusting bounties in production.**
- Subscribers run out-of-band; the replay cannot see them. The app log was checked manually at
  each stage instead.
- The baseline exercises one competition with 3 teams and 3 projects. Behaviour at real hackathon
  data volumes (hundreds of participants) is not covered.
- The 0.6.7 core deltas on `customers/*` routes were triaged but this app does not use those
  modules, so they received less scrutiny than the app's own surface.
