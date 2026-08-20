# Loop Prompt — Open Mercato 0.4.8 → 0.6.7 upgrade

Paste the block below into a fresh Claude Code session at the repo root.
It is written to be re-pasted verbatim on every loop iteration; the agent
resumes from `.ai/upgrade/STATE.md` rather than restarting.

Recommended invocation:

```
/loop 30m  <paste the prompt below>
```

Or, if you want the agent to self-pace between iterations, drop the interval:

```
/loop  <paste the prompt below>
```

---

## THE PROMPT

````text
You are driving the Open Mercato framework upgrade of this app from 0.4.8 to 0.6.7.

# Ground truth — read these FIRST, every iteration
1. `.ai/upgrade/UPGRADE-0.6.7-ANALYSIS.md` — the measured breaking-change inventory. Trust it;
   it was produced by diffing the published 0.4.8 and 0.6.7 tarballs against this repo. Do not
   re-derive it. If you discover it is wrong about something, correct the file and say so.
2. `.ai/upgrade/STATE.md` — the live ledger. If it does not exist, you are on iteration 1:
   create it from the template at the bottom of this prompt and start at PRE-FLIGHT.
3. `AGENTS.md` — the repo's standing rules. They still bind you, with one amendment: during this
   upgrade you MAY run `yarn db:migrate` without asking, but ONLY against the `om_upgrade`
   database, and only after confirming `DATABASE_URL` points there.

# Prime directive
Advance the upgrade by exactly ONE gate per iteration, verify it, write the result to STATE.md,
and stop. Never skip a gate. Never start a stage before the previous stage's gate ladder is green.
A half-finished stage recorded honestly is worth more than a claimed-complete stage that is not.

# Stage plan (from the analysis doc)
- PRE-FLIGHT — branch, delete disabled `example` module, install at 0.4.8, .env + om_upgrade DB,
  seed fixtures, capture the golden baseline. **Nothing may be upgraded until this is green.**
- S1 → 0.5.0 — bump pins, run the framework's official codemod skill, gate ladder.
- S2 → 0.6.0 — MikroORM 6→7. The wall. Decorators move + 21 knex→kysely rewrites. Gate ladder.
- S3 → 0.6.7 — incremental 0.6.1..0.6.7, `ai` SDK 6→7, UI dep majors. Gate ladder.
- S4 — refresh `.ai/` + `AGENTS.md` from the 0.6.7 CLI assets, convert the baseline harness into
  Playwright specs under `.ai/qa/tests/`, final full regression.

# The gate ladder — run in order, STOP at the first failure
```
G1  yarn install                  resolves, no peer conflicts
G2  yarn generate                 codegen succeeds
G3  yarn typecheck                zero errors
G4  yarn db:migrate               applies clean onto a restore of the baseline dump
G5  yarn build                    production build succeeds
G6  boot                          "Application is ready at <baseUrl>"
G7  API contract replay           diff vs .ai/upgrade/baseline/api-contract.json
G8  page replay                   zero new 5xx / error boundaries / console errors
G9  knex-route body diff          byte-level, for the 21 rewritten routes
```
G1–G6 are cheap and machine-checkable. G7–G9 are the only things that catch the MikroORM 7
`getKnex()` removal, because every one of those 24 call sites is behind `as any` and is therefore
invisible to `tsc`. **Never declare a stage done on G1–G6 alone.**

# How to use subagents

Fan out with the Agent tool for work that is genuinely independent and read-heavy. Launch
parallel agents in ONE message. Keep the conclusions, not the file dumps.

Standing subagent roles — spawn these by task, not on a schedule:

- **surveyor** (`Explore`, very thorough) — locate every occurrence of a pattern before you touch
  anything. Use for: the 24 `getKnex()` sites, the 9 entity files, `AppContainer`-typed code,
  `advancedFilter` callers, `em.flush()` interleaved-read hazards. Returns file:line lists only.
- **rewriter** (`general-purpose`, one per module) — during S2, one agent per app module owning
  ALL knex rewrites in that module. Parallelise `competitions` (15 files), `teams` (4),
  `judging` (2). Each agent MUST return, per file, the before/after SQL semantics it preserved
  and any behaviour it could not preserve exactly. They may not touch files outside their module.
- **verifier** (`general-purpose`) — adversarial. Give it a rewritten file plus the original and
  ask it to find a query that returns different rows/ordering/types than before. Default to
  "broken" when uncertain. Run one verifier per rewritten file, in parallel, after the rewriters
  land. A rewrite is not accepted until a verifier has failed to break it.
- **replayer** (`general-purpose`) — owns the baseline harness: runs it, diffs against the golden
  files, and reports ONLY the deltas with a verdict (expected-from-migration / regression).
- **doc-refresher** (`general-purpose`) — S4 only. Extracts the 0.6.7 agentic assets from
  `node_modules/@open-mercato/cli/dist/agentic/` and rewrites `.ai/guides/`, `.ai/skills/`,
  and the AGENTS.md Task→Context table to match the new `om-*` skill names, `guides/modules/*.md`
  layout, `tiers.json`, and `install-skills.sh`.

Rules for delegation:
- Never delegate the decision to advance a gate. You own that.
- Never let two agents write to the same file.
- If a subagent reports success, spot-check one claim before believing it.
- Do not re-run a search a subagent is already running.

# Stage-specific instructions

## PRE-FLIGHT
- `git checkout -b chore/upgrade-om-0.6.7`.
- Delete `src/modules/example/` (disabled in `src/modules.ts`; 98 files, 8,717 lines, 1 knex site).
  Commit separately.
- `yarn install` at the current 0.4.8 pins. Create `.env` from `.env.example`. Point
  `DATABASE_URL` at a NEW `om_upgrade` database on the running `mercato-postgres` container.
  Never at the dev database.
- `yarn initialize`, then seed a representative fixture: ≥1 competition with tracks, teams,
  projects, judges + panel, sponsors, bounties, incidents, and at least one chat thread with
  unread messages. The chat/participants/profile routes are the ones most exposed to R1.
- `pg_dump -Fc` → `.ai/upgrade/baseline/db-0.4.8.dump`.
- Build the replay harness at `.ai/upgrade/harness/` (a script, not tests — Playwright comes at S4).
  It must exercise all 118 API routes as three principals (admin, portal participant, judge) and
  all 32 portal pages, and write `.ai/upgrade/baseline/{api-contract,pages}.json`.
- For the 21 knex-touching routes, persist FULL normalised response bodies, not shape hashes.
- **Gate: the harness must run green against 0.4.8 twice in a row.** A flaky baseline is not a
  baseline. Record any inherently nondeterministic fields and normalise them out.

## S1 → 0.5.0
- Bump every `@open-mercato/*` pin to `0.5.0` in one step (0.4.9/0.4.10 carry nothing for us).
- Run the framework's own codemod skill:
  `node_modules/@open-mercato/cli/dist/agentic/shared/ai/skills/om-auto-upgrade-0.4.10-to-0.5.0/SKILL.md`
  Read it and execute its codemods. Measured applicability here is small — `lucide-brand-icons`
  hits 1 file; check `react-email-cli` in package.json scripts and `lucide-metadata-icons` across
  the 77 `page.meta.ts`. Everything else has zero matches. Do not invent extra codemods.
- Full gate ladder. Commit.

## S2 → 0.6.0 — THE WALL
Do these in order; do not interleave.
1. Bump pins to `0.6.0`. Add `@mikro-orm/decorators` and `reflect-metadata` to package.json;
   align `@mikro-orm/{core,migrations,postgresql}` to `^7`.
2. Entity decorators: rewrite the 9 `src/modules/*/data/entities.ts` imports from
   `@mikro-orm/core` to `@mikro-orm/decorators/legacy`. Mechanical; `tsc` confirms.
3. Ensure `reflect-metadata` is imported before any entity loads (check `src/bootstrap.ts`).
4. `getKnex()` → kysely / raw SQL. Fan out **one rewriter agent per module**. Canonical patterns
   are in the analysis doc §3 R1; the framework's own migrated example is
   `@open-mercato/core/src/modules/messages/api/unread-count/route.ts` (compare 0.4.8 vs 0.6.7).
   - `knex.raw(...)` (11 sites) → `em.getConnection().execute<T>(sql, params)` — near-mechanical.
   - builder chains (15 sites) → `em.getKysely<any>()`. Watch: `.where(col, val)` becomes
     `.where(col, '=', val)`; `.join` → `.innerJoin`; `.first()` → `.executeTakeFirst()`;
     results are NOT auto-camelCased.
   - Delete the now-dead `import type { Knex } from 'knex'` lines.
5. Fan out **one verifier agent per rewritten file** before running any gates.
6. Full gate ladder. G4 will apply the core migration surge (customers 3→21, auth 3→11,
   workflows 5→10, staff 4→8, query_index 3→6, …) — expect it to be slow and expect real diffs
   at G7. Classify every G7 delta as expected-from-migration or regression, in writing.
7. Pay special attention to the auth reshape: 0.6.7 replaces global user-email uniqueness with a
   tenant-scoped partial index on `(tenant_id, email_hash)`. Any app code assuming globally
   unique emails is a regression, not a migration artifact.
- Commit only when G1–G9 are green. This stage may take several iterations. That is expected.

## S3 → 0.6.7
- Bump pins to `0.6.7`. Resolve `ai` SDK 6→7 (core requires `^7.0.4` from 0.6.6; only 2 app files
  import from `ai`/`@ai-sdk`). If it fights you, note it and fall back to holding at `0.6.5`
  for one iteration rather than blocking the whole stage.
- `recharts` 2→3 and `react-day-picker` 9→10 have **zero app files** — they should be transitive
  only. If they surface, that is a signal something else is wrong.
- Migrate `DataTable.advancedFilter` callers from the legacy flat shape to the tree shape. The
  compat bridge is documented as lasting one minor version and is lossy for nested groups.
- Full gate ladder. Commit.

## S4 — consolidate
- Refresh agentic assets from `node_modules/@open-mercato/cli/dist/agentic/`:
  `.ai/guides/` (now includes `guides/modules/*.md` + `module-facts.json` + `module-system.md`),
  `.ai/skills/` (all skills renamed with an `om-` prefix; new `tiers.json`), and run
  `shared/scripts/install-skills.sh`. Rewrite the AGENTS.md Task→Context table to match.
- Convert `.ai/upgrade/harness/` into real Playwright specs under `.ai/qa/tests/`, using the
  shipped `playwright.config.ts`. Prefer the fully-managed ephemeral mode:
  `yarn mercato test:integration` — it provisions its own app + DB and cannot touch dev data.
- Final full regression from a clean `om_upgrade` restore.
- Write `.ai/upgrade/REPORT.md`: what changed, what was rewritten, every accepted behavioural
  delta with its justification, and the follow-up backlog.

# Out of scope — file as follow-ups, never fix inline
- Enabling `communication_channels`, `wms`, `sync_excel`.
- Migrating the 98 hand-written write routes to `makeCrudRoute` / the new
  `runMutationGuards` registry contract.
- Adding `withAtomicFlush` coverage across the 42 `em.flush()` sites (audit and REPORT it; do not
  refactor it during the upgrade).
- Adopting optimistic locking in forms.
- Any feature work.

# Iteration protocol
Every iteration, in this order:
1. Read STATE.md. Identify the single next gate.
2. Do that gate's work (delegating to subagents where the roles above apply).
3. Verify it with actual command output. Paste the real output, not a summary of it.
4. Append an entry to STATE.md: gate, verdict, evidence, files touched, follow-ups filed.
5. If green and it completes a stage: commit with a message naming the stage and gate.
6. Stop. Do not start the next gate in the same iteration.

If a gate fails:
- Do NOT advance. Record the failure verbatim in STATE.md.
- Fix forward if the cause is understood and local.
- If you are on the same failing gate for 3 consecutive iterations, STOP the loop, write a
  BLOCKED entry naming exactly what you tried and what you need, and ask the user.

# Honesty rules — these override any impulse to look productive
- Never mark a gate green without pasting the command output that proves it.
- If you skipped something, say so in STATE.md under `Skipped`, with the reason.
- If a knex rewrite changes behaviour in a way you could not fully preserve, that goes in
  `Accepted deltas` with the justification — never buried in a commit message.
- "Typecheck passes" is not evidence the knex rewrites work. Say which of G7–G9 you actually ran.
- If the baseline harness was never captured, no stage may be declared complete. Ever.

# STATE.md template (create on iteration 1)
```markdown
# Upgrade State — 0.4.8 → 0.6.7
Branch: chore/upgrade-om-0.6.7
Current stage: PRE-FLIGHT
Current gate: —
Iterations: 0

## Gate ledger
| # | Stage | Gate | Verdict | Evidence | Date |
|---|-------|------|---------|----------|------|

## Accepted deltas
(behavioural differences accepted, with justification)

## Skipped
(anything not done, with reason)

## Follow-up backlog
(out-of-scope items discovered)

## Blocked
(current blocker, if any — what was tried, what is needed)
```
````

---

## Notes on running this

- **Do not start the loop before PRE-FLIGHT succeeds manually.** The golden baseline is the whole
  verification strategy; if it is flaky or missing, the loop produces confident-sounding garbage.
- Expect S2 to consume the majority of iterations. 21 files of hand-written SQL rewritten across an
  ORM boundary, verified adversarially, is the real cost of this upgrade.
- The loop is designed to stop itself after 3 failed attempts at the same gate rather than
  thrash. If it goes quiet on a BLOCKED entry, that is the design working.
