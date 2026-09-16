# SPEC-007 — Judge Star Voting & Voting Queue

**Date**: 2026-09-17
**Status**: Draft — Open Questions resolved, ready for review

## TLDR

Judges in the portal (`/portal/judging`) currently score each criterion with a row of
number buttons (`0…max_score`), pass a blocking conflict-of-interest prompt, save a
draft, submit, and are then locked out; the resulting 0–100 total is only visible back
on the list. The proposal (future behavior): judges rate **every criterion with 1–10
stars** and an optional per-criterion note; the software converts the stars into the
criterion's own points and weight. **Every click is saved**, a sticky **live summary**
shows the sum of stars, the weighted average and **where this project places** among
the judge's own votes, and votes stay editable until results are published. The list
becomes a **voting queue** in demo order: voted teams are marked, can be hidden, and
each project's full card opens in a **side panel**. Delivered in two phases: queue
first, star voting second.

## Decisions (answers to the Open Questions, 2026-09-17)

| # | Question | Decision |
|---|---|---|
| Q1 | Summary / ranking formula | **Weighted average** using `JudgingCriterion.weight` |
| Q2 | Scale | Judges **always** rate 1–10 stars; `max_score` stays an admin setting and the software converts stars → criterion points |
| Q3 | Draft vs submit | **No draft.** Save on every click; the project is **voted** once every applicable criterion has stars |
| Q4 | Edit after voting | **Yes**, until results are published (`finished` / `archived`) |
| Q5 | Conflict of interest | Replace the blocking prompt with a **small "Recuse myself" action** on the voting page |
| Q6 | "Where am I" | Progress **and** this project's **place** among the judge's own voted projects |
| Q7 | Full project card | **Side panel** (sheet) opened from the queue (and from the voting page) |
| Q8 | Spec scope | **One spec, two phases** |

## Problem Statement

What judges get today (`src/modules/judging`):

- `frontend/[orgSlug]/portal/judging/[projectId]/page.tsx` — blocking conflict-of-interest
  prompt → one card per criterion with `max_score + 1` number buttons (unrated criteria are
  sent as `0`) → free-text feedback and private notes → Save Draft / Submit. After submit
  the page is read-only. No running total on the page.
- `CriterionScore.note` exists in the entity and the GET payload but is **not rendered**,
  so feedback per criterion is impossible.
- `api/portal/score-project` POST computes `total_score = Σ (score / max_score) · weight · 100`
  over the criteria **in the request body only**, with no normalisation by `Σ weight`, and
  has no stage check (a judge could keep writing after `finished`).
- The same POST mutates `ProjectScore` scalars and then calls `txEm.findOne(CriterionScore)`
  before flushing — the pattern AGENTS.md rule 3 says MikroORM 7 silently drops.
- `frontend/[orgSlug]/portal/judging/page.tsx` — a flat list in database order with a
  Submitted / Draft / Unscored badge, no project details, no filter, and no link to the
  demo queue (`DemoSession.presentationOrder`) even though judges score while teams
  present in that order.

In the room this means: the judge hunts for the team on stage, cannot read the project
next to the scoring form, and does not see the number they are giving until they leave.

## Proposed Solution

### Phase 1 — Voting queue (no schema change)

The list page becomes a queue:

- Sorted by `DemoSession.presentationOrder` (preliminary round, same as every other
  portal judging surface today); projects without a demo slot go last, by title.
- Each row: queue position (`formatQueuePosition`, `#01`), project title, team, track,
  and a vote badge. In Phase 1 the badge comes **only** from the stored flags —
  `is_submitted` → **Voted · 6.8** (`total_score / 10`), a score row that is not submitted →
  **In progress**, `conflict_of_interest` → **Recused**, no row → **Not voted** — because the
  old page sends `0` for unrated criteria and counting rated criteria would lie. Phase 2
  switches the badge to `rated_count / criteria_count` (**In progress · 3/5**).
- The team on stage is highlighted (**On stage**), the next one tagged (**Up next**);
  a "Jump to on stage" link scrolls to it. The query refetches every 15 s, like
  `portal/presentations`.
- **Hide voted** toggle (hides Voted and Recused), stored in the URL (`?hide_voted=1`) so
  it survives navigating to a project and back.
- Progress bar `done / total`, where done = voted + recused.
- **Project card** button opens a side panel (`Sheet` from `@open-mercato/ui/primitives/sheet`)
  with the full project: title, tagline, team, track, problem statement, description,
  tech stack, demo / repo / video / presentation links, screenshots (served by the existing
  `projects/api/portal/asset-file/[id]`, which already entitles judges), and the reuse
  flags (`uses_preexisting_code`, its description, `flagged_for_reuse`). Clicking the row
  itself opens the voting page.

### Phase 2 — Star voting

The voting page (`/portal/judging/[projectId]`):

- **Header**: project title + team, **Project card** button (same side panel),
  save indicator (Saved / Saving… / Not saved — retry), **Next in queue** link (next project
  in demo order that is not voted).
- **One card per criterion**: name, description, weight (%), a 1–10 `Rating`
  (`@open-mercato/ui/primitives/rating`, `max={10}`), the converted value
  ("7★ → 3.5 / 5 pts"), and an optional note field (collapsed until used).
- **Sticky live summary** (bottom on mobile, side on desktop), recalculated on every click:
  - rated criteria `4 / 5`
  - sum of stars `31 / 50`
  - **weighted average `6.8 / 10`** (the number that ranks the project)
  - **place** `3rd of 12` among this judge's voted projects in the same track
    (shown once the project is voted; ties share a place)
  - queue progress `12 / 20 done`

  Place, progress and **Next in queue** come from `my-assignments` (the same React Query
  cache as the queue page, fetched in parallel with `score-project`), with the current
  project's entry replaced by the live values.
- **Feedback for the team** and **private notes** stay as today, saved after typing stops
  (debounced) and on blur.
- **Recuse myself** — a small text action at the bottom, confirmed in a dialog
  (`Cmd/Ctrl+Enter` confirm, `Escape` cancel). A recused project shows a short notice with
  **Undo recusal**; stars are hidden but kept.
- After `finished` the page is read-only with a "Voting is closed" notice.

### Alternatives considered

- **Pairwise comparison** (as in HackMIT's open-source Gavel): fewer scale-bias problems
  and no ties, but judges lose per-criterion feedback and organisers lose the criteria
  and weights they already configure. Rejected — too far from the current model.
- **Store converted points** (`stars / 10 · max_score`) instead of stars: `score` is an
  `int` column, so 7★ on a 5-point criterion (3.5) would not fit, and re-rendering stars
  from points is lossy. Rejected — store stars, convert when computing.
- **Judge-level normalisation** (z-scores per judge to cancel strict vs lenient judges):
  common in larger judging tools; out of scope, the formula lives in one function so it
  can be added later.

## Architecture

**Round.** Every portal judging surface is hard-wired to the `preliminary` round today; this
spec keeps that. Final-round voting (panels with `round = final`, `DemoSession.round = final`)
is out of scope and keeps working exactly as it does now.

Everything stays inside `judging`; `projects`, `teams`, `tracks` and `competitions` are read
by id as today, with no new cross-module imports beyond the ones the routes already use.

New pure helpers (unit-tested, shared by client and server so the judge sees exactly the
number that ranks the project):

- `judging/lib/scoring.ts`
  - `resolveApplicableCriteria(criteria, { round, trackId })` — `round ∈ {round, both}` and
    `trackId ∈ {null, project.trackId}`; replaces the inline filter in the GET route and is
    now also used by POST and `my-assignments`.
  - `starsToPoints(stars, scale, maxScore)` → `stars / scale · maxScore`.
  - `computeScore(applicable, ratings, { legacySubmitted })` → `{ ratedCount, criteriaCount,
    starSum, weightedAverage10, totalScore100, isComplete }` where
    `weightedAverage10 = Σ (score / (scale ?? maxScore) · 10 · w) / Σ w` over rated criteria,
    `totalScore100 = weightedAverage10 · 10`; if `Σ w = 0` fall back to the plain average.
    A row counts as rated when `scale = 10`, or when it is a legacy row (`scale NULL`) and
    either `score > 0` or the parent score was already submitted (`legacySubmitted`) — a
    submitted legacy `0` is a real score, an unsubmitted one is an old "not clicked".
    `starSum` counts legacy rows as their converted star value.
  - `rankAmong(total, others)` → `{ place, of }`, competition ranking (1, 2, 2, 4).
- `judging/lib/votingQueue.ts` — `sortByDemoOrder(projects)` and
  `voteState(score, criteriaCount)` → `voted | in_progress | not_voted | recused`.

Consumers of `ProjectScore.totalScore` (`calculate-final-scores`, `/api/judging/leaderboard`,
`/api/judging/scores`, results export) are **unchanged**: they average `total_score` across
judges on the 0–100 scale. The only change they see is that new totals are normalised by
`Σ weight` (see Risks).

## Data Model

One additive column, needed so old rows keep their meaning:

| Entity | Change | Why |
|---|---|---|
| `CriterionScore` | `scale int NULL` (`name: 'scale'`) | `NULL` = legacy row, `score` is on `0…criterion.max_score`; `10` = star rating. New writes always set `10`. |

- No change to `ProjectScore`. `is_submitted` keeps its column and now means **voted**
  (all applicable criteria rated, not recused); `submitted_at` = first time it became voted.
- Migration: add the nullable column only, no backfill; the module snapshot is updated in the
  same change. Rollback: drop the column (legacy rows are unaffected either way).
- Legacy row in the UI: `score > 0` is shown as `max(1, round(score / max_score · 10))` stars
  with a small "earlier scale" hint. A legacy `0` is shown as **not rated** when the score was
  never submitted, and as **"0 pts (earlier scale)"** with empty stars when it was submitted —
  it still counts as rated, so re-saving another criterion does not drop the project from
  results. The first click on a criterion rewrites it with `scale = 10`.
- No new sensitive data. Per-criterion notes, comments and private notes already exist as
  plain text; this spec does not change which routes return them.

## API Contracts

### `GET /api/judging/portal/my-assignments` (Phase 1, additive)

Per project, added fields:

```ts
demo: { order: number; status: DemoStatus } | null   // preliminary DemoSession
criteria_count: number                                // applicable criteria
problem_statement: string | null
presentation_url: string | null
preexisting_code_description: string | null
screenshots: Array<{ id: string; url: string }>        // url → projects portal asset-file
track_name: string | null
```

Per score, added: `track_id`. Response also gains `voting_open: boolean`
(`!areResultsPublished(stage)`). Projects are returned already sorted by demo order.
**Phase 2** adds per score `rated_count: number` and `weighted_average: number | null` (0–10),
computed with `computeScore`.

### `GET /api/judging/portal/score-project` (Phase 2)

Criteria come from `resolveApplicableCriteria`; each criterion score gains `scale`.
Response gains `voting_open`.

### `POST /api/judging/portal/score-project` (Phase 2, contract change)

```ts
{
  project_id: uuid, competition_id: uuid, judge_panel_id: uuid | 'auto',
  round: 'preliminary' | 'final',
  criterion_scores?: Array<{ criterion_id: uuid, stars?: int 1..10, note?: string | null }>,
  comment?: string | null,          // omitted = unchanged, null = cleared
  private_notes?: string | null,
  conflict_of_interest?: boolean,
}
→ 200 { ok: true, score_id, rated_count, criteria_count, is_voted,
        weighted_average: number | null, total_score: number | null }
```

- **Partial**: only the fields sent are written; the save of one star sends one item.
- `is_submitted` is **no longer accepted** — the server derives it.
- `conflict_of_interest` has **no default**: omitted = unchanged (the old schema's
  `.default(false)` would un-recuse the judge on every star click).
- `criterion_id` must be in the applicable set → otherwise 422.
- `areResultsPublished(stage)` → **409** `{ error: 'Voting is closed' }`. The stage is checked
  before the guard and **re-read inside the transaction** after the row lock, so a save cannot
  commit after `calculate-final-scores` has started. No lower bound is added (today there is
  none; panel membership is the gate).
- Panel resolution (`resolveScoringPanel`) and the mutation guard
  (`runRouteMutationGuards`, operation `create` / `update`) stay exactly as today.
- Write path — one transaction, safe against two tabs / double clicks (both tables have unique
  constraints, and a READ COMMITTED recompute could miss the other transaction's row):
  1. `INSERT … ON CONFLICT (project_id, judge_id, round) DO NOTHING` the `ProjectScore` shell
     via `em.getKysely()`, then load it with a pessimistic write lock (`SELECT … FOR UPDATE`)
     and re-read the competition stage;
  2. upsert the sent criterion rows with `INSERT … ON CONFLICT (project_score_id, criterion_id)
     DO UPDATE SET score, scale = 10, note (only when sent), updated_at`; patch `ProjectScore`
     scalars (comment, private notes, recusal);
  3. after flushing, load **all** criterion rows (the lock serialises writers, so the read is
     complete) and recompute with `computeScore` → `total_score`, `is_submitted`,
     `submitted_at` (first transition only); recused → `is_submitted = false`, `total_score = null`.

  Implemented with `withAtomicFlush(em, phases, { transaction: true, label: 'judging.portal.score' })`
  so no `find` sits between a scalar mutation and its flush. A unique violation that still
  escapes is retried once.
- After commit: guard `runAfterSuccess`, then emit events **only on transitions** —
  `judging.score.submitted` for not-voted → voted, `judging.score.updated` for voted →
  not-voted and recuse/undo. A plain star change emits nothing (both events are
  `clientBroadcast`, one per click would flood the backend).
- `openApi` for the route is rewritten for the new request/response; `/api/judging/scores`
  adds `scale` to each `criterion_scores` item.
- `saveScoreSchema` is split: the portal gets `portalSaveVoteSchema`; the backend command
  `judging.scores.save` (not called anywhere in `src/` today) is aligned to the same
  `scoring.ts` helpers.

## UI/UX

- Stars: `Rating` with `max={10}`, sized up so each star is a ≥ 40 px touch target on
  phones (two rows of 5 below 360 px width if needed). Arrow keys change the value; the
  primitive's `ArrowLeft` can reach `0`, so `onChange` clamps to 1.
- Save behavior: optimistic. One request in flight at a time; clicks made meanwhile are
  merged and sent as the next request. On failure the indicator turns red with
  **Retry**, and leaving the page with unsaved changes warns (`beforeunload`).
- Voted/in-progress badges and colours use the status palette tokens added in #198.
- All new strings in `judging/i18n/pl.json` and `en.json`; e2e selectors accept both, as
  `s08-judging.spec.ts` does today.
- Backend criterion form: `max_score` label becomes "Points (judges rate 1–10 stars)"
  with helper text; no functional change.

## Edge Cases & Failure Scenarios

| Case | Behavior |
|---|---|
| Save fails (network / 500) | Stars stay as clicked, indicator "Not saved — Retry", next click retries everything pending |
| Two tabs / double click, same judge | Row lock serialises the saves; the later request wins per criterion and the total is recomputed from all rows. Covered by a concurrency test |
| Voting closed while page is open | POST → 409; page switches to read-only with "Voting is closed" |
| Stage moves to `finished` during a save | Stage re-read under the lock → 409; the save never lands after final scores |
| Admin adds or deletes a criterion | New subscriber on `judging.criterion.created` / `.deleted` recomputes the competition's scores with `computeScore` (skipped once results are published): a voted project with a new unrated criterion goes back to **In progress** and leaves the leaderboard until rated |
| Admin changes `max_score` after legacy votes | Legacy rows are read against the current `max_score`, so their meaning changes; new star rows are unaffected. Noted in the admin helper text |
| All weights 0 | Plain average of stars |
| No applicable criteria | Voting page shows an empty state; project is not counted in progress |
| Project without demo slot | Listed after the queued ones; no stage badge |
| Recused then undone | Previously given stars reappear and totals are recomputed |
| Judge on several tracks | Place is computed within the project's track |
| Legacy draft with `0` for unrated criteria | Shown as not rated; counts as rated only after the judge clicks |

## Risks & Impact Review

- **Total normalised by `Σ weight` (product call).** Today totals are not divided by
  `Σ weight`, so criteria whose weights do not add up to 1 produce totals that are not on a
  0–100 scale. Normalising makes "weighted average" true to its name, but a competition
  that is mid-voting at rollout would mix old and new totals. **Mitigation:** deploy between
  competitions, or re-save affected scores; weights that already add up to 1 give identical
  numbers.
- **Minimum rises from 0 to 1 star.** The lowest possible criterion value becomes 10 % of its
  weight instead of 0, so new totals live in 10–100 while legacy totals could reach 0. Only
  matters if a competition mixes both; same mitigation as above.
- **Removing Submit (product call).** A project counts toward results as soon as every
  criterion has stars; judges can no longer "hold back" a finished card. Accepted per Q3.
- **POST contract change.** `is_submitted` in the body is dropped and `score` becomes
  `stars`. The only caller is the portal page replaced in the same phase; the e2e scenario
  `tests/e2e/specs/s08-judging.spec.ts` (conflict gate, Submit, lock after submit),
  `regressions.spec.ts` (≈ L486–513, clicks Submit and asserts `is_submitted`) and
  `s10-results.spec.ts` (IR7 depends on S8 submitting) must be updated; the S8 header totals
  (80.5 / 58.75) stay as oracles. The e2e suite lives in the untracked local `tests/` folder,
  so those edits are verification aids, not part of the PR.
- **Migration** is additive and nullable; rollback is dropping the column.
- **Fixes an existing MikroORM 7 hazard** in the current POST (scalar mutation followed by
  `findOne` before flush).

## 📋 Phasing

- **Phase 1 — Voting queue.** Demo order, vote badges from the stored flags, hide-voted filter,
  progress, side-panel project card. No migration, no change to how scores are saved.
  Shippable alone.
- **Phase 2 — Star voting.** 1–10 stars with notes, save on click, live summary with place,
  recuse action, editing until results, the `scale` column and the new POST contract.

## 📋 Implementation Plan

### Phase 1 — Voting queue

1. **`lib/votingQueue.ts` + `lib/scoring.ts#resolveApplicableCriteria`** with unit tests
   (demo-order sort, missing slots last, vote states from stored flags incl. recused,
   criteria filter). *Test:* jest.
2. **Extend `my-assignments`**: demo slot, sorting, `criteria_count`, project card fields,
   screenshot URLs, `track_id`, `voting_open`.
   *Test:* extend `api/portal/my-assignments/__tests__/route.test.ts` (order, tenant scope
   of DemoSession lookup, empty-array guards).
3. **`components/ProjectCardSheet.tsx`** — side panel from the extended payload.
   *Test:* render test for links, reuse flags, empty fields hidden.
4. **Queue page refactor** — rows, badges, on-stage highlight + jump link, 15 s refetch,
   `?hide_voted=1`, progress `done/total`, i18n keys pl/en.
   *Test:* e2e — queue in demo order, hide-voted removes Aurora after it is scored,
   card opens with project title.

### Phase 2 — Star voting

5. **Entity + migration**: `CriterionScore.scale int NULL`. Stop and confirm with the user
   per AGENTS.md rule 1 → `yarn db:generate` → review → `yarn db:migrate` → `yarn generate`.
6. **`lib/scoring.ts`** — `starsToPoints`, `computeScore` (legacy scale, submitted vs
   unsubmitted legacy 0, `Σ w = 0`, partial ratings), `rankAmong` (ties). *Test:* jest table
   tests, including a check that `totalScore100` equals today's formula when weights add up
   to 1.
7. **`portalSaveVoteSchema`** + POST rewrite: insert-or-lock, upserts, recompute from persisted
   rows, stage re-check under lock (409), applicable-criteria 422, recusal without default,
   transition-only events, `openApi`. GET returns `scale` and `voting_open`; `my-assignments`
   adds `rated_count` / `weighted_average` and switches badges to counts; `/api/judging/scores`
   adds `scale`. Align `commands/scores.ts` to the helpers.
   *Test:* update `score-project/__tests__/route.test.ts` and `route.panel-scope.test.ts`
   (partial save recompute, voted transition, edit after voted, 409 when finished, recuse/undo
   keeps recusal across star saves, submitted legacy 0 stays voted, guard still runs) and a
   concurrency test for two simultaneous first saves.
7b. **Criterion change subscriber** — recompute scores of the competition on
   `judging.criterion.created` / `.deleted` unless results are published. *Test:* jest.
8. **`components/StarCriterionCard.tsx`** + **`components/VoteSummary.tsx`** — stars, converted
   points, collapsible note, live summary with place and progress. *Test:* render tests for
   summary numbers against `computeScore`.
9. **Voting page refactor** — save queue with indicator and retry, debounced comment and
   private notes, recuse dialog, read-only when closed, **Project card** and **Next in queue**.
   Remove the conflict gate, Save Draft and Submit. *Test:* update the local e2e files
   `s08-judging.spec.ts`, `regressions.spec.ts`, `s10-results.spec.ts`; in S8: rate all criteria with stars → summary shows the
   expected average → queue shows **Voted** → change one star → average updates → recuse and
   undo.
10. **Admin wording + docs** — criterion form helper text, pl/en strings, update SPEC-001 §4.5
    scoring rules to point here. *Test:* `yarn generate && yarn typecheck && yarn lint &&
    yarn test && yarn build`.
