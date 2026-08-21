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
| self-consistency: two full cycles at 0.6.7 | **`VERIFY CLEAN — zero deltas`** (0/66 writes, 0/3701 reads, 0/160 pages) |

---

## 2. What actually changed in app code

| change | files | caught by |
|---|---|---|
| Entity decorators → `@mikro-orm/decorators/legacy` | 8 | `tsc` |
| `persistAndFlush`/`removeAndFlush` → `persist`+`flush` | 27 (41 sites) | `tsc` |
| knex → raw SQL via `execute()` | 21 | **nothing — replay only** |
| `= ANY(?)` → `IN (?)` | 5 (8 sites) | **nothing — platform test only** |
| `bootstrap.ts`: register command loaders + code workflows | 1 | **nothing — delta triage only** |
| Removed disabled `example` module | −103 files | — |

`tsc` caught 49 of the 91 changed call sites. **The other 41 were invisible to it**, because every
knex call site was written as `(em as any).getConnection().getKnex()`. That is the single most
important fact about this upgrade.

---

## 3. The seven things that would have shipped broken

Each of these was invisible to the compiler and to a status-code smoke test.

1. **`getKnex()` removed** — 21 files, 55 query sites. Every one behind `as any`.
2. **`= ANY(?)` is a syntax error under MikroORM 7.** `execute()` *inlines* parameters rather than
   binding them; a JS array renders as `'a', 'b'`, so `ANY('a','b')` fails to parse. **Four of the
   eight sites were pre-existing app code** in `bounties` that this upgrade broke.
3. **`persistAndFlush` removed in v7** — 41 sites. Not in the original analysis; found by `tsc`.
4. **`teams.invitation.created` subscriber has never worked** — the route auto-emits the CRUD
   factory's generic payload, but the subscriber reads `payload.teamId`, which nothing sets.
   Only visible in the app log; the HTTP response is a clean 201.
5. **`commandLoaderEntries` never registered.** 0.6.7 made command registration **lazy**
   (`commandRegistry.list()` is now `handlers ∪ loadersById`). `src/bootstrap.ts` was still written
   against the 0.6.0 `BootstrapData` shape, so the loaders were never registered:
   `/api/scheduler/targets` listed **109 of 287** commands — whatever other imports happened to
   pull in, i.e. nondeterministic. The bigger hazard was runtime: `CommandBus.resolveHandler`
   also falls back to the loader registry, so **any core command whose file was not already
   imported in that process would throw `Command handler not registered for id …`**.
   Fixed; commands 109 → **303**.
6. **`codeWorkflows` never registered.** `Migration20260716120000` deliberately soft-deletes the
   persisted `workflows.checkout-demo` seed row so the maintained **code** definition takes over.
   With `codeWorkflows` unwired the code definition never loaded, so the workflow simply
   **disappeared** (4 → 3 definitions). Fixed; back to 4 with `code:workflows.checkout-demo`.
7. **`GET /api/teams/resources` 500s** — the route hardcodes entity id `teams:resource` while the
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

## 8. Production-mode findings (added after the fact — my verification was dev-only)

**Everything in sections 1-7 was verified in `yarn dev`.** Running the app under `yarn start`
(the production build) afterwards surfaced three failures that dev mode does not exhibit.
This is a real weakness in how the upgrade was verified, not a footnote.

### P-1 (PRE-EXISTING) — **FIXED**: chat send 500s in production builds

```
[portal/chat] POST error: ValidationError: Trying to persist not discovered entity of type
Message. Entity with this name was discovered, but not the prototype you are passing to the ORM.
```

Turbopack's production chunking loads the `Message` entity module twice, so the class the route
instantiates is not the prototype registered with the ORM. `POST /api/competitions/portal/chat`
returns 500 for every message.

**Not caused by this upgrade — verified by experiment.** I checked out the 0.5.0 tree
(MikroORM 6, before any port), rebuilt, and reproduced the identical error. Comparison:

| | chat 500 / entity-prototype | `Could not resolve 'em2'` |
|---|---|---|
| 0.5.0 production | **present** | absent |
| 0.6.7 production | **present** | **present** |

So portal chat has been broken in production builds since before the upgrade. Dev mode works,
which is presumably why it went unnoticed.

**Root cause.** `@open-mercato/core` publishes BOTH `src/*.ts` and a compiled `dist/*.js`; its
`exports` map serves `dist`, while `next.config.ts` lists the package in `transpilePackages`.
Next therefore compiles the package *source* for some importers and resolves the published
*dist* for others — two module instances of the same file, two identically-named `Message`
classes. The route held one; the ORM registry held the other.

**Fix.** `src/lib/orm/entity-class.ts` — `newOrmEntity(em, Cls)` looks the constructor up by name
in the ORM's own metadata (`em.getMetadata().getAll()`), so module identity stops mattering. It
falls back to the passed class when metadata is unavailable, so it can never be worse than the
status quo. Applied to `Message` / `MessageRecipient` in the chat route.

**Rejected alternatives, and why:**
- *Drop `@open-mercato/core` from `transpilePackages`* — collapses the duplication, but core's
  `dist` is then pulled into the client graph and the build fails on `fs` / `net` / `tls` /
  `child_process`. `serverExternalPackages` is mutually exclusive with `transpilePackages`.
- *Write the message with raw SQL* — `messages.subject` and `messages.body` are declared
  encrypted (`core/modules/messages/encryption.ts`), so a raw `INSERT` would bypass the
  encryption hooks and silently store plaintext.

**Verified fixed**, production build, in the framework's encryption-active ephemeral environment:
seed goes from *64 writes / 1 error* to **66 writes / 0 errors**; entity-prototype errors
**3 → 0**; the spec suite is **5/5**; and the stored body is confirmed ciphertext
(`NgcmiWiUr0HPvjPZ:nNom0HemSFbXHqGCUA==:...`), proving the ORM encryption hook still runs.

### P-2 (NEW at 0.6.7, framework bug): mutation-guard service dies under minification

```
CRUD mutation guard service could not be resolved; the legacy guard bridge is disabled
AwilixResolutionError: Could not resolve 'em2'.  Resolution path: crudMutationGuardService -> em2
```

`node_modules/@open-mercato/shared/src/lib/di/container.ts:183` registers:

```ts
crudMutationGuardService: asFunction((em: EntityManager) => createOptimisticLockGuardService({...}))
```

That is Awilix **CLASSIC** injection — it resolves dependencies by *parameter name*. The production
build minifies `em` to `em2`, Awilix looks for a registration called `em2`, and fails. The service
is what provides **OSS optimistic locking**, so optimistic-lock guards are **silently disabled in
any minified production build**. Absent at 0.5.0, present at 0.6.7.

**Report upstream.** The fix is on the framework side: destructure the cradle
(`asFunction(({ em }) => ...)`) or declare `.inject()` explicitly.

### P-3: `yarn start` needs New Relic configuration

`"start": "NODE_OPTIONS='-r newrelic' mercato server start"` fails to bootstrap with
*"New Relic requires that you name this application!"*. It does not block startup, but every
production boot logs the error. Set `NEW_RELIC_APP_NAME` (or `NEW_RELIC_ENABLED=false`).

### What the framework's own runner showed

`yarn test:integration:ephemeral` works end-to-end: it provisions a testcontainers Postgres,
builds, boots a **production** server on :5001, installs Chromium, and runs the specs. Two things
came out of using it:

- My `test:integration` script was **recursive** — the CLI shells out to `yarn run test:integration`
  (`integration.js:2444`), and I had pointed that script back at `mercato test:integration`. Fixed
  to invoke Playwright directly.
- Its database is a **fresh 0.6.7 install with encryption active**, whereas my entire baseline ran
  against a 0.4.8 database migrated forward with encryption inactive. That difference is what
  exposed P-1 and the encryption finding below.

### Encryption: raw-SQL reads return ciphertext

`customer_users.display_name` and `.email` are declared encrypted
(`customer_accounts/encryption.ts:8`). **All 21 ported files read them via raw SQL, which bypasses
the ORM's decryption layer.** In the ephemeral environment `resolve-users` returned
`"DkLmYKrnsdcFd9Aw:9WOtobA2EtUab1x/wA==:..."` instead of a name.

**Pre-existing** — knex bypassed decryption in exactly the same way, so the ports changed nothing.
But it means: **wherever tenant encryption is actually active, these portal endpoints return
ciphertext to users.** My local database stores these columns in plaintext, which is why neither
the baseline nor the harness ever caught it.

## 9. Residual risk, stated plainly

- **All verification in sections 1-7 was dev-mode only.** Production mode was exercised only
  afterwards, and immediately found P-1/P-2. Treat "zero deltas" as a statement about dev mode.
- **The baseline database has encryption inactive**, so nothing in it tests encrypted-column
  behaviour. See the encryption finding above.
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
