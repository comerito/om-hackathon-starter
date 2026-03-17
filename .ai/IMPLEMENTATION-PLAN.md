# HackOn Platform — Implementation Plan

**Source spec:** `.ai/specs/SPEC-001-2026-03-17-hackon-platform.md`
**Created:** 2026-03-17
**Convention:** Each step ends with a working application. Check the box when done.

---

## Step 0 — Directory Structure & Module Registration
> **Goal:** Create all 7 module directories with full OM anatomy. Register in `src/modules.ts`. Run `yarn generate` to verify discovery. App compiles and starts.

### 0.1 Create module directories

```
src/modules/competitions/
├── index.ts
├── acl.ts
├── setup.ts
├── events.ts
├── di.ts
├── search.ts
├── notifications.ts
├── notifications.client.ts
├── data/
│   ├── entities.ts
│   ├── validators.ts
│   ├── extensions.ts
│   └── enrichers.ts
├── api/
│   └── interceptors.ts
├── backend/
│   └── page.tsx
├── frontend/
├── subscribers/
├── workers/
├── widgets/
│   ├── injection/
│   ├── injection-table.ts
│   └── components.ts
├── i18n/
│   ├── en.json
│   └── pl.json
└── migrations/

src/modules/tracks/
├── index.ts
├── acl.ts
├── setup.ts
├── events.ts
├── data/
│   ├── entities.ts
│   └── validators.ts
├── api/
├── backend/
│   └── page.tsx
├── frontend/
├── widgets/
│   ├── injection/
│   └── injection-table.ts
├── i18n/
│   ├── en.json
│   └── pl.json
└── migrations/

src/modules/teams/
├── index.ts
├── acl.ts
├── setup.ts
├── events.ts
├── di.ts
├── search.ts
├── notifications.ts
├── notifications.client.ts
├── data/
│   ├── entities.ts
│   ├── validators.ts
│   └── enrichers.ts
├── api/
├── backend/
│   └── page.tsx
├── frontend/
├── subscribers/
├── widgets/
│   ├── injection/
│   └── injection-table.ts
├── i18n/
│   ├── en.json
│   └── pl.json
└── migrations/

src/modules/projects/
├── index.ts
├── acl.ts
├── setup.ts
├── events.ts
├── search.ts
├── notifications.ts
├── notifications.client.ts
├── data/
│   ├── entities.ts
│   ├── validators.ts
│   └── enrichers.ts
├── api/
├── backend/
│   └── page.tsx
├── frontend/
├── subscribers/
├── workers/
├── widgets/
│   ├── injection/
│   └── injection-table.ts
├── i18n/
│   ├── en.json
│   └── pl.json
└── migrations/

src/modules/judging/
├── index.ts
├── acl.ts
├── setup.ts
├── events.ts
├── di.ts
├── search.ts
├── notifications.ts
├── notifications.client.ts
├── data/
│   ├── entities.ts
│   ├── validators.ts
│   └── enrichers.ts
├── api/
├── backend/
│   └── page.tsx
├── frontend/
├── subscribers/
├── workers/
├── widgets/
│   ├── injection/
│   └── injection-table.ts
├── i18n/
│   ├── en.json
│   └── pl.json
└── migrations/

src/modules/sponsors/
├── index.ts
├── acl.ts
├── setup.ts
├── events.ts
├── di.ts
├── notifications.ts
├── notifications.client.ts
├── data/
│   ├── entities.ts
│   ├── validators.ts
│   └── enrichers.ts
├── api/
├── backend/
│   └── page.tsx
├── frontend/
├── subscribers/
├── widgets/
│   ├── injection/
│   └── injection-table.ts
├── i18n/
│   ├── en.json
│   └── pl.json
└── migrations/

src/modules/incidents/
├── index.ts
├── acl.ts
├── setup.ts
├── events.ts
├── notifications.ts
├── notifications.client.ts
├── data/
│   ├── entities.ts
│   ├── validators.ts
│   └── enrichers.ts
├── api/
├── backend/
│   └── page.tsx
├── frontend/
├── subscribers/
├── widgets/
│   ├── injection/
│   └── injection-table.ts
├── i18n/
│   ├── en.json
│   └── pl.json
└── migrations/
```

### 0.2 Populate stub files

Every module gets:
- `index.ts` — metadata (name, title, version, description)
- `acl.ts` — empty features array `export const features: string[] = []`
- `setup.ts` — empty setup `export const setup: ModuleSetupConfig = {}`
- `events.ts` — empty events config
- `data/entities.ts` — empty
- `data/validators.ts` — empty
- `backend/page.tsx` — placeholder "Module coming soon" page
- `i18n/en.json` / `pl.json` — empty `{}`

### 0.3 Register modules in `src/modules.ts`

Add before the `example` module entry:
```typescript
{ id: 'competitions', from: '@app' },
{ id: 'tracks', from: '@app' },
{ id: 'teams', from: '@app' },
{ id: 'projects', from: '@app' },
{ id: 'judging', from: '@app' },
{ id: 'sponsors', from: '@app' },
{ id: 'incidents', from: '@app' },
```

### 0.4 Verify

- [ ] `yarn generate` — completes without errors
- [ ] `yarn dev` — app starts, no module discovery errors
- [ ] Backend sidebar shows 7 new module placeholder pages

**Status:** `[x] Done` — committed `4d01fe6`

---

## Step 1 — Competition Entity & Admin CRUD
> **Goal:** Competition entity with full data model (including JSONB configs + Zod validators). Backend CRUD (list/create/edit). Stage field exists but no transition logic yet.

### Deliverables
- `competitions/data/entities.ts` — `Competition` entity with all fields per spec §5.1
- `competitions/data/validators.ts` — Zod schemas: `createCompetitionSchema`, `updateCompetitionSchema`, `listCompetitionSchema` + all 4 JSONB config schemas (`stageConfigSchema`, `demoConfigSchema`, `judgingConfigSchema`, `peerVotingConfigSchema`)
- `competitions/api/competitions/route.ts` — CRUD via `makeCrudRoute` + `openApi` export
- `competitions/backend/page.tsx` — DataTable listing competitions
- `competitions/backend/competitions/create/page.tsx` — CrudForm for create
- `competitions/backend/competitions/[id]/edit/page.tsx` — CrudForm for edit with config tabs (General, Teams, Demos, Judging, Voting, Legal)
- `competitions/acl.ts` — features: `competitions.view`, `competitions.create`, `competitions.edit`, `competitions.delete`
- `competitions/setup.ts` — `defaultRoleFeatures` for superadmin/admin
- `competitions/events.ts` — CRUD events (`competition.created`, `competition.updated`, `competition.deleted`)
- Migration via `yarn db:generate`

### Verify
- [ ] `yarn db:migrate` applies Competition table
- [ ] Backend: can create a competition with all fields
- [ ] Backend: DataTable lists competitions with stage badge
- [ ] Backend: can edit competition, including all JSONB config tabs
- [ ] API: `GET /api/competitions` returns paginated list
- [ ] API: JSONB configs validated by Zod on write (invalid data rejected)

**Status:** `[x] Done` — committed `116c6c1`

---

## Step 2 — Competition Stage Machine
> **Goal:** Stage advance command with validation rules, guardrails preview endpoint, and re-run side effects endpoint. No side effects yet (just the state transition).

### Deliverables
- `competitions/api/competitions/advance-stage/route.ts` — POST: validates transition, updates stage, emits `stage_advanced` event
- `competitions/api/competitions/stage-preview/route.ts` — GET: returns counts/warnings for what would happen
- `competitions/api/competitions/set-stage/route.ts` — POST: superadmin override
- `competitions/api/competitions/rerun-side-effects/route.ts` — POST: re-emit stage_advanced for current stage
- `competitions/di.ts` — register `StageService`
- Backend: stage control panel on competition edit page (current stage indicator, "Advance" button with confirmation dialog showing preview data, warnings, checkbox acknowledgment)

### Verify
- [ ] Can advance DRAFT→OPEN→TEAM_FORMATION→...→ARCHIVED sequentially
- [ ] Invalid transitions rejected (e.g., DRAFT→HACKING)
- [ ] Stage preview endpoint returns correct counts (0 teams, 0 projects, etc. — will be populated later)
- [ ] Stage advance confirmation dialog shows preview + warnings
- [ ] `competitions.competition.stage_advanced` event emitted (visible in audit log)

**Status:** `[x] Done` — committed `621ec25`

---

## Step 3 — Participant Profile & Competition Participation
> **Goal:** ParticipantProfile and CompetitionParticipation entities. Admin can register participants (individual + CSV). Profile CRUD. CoC + privacy policy acceptance fields exist.

### Deliverables
- `competitions/data/entities.ts` — add `CompetitionParticipation` and `ParticipantProfile` entities
- `competitions/data/validators.ts` — schemas for both entities
- `competitions/data/extensions.ts` — link `ParticipantProfile` to `customer_accounts:user`
- `competitions/api/participations/route.ts` — CRUD (list with filters, create, update)
- `competitions/api/participations/bulk/route.ts` — POST: CSV import (parse, validate, create CustomerUser invitations + CompetitionParticipation records via background worker)
- `competitions/api/participations/resend-invitation/route.ts` — POST
- `competitions/api/participations/checkin/route.ts` — POST: check in participant
- `competitions/workers/bulk-import.ts` — background CSV processing worker
- `competitions/backend/participants/page.tsx` — DataTable with filters (role, check-in, CoC, team)
- `competitions/backend/participants/create/page.tsx` — CrudForm for individual registration
- `competitions/backend/participants/import/page.tsx` — CSV upload UI with preview, validation, progress
- Migration via `yarn db:generate`

### Verify
- [ ] Admin can create individual participant → CustomerUser invitation sent
- [ ] Admin can bulk import from CSV → background worker processes → progress visible
- [ ] Participant list shows role, check-in status, CoC status
- [ ] Admin can check in participant → `checkedIn` = true, `checkedInAt` set
- [ ] ParticipantProfile created on invitation acceptance (subscriber)
- [ ] Admin can re-send invitation
- [ ] `competitions.participation.created`, `competitions.participation.checked_in` events emitted

**Status:** `[x] Done` — committed `469fbf1`

---

## Step 4 — Portal Shell & Auth Gates
> **Goal:** Portal shell with customer roles (participant/mentor/judge). Login works. CoC + privacy policy acceptance gates block access. Dashboard with "Your Current Task" card. QR code page.

### Deliverables
- `competitions/setup.ts` — `defaultCustomerRoleFeatures` for participant, mentor, judge
- Portal layout: CoC + privacy policy middleware (check `CompetitionParticipation.cocAccepted` AND `privacyPolicyAccepted`; if not, redirect to acceptance page)
- `competitions/frontend/[orgSlug]/portal/accept/page.tsx` — CoC + privacy policy acceptance form
- `competitions/frontend/[orgSlug]/portal/dashboard/page.tsx` — Dashboard with "Your Current Task" card (stage-aware), role-specific widgets
- `competitions/frontend/[orgSlug]/portal/qr/page.tsx` — QR code display (error correction H, 60% width, black-on-white)
- `competitions/frontend/[orgSlug]/portal/competition/page.tsx` — Competition overview (description, rules, stage indicator, deadlines)
- `competitions/frontend/[orgSlug]/portal/profile/page.tsx` — Profile edit (bio, skills, organization, social links via ParticipantProfile)
- Portal sidebar menu injection: Dashboard, Competition, Agenda, Participants, Announcements, My QR Code, Report Incident (all visible, stage-conditional items disabled with tooltip)
- `competitions/widgets/injection/PortalNav/widget.ts` + `injection-table.ts`
- Dashboard widgets: stage indicator, current task, next deadline countdown

### Verify
- [ ] Participant can log in via portal (magic link or password)
- [ ] Portal blocked if CoC or privacy policy not accepted → redirect to acceptance page
- [ ] After accepting both, portal accessible
- [ ] Dashboard shows "Your Current Task" appropriate for current stage
- [ ] QR code page shows scannable code
- [ ] Profile page allows editing skills, bio, social links, organization
- [ ] Competition overview shows stage progress indicator
- [ ] All sidebar nav items visible (some disabled with tooltips)

**Status:** `[ ] Not started`

---

## Step 5 — Agenda & Announcements
> **Goal:** Admin can manage agenda items and announcements. Portal shows agenda timeline and announcements feed. Announcements broadcast via SSE.

### Deliverables
- `competitions/data/entities.ts` — add `AgendaItem` and `Announcement` entities (already partially scaffolded)
- `competitions/data/validators.ts` — schemas for agenda items and announcements
- `competitions/api/agenda/route.ts` — CRUD
- `competitions/api/announcements/route.ts` — CRUD
- `competitions/backend/agenda/page.tsx` — DataTable + CrudForm for agenda
- `competitions/backend/announcements/page.tsx` — DataTable + CrudForm for announcements (with targeting: roles, tracks, priority)
- `competitions/frontend/[orgSlug]/portal/agenda/page.tsx` — Timeline view with "now" indicator, filter by track, mandatory highlights
- `competitions/frontend/[orgSlug]/portal/announcements/page.tsx` — Chronological feed, priority visual differentiation (INFO=blue border, WARNING=yellow, URGENT=red banner), unread badge
- `competitions/events.ts` — add announcement events with `portalBroadcast: true`
- Portal: `usePortalAppEvent('competitions.announcement.*')` → toast on new announcement
- Notification UI: bell icon in portal header via `PortalNotificationBell`

### Verify
- [ ] Admin can create/edit/delete agenda items
- [ ] Admin can create announcement targeting specific roles/tracks
- [ ] Portal agenda shows timeline with "now" indicator
- [ ] Portal announcements page shows feed with priority styling
- [ ] New URGENT announcement shows red banner in portal (real-time via SSE)
- [ ] Bell icon shows unread count
- [ ] Stage transition banner appears in portal when admin advances stage

**Status:** `[ ] Not started`

---

## Step 6 — Competition Context Enricher & Check-In Scanner
> **Goal:** Competition context enricher for cross-module use. Backend check-in scanner page.

### Deliverables
- `competitions/data/enrichers.ts` — enricher providing competition name, stage, config to other modules' API responses
- `competitions/backend/checkin/page.tsx` — QR scanner (camera-based), manual search/confirm, live check-in count via `useAppEvent`
- Check-in API wired to emit event → counter updates in real-time

### Verify
- [ ] Check-in scanner page opens camera
- [ ] Scanning QR code checks participant in
- [ ] Manual search finds participant, check-in button works
- [ ] Live counter increments on each check-in
- [ ] Competition enricher returns competition name/stage when requested by other modules

**Status:** `[ ] Not started`

---

## Step 7 — Tracks Module
> **Goal:** Full track CRUD. Admin can create tracks for a competition. Portal shows browsable tracks. Mentors can view assigned tracks.

### Deliverables
- `tracks/data/entities.ts` — `Track` entity with GIN index on `mentorIds`
- `tracks/data/validators.ts` — Zod schemas
- `tracks/api/tracks/route.ts` — CRUD (filtered by `competitionId`)
- `tracks/acl.ts` — features
- `tracks/setup.ts` — role features
- `tracks/events.ts` — CRUD events
- `tracks/backend/page.tsx` — DataTable with color badges, team count column, distribution chart
- `tracks/backend/tracks/create/page.tsx` + `[id]/edit/page.tsx` — CrudForm (name, description, color picker, icon, max teams, mentor assignment multiselect)
- `competitions/frontend/[orgSlug]/portal/tracks/page.tsx` — Browse tracks with descriptions, team counts, sponsor challenges
- `tracks/frontend/[orgSlug]/portal/mentor/tracks/page.tsx` — Mentor-only: assigned tracks with team list + project status (read-only)
- Portal sidebar injection: Mentor Tracks nav item (mentor role only)

### Verify
- [ ] Admin can create tracks with color, description, team cap, mentor assignments
- [ ] Backend DataTable shows tracks with team count and color badges
- [ ] Portal shows browsable track list with details
- [ ] Mentor portal shows only assigned tracks with team/project overview
- [ ] Track distribution chart works (no teams yet, shows 0)

**Status:** `[ ] Not started`

---

## Step 8 — Teams: Entity & Creation
> **Goal:** Team, TeamMember, TeamInvitation entities. Participant can create a team and becomes OWNER.

### Deliverables
- `teams/data/entities.ts` — `Team`, `TeamMember`, `TeamInvitation` entities with all fields (indexes, soft delete on TeamMember, etc.)
- `teams/data/validators.ts` — Zod schemas
- `teams/api/teams/route.ts` — CRUD (list with filters, create, get with members, update, delete)
- `teams/di.ts` — register `TeamService`
- `teams/acl.ts` — features
- `teams/setup.ts` — `defaultRoleFeatures` + `defaultCustomerRoleFeatures`
- `teams/events.ts` — all team events
- `teams/data/enrichers.ts` — member count enricher for team list API
- `teams/frontend/[orgSlug]/portal/team/page.tsx` — "My Team" page: create option if no team, roster if team exists, track selection, table assignment
- Portal nav injection: My Team, Browse Teams
- Migration via `yarn db:generate`

### Verify
- [ ] Participant can create a team (becomes OWNER)
- [ ] "My Team" page shows team roster with roles
- [ ] Team CRUD API works with member count enrichment
- [ ] Backend team management page shows all teams
- [ ] Cannot create team if already on one (unique constraint enforced)
- [ ] `teams.team.created` event emitted

**Status:** `[ ] Not started`

---

## Step 9 — Teams: Invitations & Join Requests
> **Goal:** Full invitation lifecycle. Team browser with "People Looking for Teams" tab. Participants Directory page.

### Deliverables
- `teams/api/invitations/route.ts` — CRUD (create invite/join request, accept, decline, cancel)
- `teams/api/teams/members/remove/route.ts` — POST: remove member
- `teams/api/teams/members/leave/route.ts` — POST: leave team (with ownership transfer logic)
- `teams/api/teams/assign-member/route.ts` — POST: admin assigns participant
- Invitation acceptance: `withAtomicFlush` — create TeamMember + update invitation + cancel other pending invitations + handle DB constraint violation gracefully
- `teams/frontend/[orgSlug]/portal/teams/browse/page.tsx` — Team browser (list teams, filter by track/spots, join request button) + "People Looking for Teams" tab
- `competitions/frontend/[orgSlug]/portal/participants/page.tsx` — Participants Directory (searchable/filterable by skills, organization, "looking for team", "Invite to Team" action)
- Dashboard widget: pending invitations indicator
- Invitation expiration: `teams/subscribers/expire-invitations.ts` (scheduled or on-access check)
- Notifications: `teams.invitation_received`, `teams.join_request_received`, `teams.invitation_response`

### Verify
- [ ] Team owner can invite participant → participant gets notification
- [ ] Participant can accept/decline invitation
- [ ] Participant can send join request → owner gets notification
- [ ] Owner can approve/reject join request
- [ ] Team browser shows teams with open spots
- [ ] "People Looking for Teams" tab shows participants with skills
- [ ] Participants Directory page filterable by skills
- [ ] Admin can assign participant to team
- [ ] Owner leaving triggers ownership transfer
- [ ] Cannot join two teams (constraint violation → user-friendly error)
- [ ] Team size limit enforced (SELECT FOR UPDATE on team)

**Status:** `[ ] Not started`

---

## Step 10 — Teams: Track Selection & Stage Lockdown
> **Goal:** Team owner selects track. Advancing to HACKING locks team membership. Unmatched participants handled.

### Deliverables
- `teams/api/teams/select-track/route.ts` — POST
- `teams/api/teams/disqualify/route.ts` — POST (with confirmation, sets status + reason)
- `teams/api/teams/reactivate/route.ts` — POST
- `teams/subscribers/lock-membership.ts` — on `stage_advanced` → HACKING: lock teams, create solo teams if `allowSoloParticipants`
- `teams/subscribers/create-solo-teams.ts` — auto-create solo teams for unmatched participants
- Stage preview endpoint now returns real data: unmatched participants count, under-sized teams count, teams without tracks
- Backend: disqualification/withdraw flow on team detail page
- Backend: "assign to team" admin action on participant management page

### Verify
- [ ] Team owner can select track → track assigned, members notified
- [ ] Track selection respects `maxTeams` cap
- [ ] Advancing to HACKING locks team membership (new invitations blocked)
- [ ] Stage preview shows correct counts (unmatched, under-sized, no track)
- [ ] If `allowSoloParticipants`, solo teams created automatically
- [ ] If not, teamless participants see "Contact organizer" message in portal
- [ ] Admin can disqualify/reactivate teams
- [ ] Disqualified teams hidden from portal team browser

**Status:** `[ ] Not started`

---

## Step 11 — Projects: Entity & Editor
> **Goal:** Project entity. Portal editor with all fields, auto-save, originality disclosure. Auto-create drafts on HACKING stage.

### Deliverables
- `projects/data/entities.ts` — `Project` entity with all fields per spec §5.4
- `projects/data/validators.ts` — Zod schemas (create, update, submit validation)
- `projects/data/enrichers.ts` — enricher adding team name + track name to project responses
- `projects/api/projects/route.ts` — CRUD (portal: PUBLISHED only for other teams, own team in any status)
- `projects/events.ts` — CRUD events + `projects.batch.auto_published`
- `projects/subscribers/create-drafts.ts` — on `stage_advanced` → HACKING: auto-create DRAFT project for each team
- `projects/frontend/[orgSlug]/portal/project/page.tsx` — Project editor: all fields, screenshot/attachment upload, originality disclosure, auto-save (30s), deadline countdown (turns red at 15min), completeness checklist
- `projects/backend/page.tsx` — DataTable with status badges, reuse flags
- `projects/backend/projects/[id]/page.tsx` — Project detail (admin view)
- Portal nav injection: My Project (disabled until HACKING)

### Verify
- [ ] Advancing to HACKING creates DRAFT project for each team
- [ ] Team members can edit project (all fields)
- [ ] Auto-save fires every 30 seconds
- [ ] Screenshot upload works via attachments module
- [ ] Originality disclosure section works
- [ ] Deadline countdown shows and turns red at 15min
- [ ] Backend DataTable shows all projects with status
- [ ] Portal: other teams' DRAFT projects not visible
- [ ] Project enricher returns team name + track name

**Status:** `[ ] Not started`

---

## Step 12 — Projects: Submission & Flagging
> **Goal:** Submit flow (DRAFT→PUBLISHED). Admin flagging. Auto-publish on DEMOS stage advance.

### Deliverables
- `projects/api/projects/submit/route.ts` — POST: validate required fields + disclosure → DRAFT→PUBLISHED, lock content
- `projects/api/projects/flag/route.ts` — POST: admin flags for reuse
- `projects/api/projects/unflag/route.ts` — POST: admin removes flag
- `projects/subscribers/auto-publish.ts` — on `stage_advanced` → DEMOS: auto-publish remaining DRAFTs, emit `projects.batch.auto_published`, send urgent notification to affected teams
- `projects/notifications.ts` — `projects.submitted`, `projects.auto_published`, `projects.flagged`
- Backend: flag/unflag actions, submission progress bar (submitted/total)
- Portal: submit button with deadline check, post-deadline disabled message

### Verify
- [ ] Team owner can submit project → DRAFT→PUBLISHED
- [ ] Submission rejects if required fields or disclosure missing
- [ ] Published project locked for edits
- [ ] Admin can flag/unflag project for reuse → visible warning badge
- [ ] Advancing to DEMOS auto-publishes remaining drafts
- [ ] Teams with auto-published drafts get notification
- [ ] Backend shows submission progress bar
- [ ] `projects.project.submitted` event emitted

**Status:** `[ ] Not started`

---

## Step 13 — Judging: Panels & Criteria
> **Goal:** Judge panel CRUD, judge/track assignment, judging criteria CRUD with weight validation.

### Deliverables
- `judging/data/entities.ts` — `JudgePanel`, `JudgePanelJudge`, `JudgePanelTrack`, `JudgingCriterion` entities
- `judging/data/validators.ts` — Zod schemas
- `judging/api/panels/route.ts` — CRUD + add/remove judge + assign track
- `judging/api/criteria/route.ts` — CRUD with weight sum validation (per scope)
- `judging/acl.ts` — features
- `judging/setup.ts` — role features
- `judging/events.ts` — all judging events
- `judging/backend/page.tsx` — Tabs: Panels, Criteria
- `judging/backend/judging/panels/page.tsx` — Panel list + CRUD + judge/track assignment
- `judging/backend/judging/criteria/page.tsx` — Criteria list + CRUD + weight validation
- Default criteria seed in `judging/setup.ts` → `seedDefaults`: Innovation, Technical Execution, Business Value, Presentation, Track Theme
- Migration

### Verify
- [ ] Admin can create judge panels for PRELIMINARY and FINAL rounds
- [ ] Admin can assign judges (CustomerUsers with judge role) to panels
- [ ] Admin can assign tracks to panels
- [ ] Admin can create/edit criteria with weight validation (sum ≤ 1.0)
- [ ] Default criteria seeded on tenant init
- [ ] Backend tabs show all judging config

**Status:** `[ ] Not started`

---

## Step 14 — Judging: Demo Queue & Timer
> **Goal:** Demo session generation, queue management, live timer with SSE, kiosk/projector view.

### Deliverables
- `judging/data/entities.ts` — add `DemoSession` entity (with projectId, status/round indexes)
- `judging/api/demos/route.ts` — list, generate queue, update (reorder), advance status, skip, get current
- `judging/api/demos/advance/route.ts` — POST: advance demo status, record `actualStart`, emit `judging.demo.status_changed` with `serverTime` for clock skew
- `judging/di.ts` — register `DemoTimerService`
- `judging/subscribers/generate-queue.ts` — on `projects.batch.auto_published`: create DemoSession entries, ordered by track then random within track
- `judging/backend/judging/demos/page.tsx` — Demo control: queue (drag-to-reorder when idle, up/down on mobile), large action buttons (Start, Q&A, Complete, Skip), keyboard shortcuts, live status, total event time calculation, kiosk launch button
- `judging/frontend/[orgSlug]/portal/presentations/page.tsx` — Live queue: current team, on deck, full list, timer display with `usePortalAppEvent`, my team highlighted
- `judging/frontend/[orgSlug]/portal/kiosk/page.tsx` — Full-screen: timer digits 20% vh, team name 8% vh, dark background, vw/vh sizing, auto-advances with SSE, `aria-live` for timer
- Portal nav injection: Presentations (all roles, disabled until DEMOS)
- `judging/notifications.ts` — `judging.on_deck`
- `judging/subscribers/notify-on-deck.ts` — push urgent notification to on-deck team

### Verify
- [ ] Advancing to DEMOS generates demo queue (after projects auto-published)
- [ ] Admin can reorder queue, skip teams
- [ ] Admin starts presentation → timer starts, SSE event broadcast
- [ ] All portal clients show synchronized timer (clock skew corrected)
- [ ] Kiosk view: large timer, team name, auto-advances on SSE
- [ ] Timer visual: green → yellow (30s) → red (0s) → "TIME'S UP"
- [ ] ON_DECK team gets urgent notification
- [ ] Keyboard shortcuts work (Space=advance, S=skip)
- [ ] Demo control shows total event time estimate

**Status:** `[ ] Not started`

---

## Step 15 — Judging: Score Submission & Leaderboard
> **Goal:** Judges can score projects. Score card with tappable buttons. Auto-save. Leaderboard computation. Scoring progress dashboard.

### Deliverables
- `judging/data/entities.ts` — add `ProjectScore`, `CriterionScore` entities
- `judging/api/scores/route.ts` — list (judge: own only, admin: all), create/update, delete (admin)
- `judging/api/scores/progress/route.ts` — GET: scoring matrix (judge × project)
- `judging/api/leaderboard/route.ts` — GET: computed on-demand per track (admin: DELIBERATION+, portal: FINISHED+)
- `judging/di.ts` — register `ScoringService` (weighted average computation, two-round support)
- `judging/subscribers/check-scoring-complete.ts` — on `score.submitted`: if all judges scored, mark project SCORED
- `judging/frontend/[orgSlug]/portal/judging/page.tsx` — Judge dashboard: assigned projects sorted by presentation order, sections: Currently Presenting / Unscored / Scored (draft) / Submitted
- `judging/frontend/[orgSlug]/portal/judging/[projectId]/page.tsx` — Score card: conflict of interest prompt (top), project details (collapsible), tappable number buttons (0-10), written feedback, private notes, auto-save on change, draft badge
- `judging/backend/judging/scoring/page.tsx` — Scoring progress heat map, nudge judges button, anomaly detection
- `judging/backend/judging/leaderboard/page.tsx` — Per-track leaderboard (available during DELIBERATION), recalculate button
- Portal nav injection: Judging (judge only, disabled until DEMOS)
- Score finalization subscriber: on `stage_advanced` → FINISHED: persist `Project.finalScore` snapshots, compute rankings

### Verify
- [ ] Judge can open score card for assigned project
- [ ] Conflict of interest prompt shown at top of score card
- [ ] Tappable number buttons work on mobile (not sliders)
- [ ] Auto-save on field change (debounced)
- [ ] Judge dashboard shows scored/unscored/draft progress
- [ ] Judge sees only own scores in API (other judges' scores hidden)
- [ ] Admin scoring progress shows heat map
- [ ] Leaderboard computes correctly (weighted averages)
- [ ] Leaderboard returns 403 for portal users before FINISHED
- [ ] Admin can remove outlier score
- [ ] FINISHED stage persists finalScore snapshots and rankings

**Status:** `[ ] Not started`

---

## Step 16 — Judging: Two-Round & Finalists
> **Goal:** Two-round judging flow: preliminary → finalist selection → final round.

### Deliverables
- `judging/api/finalists/route.ts` — POST: select finalists per track (based on preliminary scores)
- Final round: generate second DemoSession set for finalists
- Final score computation: weighted combo of preliminary + final (per `JudgingConfig`)
- Backend: finalist selection UI (toggle finalists per track, auto-suggest from scores)

### Verify
- [ ] Admin can select finalists based on preliminary scores
- [ ] Final round demo sessions generated for finalists only
- [ ] Final round scoring form works for final-round judges
- [ ] Final score = weighted combination of preliminary + final
- [ ] Leaderboard reflects two-round computation

**Status:** `[ ] Not started`

---

## Step 17 — Sponsors & Prizes
> **Goal:** Sponsor CRUD. Prize CRUD with category-specific validation. Portal view.

### Deliverables
- `sponsors/data/entities.ts` — `Sponsor`, `Prize` entities
- `sponsors/data/validators.ts` — Zod schemas (prize: TRACK_PLACEMENT requires trackId+rank, SPONSOR_PRIZE requires sponsorId)
- `sponsors/api/sponsors/route.ts` — CRUD
- `sponsors/api/prizes/route.ts` — CRUD
- `sponsors/api/prizes/assign/route.ts` — POST: assign prize to project/team
- `sponsors/api/prizes/unassign/route.ts` — POST: remove assignment
- `sponsors/events.ts` — all sponsor events
- `sponsors/backend/page.tsx` — Sponsors DataTable + CRUD
- `sponsors/backend/prizes/page.tsx` — Prizes DataTable + CRUD + assignment UI
- `sponsors/frontend/[orgSlug]/portal/sponsors/page.tsx` — Sponsors with logos, tiers, challenges; prizes by category
- Portal nav injection: Sponsors & Prizes (all roles, always enabled)

### Verify
- [ ] Admin can create sponsors with tiers, logos, challenges
- [ ] Admin can create prizes (validation: track placement needs track+rank)
- [ ] Admin can assign prize to winning project
- [ ] Portal shows sponsor grid by tier
- [ ] Portal shows prizes grouped by category
- [ ] `sponsors.prize.awarded` event emitted on assignment

**Status:** `[ ] Not started`

---

## Step 18 — People's Choice Voting
> **Goal:** Peer voting system. Participants can vote. Vote tally for admin. Auto-suggest People's Choice prize.

### Deliverables
- `sponsors/data/entities.ts` — add `PeerVote` entity
- `sponsors/api/votes/route.ts` — GET (my votes), POST (cast), DELETE (retract if `allowVoteChange`)
- `sponsors/api/votes/tally/route.ts` — GET (admin: always, portal: after FINISHED)
- `sponsors/di.ts` — register `VotingService` (vote limit enforcement with SELECT FOR UPDATE)
- `sponsors/subscribers/close-voting.ts` — on `stage_advanced` → DELIBERATION: close voting window
- `sponsors/subscribers/auto-suggest-prize.ts` — on FINISHED: assign People's Choice prize to top-voted project
- `sponsors/frontend/[orgSlug]/portal/voting/page.tsx` — Project grid (excluding own team), vote/unvote toggle, "X of Y votes used" counter, countdown to window close, "Voting ended" overlay
- `sponsors/notifications.ts` — `voting_open`, `voting_closing`, `prize_awarded`
- Portal nav injection: Vote (participant only, disabled until voting window)

### Verify
- [ ] Participant can vote for up to N projects (not own team)
- [ ] Vote limit enforced (concurrent safe)
- [ ] Cannot vote outside voting window
- [ ] Retract vote works if `allowVoteChange` = true
- [ ] Admin sees live vote tally
- [ ] Portal vote tally returns 403 before FINISHED
- [ ] Advancing to DELIBERATION closes voting
- [ ] FINISHED stage auto-assigns People's Choice prize

**Status:** `[ ] Not started`

---

## Step 19 — Results & Prize Announcement
> **Goal:** Results portal page. "Publish Results" flow. Leaderboard, scores, prizes visible to all after FINISHED.

### Deliverables
- `sponsors/frontend/[orgSlug]/portal/results/page.tsx` — Per-track leaderboard, project cards with scores + prizes, People's Choice winner, "My team" section with score breakdown + judge feedback, strength highlights (highest criteria)
- `sponsors/backend/results/page.tsx` — Score review, anomaly detection, prize assignment interface, auto-suggestions, "Publish Results" button (→ FINISHED)
- Results notifications: `judging.results_published`, `sponsors.prize_awarded` (email + in_app)
- Portal nav injection: Results (all roles, disabled until FINISHED)

### Verify
- [ ] Admin reviews scores, assigns prizes, clicks "Publish Results"
- [ ] Competition advances to FINISHED
- [ ] All participants see leaderboard simultaneously
- [ ] Teams see their score breakdown + judge feedback
- [ ] Prize winners see their awards highlighted
- [ ] Email notifications sent to all participants
- [ ] Disqualified teams excluded from leaderboard (admin sees with strikethrough)

**Status:** `[ ] Not started`

---

## Step 20 — Incidents Module
> **Goal:** CoC incident reporting from any portal page. Admin resolution workflow. Anonymous reporting with audit log bypass.

### Deliverables
- `incidents/data/entities.ts` — `IncidentReport` entity
- `incidents/data/validators.ts` — Zod schemas
- `incidents/api/incidents/route.ts` — list (admin), create (portal, anonymous allowed), get, update, resolve
- `incidents/events.ts` — events
- `incidents/subscribers/alert-admins.ts` — on HIGH/CRITICAL: immediate admin notification
- `incidents/subscribers/audit-anonymous.ts` — custom audit entry for anonymous reports (system user, no reporter identity)
- `incidents/frontend/[orgSlug]/portal/incident/page.tsx` — Report form: description, severity, reported user (optional), anonymous toggle
- Portal shell: floating "Report Incident" button (always visible, all pages)
- `incidents/backend/page.tsx` — DataTable with severity badges, resolution workflow
- `incidents/notifications.ts` — `high_severity`, `resolved`

### Verify
- [ ] Any user can file incident report from any page
- [ ] Anonymous toggle removes reporter identity
- [ ] Anonymous reports not traceable in audit logs (system user used)
- [ ] HIGH/CRITICAL incidents trigger immediate admin notification
- [ ] Admin can review, add notes, resolve incidents
- [ ] Resolution can link to team disqualification

**Status:** `[ ] Not started`

---

## Step 21 — Event Command Center
> **Goal:** Admin real-time dashboard with traffic-light metrics, side effect status, activity feed.

### Deliverables
- `competitions/api/competitions/dashboard/route.ts` — GET: aggregated metrics (check-in count, team stats, project stats, demo progress, judging progress, vote count, incidents)
- `competitions/backend/command-center/page.tsx` — Traffic-light metrics (green/yellow/red), "Needs Attention" section (all yellow/red at top), side effect status per stage (pending/completed/failed), live activity feed (recent audit log entries), all refreshed via `useAppEvent`

### Verify
- [ ] Dashboard shows all metric categories with correct counts
- [ ] Traffic-light indicators work (e.g., "3 incidents OPEN (2 HIGH)" = red)
- [ ] "Needs Attention" section aggregates problems
- [ ] Side effect status shows completion for current stage
- [ ] Activity feed updates in real-time
- [ ] Metrics refresh on SSE events

**Status:** `[ ] Not started`

---

## Step 22 — Search, Caching & i18n
> **Goal:** Fulltext search for competitions, teams, projects. Caching for hot paths. Full i18n coverage.

### Deliverables
- `competitions/search.ts`, `teams/search.ts`, `projects/search.ts` — search configs per spec §13
- Caching: competition config (5min), track list (5min), leaderboard (30s), check-in count (10s), team/submission stats (30s) — per spec §16
- `i18n/en.json` and `i18n/pl.json` for all 7 modules — complete translation coverage
- `yarn generate` after search configs

### Verify
- [ ] Search: typing "team name" in backend search returns matching team
- [ ] Search: typing "project title" returns matching project
- [ ] Cache: competition config fetched from cache (verify with debug logging)
- [ ] Cache invalidated on competition update
- [ ] All UI text in English renders correctly
- [ ] Language switch to Polish renders correctly

**Status:** `[ ] Not started`

---

## Step 23 — Mobile, Accessibility & Offline
> **Goal:** Mobile responsiveness pass. WCAG 2.1 AA audit. Offline resilience (service worker, localStorage).

### Deliverables
- Mobile pass: all portal pages tested at 375px width, adjustments per spec §15.1 (stacked fields, card layouts, touch targets ≥ 48px, no drag-to-reorder on mobile)
- Accessibility: contrast ratios on track colors, ARIA labels on all interactive elements, `aria-live` regions for real-time updates, timer `aria-label`, keyboard navigation, tab order on forms
- Offline: service worker caches agenda/team roster/competition config, "Offline" banner, write queue (votes, scores, drafts) in localStorage, retry on reconnect, project editor localStorage backup
- SSE reconnection: "Reconnecting..." indicator, fetch current state on reconnect, "Connected" briefly
- Empty states for all list pages per spec §15.5
- Onboarding tooltip tour (3-5 steps) on first login per spec §15.6
- Confirmation dialogs on all destructive actions per spec §14.5

### Verify
- [ ] All portal pages render correctly on 375px mobile
- [ ] Score card uses tappable buttons, works on touch
- [ ] Demo queue: no drag-to-reorder on mobile, up/down arrows instead
- [ ] Track color badges pass 4.5:1 contrast ratio
- [ ] Timer kiosk readable without color ("TIME'S UP" text label)
- [ ] Keyboard navigation works on all forms
- [ ] Offline: disconnect Wi-Fi → banner shows → cached data visible
- [ ] Offline: cast vote offline → reconnect → vote synced
- [ ] Empty states show on all list pages when no data
- [ ] Onboarding tour shows on first login
- [ ] All destructive actions have confirmation dialogs

**Status:** `[ ] Not started`

---

## Step 24 — End-to-End Testing & Polish
> **Goal:** Full competition lifecycle test. Integration tests for cross-module event flows. Final polish.

### Deliverables
- E2E test: create competition → register participants → check in → form teams → select tracks → advance to HACKING → edit projects → submit → advance to DEMOS → demo queue → score projects → advance to DELIBERATION → assign prizes → publish results → verify leaderboard
- Integration tests: stage advance side effects (per spec §18)
- Unit tests: score calculation, vote limit, stage transition validation, Zod config validators
- Dry run mode: `GET /api/competitions/:id/stage-preview` returns accurate predictions
- Final polish: loading states, flash messages after actions, progress indicators

### Verify
- [ ] Full lifecycle E2E test passes
- [ ] Integration tests pass for all stage transition side effects
- [ ] Unit tests pass for scoring, voting, validation
- [ ] Stage preview returns accurate predictions
- [ ] No broken pages, no console errors
- [ ] All acceptance criteria from spec checked off

**Status:** `[ ] Not started`

---

## Progress Summary

| Step | Description | Status |
|------|-------------|--------|
| 0 | Directory Structure & Module Registration | [x] Done |
| 1 | Competition Entity & Admin CRUD | [x] Done |
| 2 | Competition Stage Machine | [x] Done |
| 3 | Participant Profile & Competition Participation | [x] Done |
| 4 | Portal Shell & Auth Gates | [x] Done |
| 5 | Agenda & Announcements | [x] Done |
| 6 | Competition Context Enricher & Check-In Scanner | [x] Done |
| 7 | Tracks Module | [ ] Not started |
| 8 | Teams: Entity & Creation | [ ] Not started |
| 9 | Teams: Invitations & Join Requests | [ ] Not started |
| 10 | Teams: Track Selection & Stage Lockdown | [ ] Not started |
| 11 | Projects: Entity & Editor | [ ] Not started |
| 12 | Projects: Submission & Flagging | [ ] Not started |
| 13 | Judging: Panels & Criteria | [ ] Not started |
| 14 | Judging: Demo Queue & Timer | [ ] Not started |
| 15 | Judging: Score Submission & Leaderboard | [ ] Not started |
| 16 | Judging: Two-Round & Finalists | [ ] Not started |
| 17 | Sponsors & Prizes | [ ] Not started |
| 18 | People's Choice Voting | [ ] Not started |
| 19 | Results & Prize Announcement | [ ] Not started |
| 20 | Incidents Module | [ ] Not started |
| 21 | Event Command Center | [ ] Not started |
| 22 | Search, Caching & i18n | [ ] Not started |
| 23 | Mobile, Accessibility & Offline | [ ] Not started |
| 24 | End-to-End Testing & Polish | [ ] Not started |
