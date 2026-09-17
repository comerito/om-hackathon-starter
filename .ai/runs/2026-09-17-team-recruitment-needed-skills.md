# Execution plan — team recruitment with needed skills

**Engine:** om-auto-create-pr (steps: 9, --loop: no)
**Branch:** `feat/team-recruitment-needed-skills`
**Base:** `main`

## Goal

Give a team a way to say *"we are looking for a teammate with skills X"* — a recruitment
posting owned by the team, discoverable by participants browsing teams, and usable by the
owner as a skill-based shortlist instead of typing somebody's full name or e-mail.

## Why

Today the matching market is one-directional:

- A **participant** can flip `looking_for_team` on their participation, describe what they
  want, and list `skills` on their profile. `/portal/participants` already lets anyone search
  and filter that directory by skill.
- A **team** has no equivalent. `teams_team` carries no recruitment state at all. The only
  invite affordance on `/portal/team` is *"Search by full email address or name"*, which
  requires already knowing who you want.

So "I need a React dev" has no home: the team cannot advertise the gap, and participants
browsing `/portal/teams` cannot tell which teams are even open.

## Scope

- `teams_team` gains recruitment state: an open/closed flag, a needed-skills list, a short note.
- A portal endpoint for the team owner to publish/withdraw that posting.
- The posting is surfaced on the portal teams browse page (badge, skill chips, filters).
- The My Team invite section gains a skill-matched shortlist built from the existing
  participants directory endpoint, with one-click invite.

## Non-goals

- No notifications/e-mails when a posting appears or matches someone.
- No backoffice admin UI for recruitment state (portal-only; the admin team form is untouched).
- No change to the invitation/join-request state machine, team-size limits, or ACL features.
- No new search-index configuration.
- No scoring/ranking beyond a plain overlap count.

## Constraints discovered during triage

- **No database is reachable in this environment** (no `.env`, no Postgres). `yarn db:generate`
  cannot diff, so the migration is hand-written in the house style and
  `src/modules/teams/migrations/.snapshot-open-mercato.json` is updated in the same commit —
  mandatory per `AGENTS.md`, otherwise the migration regenerates forever.
- Portal routes authenticate with `getCustomerAuthFromRequest` and are tested with the
  mock-`em` pattern already established in `api/portal/*/__tests__/route.test.ts`.

## Implementation Plan

### Phase 1 — Data model

1.1 Add `lookingForMembers` (bool, default false), `neededSkills` (jsonb `[]`) and
`recruitmentNote` (text, nullable) to `Team` in `src/modules/teams/data/entities.ts`; add the
matching zod shape to `data/validators.ts`. Add a pure `lib/recruitment.ts` helper
(`normalizeNeededSkills`, `skillOverlap`) with unit tests — it is the one piece both the API
and both UIs share.

1.2 Hand-write `migrations/Migration20260917*.ts` adding the three columns, and update
`migrations/.snapshot-open-mercato.json` for `teams_team` in the same commit.

### Phase 2 — Portal API

2.1 `POST /api/teams/portal/update-recruitment` — owner-only, zod-validated, normalizes and
caps the skills list, clears the note when the posting is closed. Route-handler tests covering
auth, non-owner, unknown team, normalization, and the happy path.

2.2 Expose `looking_for_members` / `needed_skills` / `recruitment_note` from
`api/portal/my-membership` and `api/portal/browse-teams`, and add `recruiting=true` plus
`skills=a,b` filters to `browse-teams` (SQL-side, guarding the empty-list case).

### Phase 3 — Portal UI

3.1 My Team (`frontend/[orgSlug]/portal/team/page.tsx`): owner-only "Looking for teammates"
card — toggle, skill tag input, short note, save.

3.2 My Team invite section: when the team has needed skills, show a shortlist of teamless
participants ranked by skill overlap (built from `/api/competitions/portal/participants`),
each with a one-click invite that reuses the existing invite flow.

3.3 Browse Teams (`frontend/[orgSlug]/portal/teams/page.tsx`): "Recruiting" badge and needed
skill chips on the team card and in the team dialog, a "Recruiting" count pill, and a skills
filter mirroring the participants directory.

### Phase 4 — i18n and gate

4.1 Add every new key to `src/modules/teams/i18n/en.json` and `pl.json`.

4.2 Run the full validation gate (`yarn generate`, `typecheck`, `lint`, `test`, `build`) and
record the outcome, including anything blocked by the missing database.

## Risks

- **Hand-written migration + snapshot.** Without a DB the SQL is unverified by `db:generate`.
  Mitigated by copying the exact column shapes already used for `jsonb`/`bool`/`text` columns
  elsewhere in these snapshots, and by keeping every column nullable-or-defaulted so the
  migration is safe on a populated table.
- **`yarn build` may need a database.** If it does, the gate is reported as partially blocked
  rather than silently skipped.
- Skill strings are free text, so matching is case-insensitive on trimmed values; no taxonomy
  is introduced.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data model

- [ ] 1.1 Team recruitment fields, validators and shared skill helper with tests
- [ ] 1.2 Migration and snapshot for the three new columns

### Phase 2: Portal API

- [ ] 2.1 Owner-only update-recruitment endpoint with route tests
- [ ] 2.2 Recruitment fields and filters on my-membership and browse-teams

### Phase 3: Portal UI

- [ ] 3.1 My Team recruitment editor card
- [ ] 3.2 Skill-matched candidate shortlist in the invite section
- [ ] 3.3 Recruiting badge, skill chips and filters on the teams browse page

### Phase 4: i18n and gate

- [ ] 4.1 English and Polish translations for the new keys
- [ ] 4.2 Full validation gate
