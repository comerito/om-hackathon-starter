# SPEC-001 — HackOn Platform Implementation on Open Mercato

| Field   | Value |
|---------|-------|
| Number  | SPEC-001 |
| Title   | HackOn Hackathon Management Platform |
| Date    | 2026-03-17 |
| Status  | Draft |
| Source  | `hackon-app-spec.md` |

---

## TLDR

- Build a hackathon management platform as **7 custom OM modules** + heavy leverage of **5 built-in OM modules** (`customer_accounts`, `auth`, `notifications`, `audit_logs`, `attachments`).
- Hackathon participants/mentors/judges are **CustomerUser** entities with custom roles — the participant-facing app is a **Portal**. Admins use the **Backend**.
- Real-time event coordination (stage changes, demo timer, announcements, scoring) powered by OM's **DOM Event Bridge (SSE)** with `clientBroadcast` and `portalBroadcast`.
- Competition stage machine (DRAFT → OPEN → TEAM_FORMATION → TRACK_SELECTION → HACKING → DEMOS → DELIBERATION → FINISHED → ARCHIVED) implemented as a state field with transition commands and event-driven side effects.
- Phased delivery: Foundation → Team/Track → Hacking/Projects → Demos/Judging → Results/Prizes → Polish.
- Mobile-first responsive design with WCAG 2.1 AA compliance.
- GDPR/RODO compliant with privacy policy acceptance gate and data anonymization capability.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Map](#2-module-map)
3. [Built-In Module Leverage](#3-built-in-module-leverage)
4. [Custom Module Specifications](#4-custom-module-specifications)
5. [Data Models](#5-data-models)
6. [API Contracts](#6-api-contracts)
7. [Portal Pages (Participant/Mentor/Judge)](#7-portal-pages)
8. [Backend Pages (Admin)](#8-backend-pages)
9. [Event Architecture](#9-event-architecture)
10. [Notification Plan](#10-notification-plan)
11. [Real-Time Features](#11-real-time-features)
12. [Access Control Matrix](#12-access-control-matrix)
13. [Search Configuration](#13-search-configuration)
14. [Framework Compliance Rules](#14-framework-compliance-rules)
15. [Non-Functional Requirements (Mobile, Accessibility, Offline, GDPR)](#15-non-functional-requirements)
16. [Caching Strategy](#16-caching-strategy)
17. [Deployment Architecture](#17-deployment-architecture)
18. [Testing Strategy](#18-testing-strategy)
19. [Implementation Plan](#19-implementation-plan)
20. [Risks](#20-risks)
21. [Design Decisions](#21-design-decisions)

---

## 1. Architecture Overview

### Conceptual Mapping: HackOn → Open Mercato

| HackOn Concept | Open Mercato Concept | Notes |
|----------------|---------------------|-------|
| Admin | Staff user (`auth` module) | Uses backend panel (`/backend/*`) |
| Participant | `CustomerUser` with role `participant` | Uses portal (`/[orgSlug]/portal/*`) |
| Mentor | `CustomerUser` with role `mentor` | Uses portal, limited views |
| Judge | `CustomerUser` with role `judge` | Uses portal, judging dashboard |
| User profile | `CustomerUser` fields + extension entity | Skills, bio, social links |
| Activity Log | `audit_logs` module | Built-in append-only audit trail |
| File uploads | `attachments` module | Screenshots, avatars, docs |
| Notifications | `notifications` module | In-app + email channels |
| Real-time updates | DOM Event Bridge (SSE) | `clientBroadcast` + `portalBroadcast` |
| Code of Conduct acceptance | Custom field on `CompetitionParticipation` | Gate via portal middleware |

### System Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Admin)                          │
│  /backend/competitions  /backend/teams  /backend/judging  ...   │
│  Built with: DataTable, CrudForm, FormHeader, Flash             │
│  Auth: auth module (staff JWT)                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ apiCall → /api/*
┌────────────────────────────▼────────────────────────────────────┐
│                       API LAYER (Next.js)                       │
│  /api/competitions/*  /api/teams/*  /api/judging/*  ...         │
│  RBAC guards, Zod validation, makeCrudRoute                     │
│  Events emitted → SSE broadcast                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ apiCall → /api/*
┌────────────────────────────▼────────────────────────────────────┐
│                   PORTAL (Participants/Judges/Mentors)           │
│  /[orgSlug]/portal/dashboard  /portal/team  /portal/project ... │
│  Built with: PortalShell, PortalCard, useCustomerAuth           │
│  Auth: customer_accounts module (customer JWT)                   │
│  Real-time: usePortalAppEvent for live updates                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Map

### Custom Modules (from: `@app`)

| # | Module ID | Entities | Purpose |
|---|-----------|----------|---------|
| 1 | `competitions` | Competition, CompetitionParticipation, ParticipantProfile, AgendaItem, Announcement | Hub entity, stages, schedule, comms |
| 2 | `tracks` | Track | Thematic categories within competition |
| 3 | `teams` | Team, TeamMember, TeamInvitation | Team lifecycle, formation, invitations |
| 4 | `projects` | Project (media via JSONB references to `attachments` module) | Submissions, media, originality |
| 5 | `judging` | JudgePanel, JudgePanelJudge, JudgePanelTrack, JudgingCriterion, ProjectScore, CriterionScore, DemoSession | Scoring, criteria, demo queue, timer |
| 6 | `sponsors` | Sponsor, Prize, PeerVote | Partners, awards |
| 7 | `incidents` | IncidentReport | CoC violation reporting |

### Built-In Modules Leveraged

| Module | What We Use |
|--------|-------------|
| `customer_accounts` | All participant/mentor/judge auth, invitation flow, portal sessions, customer RBAC, profile management |
| `auth` | Admin authentication and staff management |
| `notifications` | In-app push + email notifications for all event triggers |
| `audit_logs` | ActivityLog — append-only audit trail for all domain actions |
| `attachments` | File uploads for project screenshots, avatars, presentation slides |
| `portal` | Portal shell, navigation chrome, event bridge |
| `search` | Fulltext search for participants, teams, projects |

### Module Registration (`src/modules.ts` additions)

```typescript
{ id: 'competitions', from: '@app' },
{ id: 'tracks', from: '@app' },
{ id: 'teams', from: '@app' },
{ id: 'projects', from: '@app' },
{ id: 'judging', from: '@app' },
{ id: 'sponsors', from: '@app' },
{ id: 'incidents', from: '@app' },
```

---

## 3. Built-In Module Leverage

### 3.1 customer_accounts — User Roles

HackOn's four roles map to OM's customer role system:

| HackOn Role | CustomerRole name | Default Features |
|-------------|------------------|------------------|
| Participant | `participant` | `portal.competitions.view`, `portal.teams.*`, `portal.projects.*`, `portal.voting.*` |
| Mentor | `mentor` | `portal.competitions.view`, `portal.teams.view`, `portal.projects.view`, `portal.mentoring.*` |
| Judge | `judge` | `portal.competitions.view`, `portal.judging.*`, `portal.projects.view` |

**Admin onboarding flow (matches spec §2.2):**
1. Admin creates `CustomerUser` via backend panel (name, email, role, organization, bio)
2. System sends invitation email via `customer_accounts` invitation flow (magic link)
3. User activates account, sets password, completes profile
4. CoC acceptance gate enforced on portal middleware (checks `CompetitionParticipation.coc_accepted`)
5. Check-in via QR → updates `CompetitionParticipation.checked_in = true`

**Key APIs already available:**
- `POST /api/customer_accounts/invitations/accept` — accept invitation
- `POST /api/customer_accounts/magic-link/request` — magic link login
- `POST /api/customer_accounts/login` — email/password login
- `POST /api/customer_accounts/portal/password-change` — password change
- Server-side: `getCustomerAuthFromCookies()` for auth checks
- Client-side: `useCustomerAuth()` for portal components

**Profile extension — `ParticipantProfile` entity** in the `competitions` module extends `CustomerUser` with hackathon-specific fields:
- `customerUserId: UUID` (FK → customer_accounts.CustomerUser)
- `bio: text`
- `organization: varchar(255)`
- `skills: string[]` (JSONB)
- `socialLinks: { github?, linkedin?, twitter?, website? }` (JSONB)
This entity is created when the user activates their account. Linked via `data/extensions.ts`.

**User status lifecycle mapping:**

| HackOn Status | OM CustomerUser State | Trigger |
|---------------|----------------------|---------|
| INVITED | CustomerUserInvitation created, not yet accepted | Admin creates user |
| ACTIVE | CustomerUser.isActive = true | User accepts invitation |
| CHECKED_IN | CompetitionParticipation.checkedIn = true | QR scan / admin confirms |
| DEACTIVATED | CustomerUser.isActive = false | Admin deactivates |

**Re-sending invitations:** Use the built-in `customer_accounts` resend invitation API (`POST /api/customer_accounts/invitations/resend`).

**Admin impersonation:** Deferred to Phase 2. Will use a custom endpoint that generates a temporary portal session token for a specific CustomerUser, allowing admin to preview the portal experience.

**Decision: Use `CompetitionParticipation` entity** in the `competitions` module as a join table between `CustomerUser` and `Competition`. This holds: role-in-competition, checked_in status, CoC acceptance, badge_printed. This is a cross-module FK reference (competition_id + customer_user_id).

### 3.2 audit_logs — Activity Log

The spec's ActivityLog (§3.19) maps directly to OM's built-in `audit_logs` module. Every CRUD operation through `makeCrudRoute` + `emitCrudSideEffects` already generates audit entries.

**Custom audit entries** for domain-specific actions (stage transitions, prize awards, disqualifications) are emitted via events → audit subscriber pattern:

```typescript
// In competitions module
emitCompetitionsEvent('competitions.competition.stage_advanced', {
  competitionId, oldStage, newStage, advancedBy: adminUserId,
})
```

A persistent subscriber writes to audit_logs with the `metadata` JSON containing old/new values.

**Anonymous incident protection:** The incident report creation endpoint MUST bypass the standard audit log for anonymous reports (where `reporterId` is null). Instead, a custom audit entry is written with `actorId` set to a system user, preserving reporter anonymity.

### 3.3 attachments — File Uploads

Project screenshots, team avatars, sponsor logos all use the `attachments` module. Reference pattern:
- `Project` entity stores `screenshot_attachment_ids: string[]` (JSONB array of attachment UUIDs)
- Frontend uses the attachment upload widget
- Thumbnails/resizing handled by attachments module

### 3.4 notifications — Event-Driven Notifications

Each notification trigger from spec §7 is implemented as:
1. Domain event emitted (e.g., `teams.invitation.created`)
2. Persistent subscriber catches event
3. Subscriber calls notification service to create notification
4. Notification delivered via configured channels (in_app, email)

See [§10 Notification Plan](#10-notification-plan) for the full mapping.

### 3.5 Portal — Participant App Shell

The entire participant-facing experience runs inside OM's Portal:
- `PortalShell` provides header, sidebar, footer, event bridge
- `usePortalAppEvent()` enables real-time updates (stage changes, timer, announcements)
- Portal menu injection adds HackOn-specific nav items
- Portal dashboard widgets show role-specific content

---

## 4. Custom Module Specifications

### 4.1 Module: `competitions`

**Purpose:** Central hub entity. Manages competition lifecycle, stages, schedule, and announcements.

**Entities:**
- `Competition` — the hackathon event
- `CompetitionParticipation` — join table: user ↔ competition (with role, check-in, CoC)
- `ParticipantProfile` — hackathon-specific profile fields (skills, bio, social links)
- `AgendaItem` — scheduled events
- `Announcement` — admin broadcasts

**Key Features:**
- Stage state machine with transition commands
- Stage transition emits events that trigger side effects across all modules
- Configuration stored as JSONB (stage_config, demo_config, judging_config, peer_voting_config)
- Admin real-time dashboard (event command center)

**ACL Features:**
```
competitions.view, competitions.create, competitions.edit, competitions.delete,
competitions.stages.manage, competitions.agenda.manage, competitions.announcements.manage,
competitions.participants.manage, competitions.checkin.manage
```

**Portal Customer Role Features:**
```
portal.competitions.view, portal.competitions.checkin
```

---

### 4.2 Module: `tracks`

**Purpose:** Thematic categories teams choose to compete in.

**Entities:**
- `Track` — track definition with color, icon, description, team cap

**Cross-module FKs:** `competition_id` → competitions

**ACL Features:**
```
tracks.view, tracks.create, tracks.edit, tracks.delete
```

**Portal Customer Role Features:**
```
portal.tracks.view
```

---

### 4.3 Module: `teams`

**Purpose:** Team formation, membership, and invitation lifecycle.

**Entities:**
- `Team` — team with status (ACTIVE/DISQUALIFIED/WITHDRAWN)
- `TeamMember` — join table: user ↔ team (with role: OWNER/MEMBER)
- `TeamInvitation` — invitations and join requests

**Cross-module FKs:** `competition_id` → competitions, `track_id` → tracks, `user_id` → customer_accounts

**Business Logic:**
- One team per user per competition (enforced in create command)
- Team size constraints from competition config
- Ownership transfer on owner leave
- Auto-lock membership at HACKING stage (event subscriber listens to `competitions.competition.stage_advanced`)
- Grace period for changes if configured

**ACL Features:**
```
teams.view, teams.create, teams.edit, teams.delete, teams.manage, teams.disqualify
```

**Portal Customer Role Features:**
```
portal.teams.view, portal.teams.create, portal.teams.join, portal.teams.invite, portal.teams.leave,
portal.teams.manage (owner-only, runtime check)
```

---

### 4.4 Module: `projects`

**Purpose:** Team deliverables — submissions, media, originality disclosure.

**Entities:**
- `Project` — the submission (title, description, tech stack, URLs, disclosure, status)

**Cross-module FKs:** `team_id` → teams, `competition_id` → competitions, `track_id` → tracks

**Business Logic:**
- One project per team per competition
- Auto-created in DRAFT when HACKING starts (subscriber on stage_advanced)
- DRAFT → PUBLISHED transition validates required fields + disclosure
- PUBLISHED = locked (admin can grant exceptions)
- Flagging flow for undisclosed code reuse (admin action)

**ACL Features:**
```
projects.view, projects.create, projects.edit, projects.delete, projects.manage, projects.flag
```

**Portal Customer Role Features:**
```
portal.projects.view, portal.projects.edit (team members only, runtime check),
portal.projects.submit (team owner only)
```

---

### 4.5 Module: `judging`

**Purpose:** Judge panels, scoring criteria, scoring forms, demo session management, presentation timer.

**Entities:**
- `JudgePanel` — group of judges for a round (PRELIMINARY/FINAL)
- `JudgePanelJudge` — junction: panel ↔ judge (customer_user_id)
- `JudgePanelTrack` — junction: panel ↔ track
- `JudgingCriterion` — scoring dimension (name, weight, max_score, round)
- `ProjectScore` — one judge's full evaluation of one project
- `CriterionScore` — individual criterion score within a ProjectScore
- `DemoSession` — presentation queue entry with timing

**Cross-module FKs:** `competition_id`, `track_id`, `project_id`, `team_id`, `judge_id` (customer_user_id)

**Business Logic:**
- Each judge scores each assigned project once per round
- Scores updatable until DELIBERATION ends
- Preliminary round: average of all judges' total_scores
- Final round: weighted combo of preliminary + final
- Demo timer: server-authoritative with SSE broadcast
- Admin controls: start/pause/skip/reorder demo queue
- Conflict of interest recusal flag
- Project distribution: configurable via `JudgingConfig.projectDistribution: 'all' | 'distributed'`. When 'all', every judge in the panel sees all projects in the track. When 'distributed', projects are evenly assigned across judges in the panel.
- Score computation: Leaderboard scores are computed on-demand during DELIBERATION (not persisted). `Project.finalScore` is written as a snapshot only when advancing to FINISHED. Admin can trigger 'Recalculate Scores' at any time.
- Disqualified teams (status = DISQUALIFIED) are excluded from the leaderboard. Admin sees them with a strikethrough indicator.
- Admin can override computed rankings via `Project.manualRankOverride: int?` field.

**ACL Features:**
```
judging.view, judging.manage, judging.panels.manage, judging.criteria.manage,
judging.scores.view, judging.scores.manage, judging.demos.manage,
judging.finalists.manage, judging.results.view, judging.results.manage
```

**Portal Customer Role Features:**
```
portal.judging.score (judge only), portal.judging.view_assigned (judge),
portal.judging.demos.view (all roles), portal.judging.results.view (after FINISHED)
```

---

### 4.6 Module: `sponsors`

**Purpose:** Partner management and prize/award system.

**Entities:**
- `Sponsor` — partner with tier, logo, optional challenge
- `Prize` — award definition with category, value, track/sponsor association
- `PeerVote` — People's Choice vote cast by participants

**Cross-module FKs:** `competition_id`, `track_id`, `sponsor_id`, `winning_project_id`, `winning_team_id`, `voter_id`

**Business Logic:**
- Prize assignment by admin during DELIBERATION/FINISHED
- People's Choice auto-suggested from vote tally
- Peer voting: N votes per participant, no self-voting, time-windowed
- Sponsor challenges linked to prizes
- Vote change configuration: `PeerVotingConfig.allowVoteChange: boolean` (default: false). When true, participants can retract and re-cast votes until the window closes.

**ACL Features:**
```
sponsors.view, sponsors.create, sponsors.edit, sponsors.delete, sponsors.manage,
sponsors.prizes.manage, sponsors.prizes.assign
```

**Portal Customer Role Features:**
```
portal.sponsors.view, portal.voting.cast (participant only), portal.voting.view
```

---

### 4.7 Module: `incidents`

**Purpose:** Code of Conduct incident reporting and resolution.

**Entities:**
- `IncidentReport` — report with severity, status, resolution

**Cross-module FKs:** `competition_id`, `reporter_id` (nullable for anonymous), `reported_user_id`

**Business Logic:**
- Any user can file from any screen (persistent button in portal shell)
- Anonymous reports allowed (reporter_id = null)
- HIGH/CRITICAL → immediate admin notification
- Resolution can trigger team disqualification (emits event, teams module subscribes)

**ACL Features:**
```
incidents.view, incidents.manage, incidents.resolve
```

**Portal Customer Role Features:**
```
portal.incidents.report (all roles)
```

---

## 5. Data Models

### 5.1 competitions module

#### Competition

```typescript
@Entity({ tableName: 'competitions_competition' })
@Unique({ properties: ['slug', 'tenantId'] })
class Competition {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'varchar', length: 255 })
  slug!: string

  @Property({ type: 'text', nullable: true })
  description?: string

  @Property({ type: 'varchar', length: 500, nullable: true })
  location?: string

  @Property({ type: 'timestamptz' })
  startsAt!: Date

  @Property({ type: 'timestamptz' })
  endsAt!: Date

  @Property({ type: 'varchar', length: 50, default: 'Europe/Warsaw' })
  timezone!: string

  @Enum({ items: () => CompetitionStage, default: CompetitionStage.DRAFT })
  stage!: CompetitionStage

  // Team constraints
  @Property({ type: 'int', default: 2 })
  minTeamSize!: number

  @Property({ type: 'int', default: 5 })
  maxTeamSize!: number

  @Property({ type: 'int', nullable: true })
  maxTeamsPerTrack?: number

  @Property({ type: 'boolean', default: false })
  allowTrackChange!: boolean

  @Property({ type: 'timestamptz', nullable: true })
  projectSubmissionDeadline?: Date

  @Property({ type: 'timestamptz', nullable: true })
  judgingDeadline?: Date

  // JSONB configuration blocks
  @Property({ type: 'jsonb', default: '{}' })
  stageConfig!: StageConfig

  @Property({ type: 'jsonb', default: '{}' })
  demoConfig!: DemoConfig

  @Property({ type: 'jsonb', default: '{}' })
  judgingConfig!: JudgingConfig

  @Property({ type: 'jsonb', default: '{}' })
  peerVotingConfig!: PeerVotingConfig

  // Legal
  @Property({ type: 'varchar', length: 1000 })
  codeOfConductUrl!: string

  @Property({ type: 'varchar', length: 1000, nullable: true })
  rulesUrl?: string

  @Property({ type: 'varchar', length: 1000, nullable: true })
  privacyPolicyUrl?: string

  // Media
  @Property({ type: 'varchar', length: 1000, nullable: true })
  coverImageUrl?: string

  // Multi-tenancy (required by OM)
  @Property({ type: 'uuid' })
  @Index()
  tenantId!: string

  @Property({ type: 'uuid' })
  @Index()
  organizationId!: string

  @Property({ type: 'boolean', default: true })
  isActive!: boolean

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date

  @Property({ type: 'timestamptz', nullable: true })
  deletedAt?: Date
}

enum CompetitionStage {
  DRAFT = 'draft',
  OPEN = 'open',
  TEAM_FORMATION = 'team_formation',
  TRACK_SELECTION = 'track_selection',
  HACKING = 'hacking',
  DEMOS = 'demos',
  DELIBERATION = 'deliberation',
  FINISHED = 'finished',
  ARCHIVED = 'archived',
}

// JSONB type interfaces
interface StageConfig {
  allowSimultaneousFormationAndTrack: boolean    // default: false
  allowTeamChangesDuringHacking: boolean         // default: false
  teamChangeGracePeriodMinutes: number | null    // default: null
  allowSoloParticipants: boolean                 // default: false
}

interface DemoConfig {
  format: 'stage_presentation'                   // Currently only supported format
  presentationDurationMinutes: number            // default: 3
  qaDurationMinutes: number                      // default: 2
  setupBufferMinutes: number                     // default: 1
  finalistsPerTrack: number | null               // default: null
}

interface JudgingConfig {
  rounds: 1 | 2                           // default: 1
  preliminaryJudgesPerProject: number     // default: 3
  finalistsPerTrack: number               // default: 3
  preliminaryWeight: number               // default: 0.4 (for 2-round)
  finalWeight: number                     // default: 0.6 (for 2-round)
  projectDistribution: 'all' | 'distributed'  // default: 'all'
  finalRoundFormat: 'stage_presentation'       // Currently only supported format
}

interface PeerVotingConfig {
  enabled: boolean              // default: true
  votesPerPerson: number        // default: 3
  votingStartsAt: string | null // ISO datetime
  votingEndsAt: string | null   // ISO datetime
  allowVoteChange: boolean      // default: false
}

// Zod validators for JSONB config blocks (MUST validate on every write, defensive-parse on read)
const stageConfigSchema = z.object({
  allowSimultaneousFormationAndTrack: z.boolean().default(false),
  allowTeamChangesDuringHacking: z.boolean().default(false),
  teamChangeGracePeriodMinutes: z.number().nullable().default(null),
  allowSoloParticipants: z.boolean().default(false),
})

const demoConfigSchema = z.object({
  format: z.literal('stage_presentation').default('stage_presentation'),
  presentationDurationMinutes: z.number().int().min(1).default(3),
  qaDurationMinutes: z.number().int().min(0).default(2),
  setupBufferMinutes: z.number().int().min(0).default(1),
  finalistsPerTrack: z.number().int().nullable().default(null),
})

const judgingConfigSchema = z.object({
  rounds: z.union([z.literal(1), z.literal(2)]).default(1),
  preliminaryJudgesPerProject: z.number().int().min(1).default(3),
  finalistsPerTrack: z.number().int().min(1).default(3),
  preliminaryWeight: z.number().min(0).max(1).default(0.4),
  finalWeight: z.number().min(0).max(1).default(0.6),
  projectDistribution: z.enum(['all', 'distributed']).default('all'),
  finalRoundFormat: z.literal('stage_presentation').default('stage_presentation'),
})

const peerVotingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  votesPerPerson: z.number().int().min(1).default(3),
  votingStartsAt: z.string().nullable().default(null),
  votingEndsAt: z.string().nullable().default(null),
  allowVoteChange: z.boolean().default(false),
})
```

#### CompetitionParticipation

```typescript
@Entity({ tableName: 'competitions_participation' })
@Unique({ properties: ['competitionId', 'customerUserId'] })
class CompetitionParticipation {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'uuid' })
  @Index()
  customerUserId!: string    // FK → customer_accounts.CustomerUser

  @Enum({ items: () => ParticipationRole })
  role!: ParticipationRole

  @Property({ type: 'boolean', default: false })
  checkedIn!: boolean

  @Property({ type: 'timestamptz', nullable: true })
  checkedInAt?: Date

  @Property({ type: 'boolean', default: false })
  badgePrinted!: boolean

  // Code of Conduct
  @Property({ type: 'boolean', default: false })
  cocAccepted!: boolean

  @Property({ type: 'timestamptz', nullable: true })
  cocAcceptedAt?: Date

  // Privacy Policy
  @Property({ type: 'boolean', default: false })
  privacyPolicyAccepted!: boolean

  @Property({ type: 'timestamptz', nullable: true })
  privacyPolicyAcceptedAt?: Date

  // Profile completeness
  @Property({ type: 'boolean', default: false })
  profileComplete!: boolean

  // "Looking for team" status
  @Property({ type: 'boolean', default: false })
  lookingForTeam!: boolean

  @Property({ type: 'text', nullable: true })
  lookingForTeamDescription?: string

  // Multi-tenancy
  @Property({ type: 'uuid' })
  @Index()
  tenantId!: string

  @Property({ type: 'uuid' })
  @Index()
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}

enum ParticipationRole {
  PARTICIPANT = 'participant',
  MENTOR = 'mentor',
  JUDGE = 'judge',
}
```

#### ParticipantProfile

```typescript
@Entity({ tableName: 'competitions_participant_profile' })
@Unique({ properties: ['customerUserId', 'tenantId'] })
class ParticipantProfile {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  customerUserId!: string  // FK → customer_accounts.CustomerUser

  @Property({ type: 'text', nullable: true })
  bio?: string

  @Property({ type: 'varchar', length: 255, nullable: true })
  organization?: string

  @Property({ type: 'jsonb', default: '[]' })
  skills!: string[]   // ["TypeScript", "AI/ML", "Design"]

  @Property({ type: 'jsonb', default: '{}' })
  socialLinks!: {
    github?: string
    linkedin?: string
    twitter?: string
    website?: string
  }

  // Multi-tenancy
  @Property({ type: 'uuid' })
  @Index()
  tenantId!: string

  @Property({ type: 'uuid' })
  @Index()
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}
```

#### AgendaItem

```typescript
@Entity({ tableName: 'competitions_agenda_item' })
class AgendaItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  title!: string

  @Property({ type: 'text', nullable: true })
  description?: string

  @Enum({ items: () => AgendaItemType })
  type!: AgendaItemType

  @Property({ type: 'timestamptz' })
  startsAt!: Date

  @Property({ type: 'timestamptz' })
  endsAt!: Date

  @Property({ type: 'varchar', length: 255, nullable: true })
  location?: string

  @Property({ type: 'varchar', length: 255, nullable: true })
  speakerName?: string

  @Property({ type: 'text', nullable: true })
  speakerBio?: string

  @Property({ type: 'uuid', nullable: true })
  trackId?: string    // FK → tracks.Track (if track-specific)

  @Property({ type: 'boolean', default: false })
  isMandatory!: boolean

  @Property({ type: 'int', default: 0 })
  order!: number

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}

enum AgendaItemType {
  CEREMONY = 'ceremony',
  TALK = 'talk',
  WORKSHOP = 'workshop',
  BREAK = 'break',
  MEAL = 'meal',
  DEADLINE = 'deadline',
  DEMO_SESSION = 'demo_session',
  CUSTOM = 'custom',
}
```

#### Announcement

```typescript
@Entity({ tableName: 'competitions_announcement' })
class Announcement {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'uuid' })
  authorId!: string   // FK → auth staff user who created it

  @Property({ type: 'varchar', length: 255 })
  title!: string

  @Property({ type: 'text' })
  content!: string

  @Enum({ items: () => AnnouncementPriority, default: AnnouncementPriority.INFO })
  priority!: AnnouncementPriority

  // Targeting (JSONB arrays for flexibility)
  @Property({ type: 'jsonb', default: '[]' })
  targetRoles!: string[]     // empty = all roles

  @Property({ type: 'jsonb', default: '[]' })
  targetTrackIds!: string[]  // empty = all tracks

  @Property({ type: 'boolean', default: false })
  pinned!: boolean

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  publishedAt!: Date

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date
}

enum AnnouncementPriority {
  INFO = 'info',
  WARNING = 'warning',
  URGENT = 'urgent',
}
```

---

### 5.2 tracks module

#### Track

```typescript
@Entity({ tableName: 'tracks_track' })
class Track {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string

  @Property({ type: 'varchar', length: 7, default: '#6366f1' })
  color!: string

  @Property({ type: 'varchar', length: 500, nullable: true })
  iconUrl?: string

  @Property({ type: 'int', nullable: true })
  maxTeams?: number

  @Property({ type: 'int', default: 0 })
  order!: number

  // Mentor assignments (JSONB array of customer_user_ids)
  @Property({ type: 'jsonb', default: '[]' })
  mentorIds!: string[]
  // GIN index required: CREATE INDEX ON tracks_track USING GIN (mentor_ids jsonb_path_ops)

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'boolean', default: true })
  isActive!: boolean

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}
```

**Design Decision — Mentor assignments as JSONB:** Mentor-to-track is a many-to-many relationship but with small cardinality (typically 2-5 mentors per track, 3-5 tracks). A junction table would be normalized but adds module complexity. Since we only query "which mentors are on this track" (not "which tracks is this mentor on" — that's a portal view derived from scanning tracks), a JSONB array of UUIDs is simpler and sufficient. If bidirectional queries become needed, we can add a response enricher.

---

### 5.3 teams module

#### Team

```typescript
@Entity({ tableName: 'teams_team' })
class Team {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'uuid', nullable: true })
  @Index()
  trackId?: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string

  @Property({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string

  @Enum({ items: () => TeamStatus, default: TeamStatus.ACTIVE })
  @Index()
  status!: TeamStatus

  @Property({ type: 'text', nullable: true })
  disqualificationReason?: string

  @Property({ type: 'timestamptz', nullable: true })
  disqualifiedAt?: Date

  @Property({ type: 'uuid', nullable: true })
  disqualifiedBy?: string

  // Demo presentation
  @Property({ type: 'int', nullable: true })
  presentationOrder?: number

  @Property({ type: 'timestamptz', nullable: true })
  presentationTimeSlot?: Date   // Denormalized from DemoSession.scheduledStart for quick access

  @Property({ type: 'boolean', default: false })
  isFinalist!: boolean

  // Table assignment
  @Property({ type: 'int', nullable: true })
  tableNumber?: number

  @Property({ type: 'varchar', length: 255, nullable: true })
  tableLocation?: string

  // Multi-tenancy
  @Property({ type: 'uuid' })
  @Index()
  tenantId!: string

  @Property({ type: 'uuid' })
  @Index()
  organizationId!: string

  @Property({ type: 'boolean', default: true })
  isActive!: boolean

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date

  @Property({ type: 'timestamptz', nullable: true })
  deletedAt?: Date
}

enum TeamStatus {
  ACTIVE = 'active',
  DISQUALIFIED = 'disqualified',
  WITHDRAWN = 'withdrawn',
}
```

#### TeamMember

```typescript
@Entity({ tableName: 'teams_team_member' })
@Unique({ properties: ['competitionId', 'customerUserId'] }) // One team per user per competition
class TeamMember {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  teamId!: string

  @Property({ type: 'uuid' })
  @Index()
  customerUserId!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string   // Denormalized for the unique constraint

  @Enum({ items: () => TeamRole })
  role!: TeamRole

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  joinedAt!: Date

  @Property({ type: 'timestamptz', nullable: true })
  leftAt?: Date   // When the member left (null = still active)

  @Property({ type: 'timestamptz', nullable: true })
  deletedAt?: Date   // Soft delete — preserves membership history

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string
}

enum TeamRole {
  OWNER = 'owner',
  MEMBER = 'member',
}
```

#### TeamInvitation

```typescript
@Entity({ tableName: 'teams_invitation' })
class TeamInvitation {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  teamId!: string

  @Property({ type: 'uuid' })
  inviterId!: string    // customer_user_id

  @Property({ type: 'uuid' })
  @Index()
  inviteeId!: string    // customer_user_id

  @Enum({ items: () => InvitationType })
  type!: InvitationType

  @Enum({ items: () => InvitationStatus, default: InvitationStatus.PENDING })
  @Index()
  status!: InvitationStatus

  @Property({ type: 'text', nullable: true })
  message?: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', nullable: true })
  respondedAt?: Date

  @Property({ type: 'timestamptz' })
  expiresAt!: Date

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'uuid' })
  competitionId!: string
}

enum InvitationType {
  INVITE = 'invite',         // Owner invites participant
  JOIN_REQUEST = 'join_request', // Participant requests to join
}

enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}
```

---

### 5.4 projects module

#### Project

```typescript
@Entity({ tableName: 'projects_project' })
@Unique({ properties: ['teamId', 'competitionId'] })  // One project per team per competition
class Project {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  teamId!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'uuid' })
  @Index()
  trackId!: string

  // Content
  @Property({ type: 'varchar', length: 255 })
  title!: string

  @Property({ type: 'varchar', length: 140, nullable: true })
  tagline?: string

  @Property({ type: 'text', nullable: true })
  description?: string

  @Property({ type: 'text', nullable: true })
  problemStatement?: string

  @Property({ type: 'text', nullable: true })
  solution?: string

  @Property({ type: 'jsonb', default: '[]' })
  techStack!: string[]

  // Links
  @Property({ type: 'varchar', length: 1000, nullable: true })
  demoUrl?: string

  @Property({ type: 'varchar', length: 1000, nullable: true })
  repoUrl?: string

  @Property({ type: 'varchar', length: 1000, nullable: true })
  videoUrl?: string

  @Property({ type: 'varchar', length: 1000, nullable: true })
  presentationUrl?: string

  // Media (attachment IDs from OM attachments module)
  @Property({ type: 'jsonb', default: '[]' })
  screenshotIds!: string[]

  @Property({ type: 'jsonb', default: '[]' })
  attachmentIds!: string[]

  // Originality Disclosure
  @Property({ type: 'boolean', default: false })
  usesPreexistingCode!: boolean

  @Property({ type: 'text', nullable: true })
  preexistingCodeDescription?: string

  @Property({ type: 'text', nullable: true })
  builtDuringHackathonDescription?: string

  @Property({ type: 'boolean', default: false })
  flaggedForReuse!: boolean

  @Property({ type: 'uuid', nullable: true })
  flaggedBy?: string

  @Property({ type: 'timestamptz', nullable: true })
  flaggedAt?: Date

  @Property({ type: 'text', nullable: true })
  flaggedReason?: string

  // Status
  @Enum({ items: () => ProjectStatus, default: ProjectStatus.DRAFT })
  @Index()
  status!: ProjectStatus

  @Property({ type: 'timestamptz', nullable: true })
  submittedAt?: Date

  // Scoring (computed, cached)
  @Property({ type: 'float', nullable: true })
  finalScore?: number

  @Property({ type: 'int', nullable: true })
  peerVoteCount?: number

  @Property({ type: 'int', nullable: true })
  rank?: number

  @Property({ type: 'int', nullable: true })
  manualRankOverride?: number   // Admin can override computed ranking

  // Multi-tenancy
  @Property({ type: 'uuid' })
  @Index()
  tenantId!: string

  @Property({ type: 'uuid' })
  @Index()
  organizationId!: string

  @Property({ type: 'boolean', default: true })
  isActive!: boolean

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date

  @Property({ type: 'timestamptz', nullable: true })
  deletedAt?: Date
}

enum ProjectStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  UNDER_REVIEW = 'under_review',
  SCORED = 'scored',
}
```

---

### 5.5 judging module

#### JudgePanel

```typescript
@Entity({ tableName: 'judging_panel' })
class JudgePanel {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Enum({ items: () => JudgingRound })
  round!: JudgingRound

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', nullable: true })
  deletedAt?: Date
}

enum JudgingRound {
  PRELIMINARY = 'preliminary',
  FINAL = 'final',
}
```

#### JudgePanelJudge (Junction)

```typescript
@Entity({ tableName: 'judging_panel_judge' })
@Unique({ properties: ['panelId', 'judgeId'] })
class JudgePanelJudge {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  panelId!: string

  @Property({ type: 'uuid' })
  judgeId!: string   // customer_user_id

  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string
}
```

#### JudgePanelTrack (Junction)

```typescript
@Entity({ tableName: 'judging_panel_track' })
@Unique({ properties: ['panelId', 'trackId'] })
class JudgePanelTrack {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  panelId!: string

  @Property({ type: 'uuid' })
  trackId!: string

  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string
}
```

#### JudgingCriterion

```typescript
@Entity({ tableName: 'judging_criterion' })
class JudgingCriterion {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'uuid', nullable: true })
  trackId?: string     // null = applies to all tracks

  @Enum({ items: () => CriterionRound, default: CriterionRound.BOTH })
  round!: CriterionRound

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string

  @Property({ type: 'int', default: 10 })
  maxScore!: number

  @Property({ type: 'float' })
  weight!: number     // e.g., 0.25 = 25%

  @Property({ type: 'int', default: 0 })
  order!: number

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', nullable: true })
  deletedAt?: Date   // Soft delete — preserves integrity of existing CriterionScore records
}

enum CriterionRound {
  PRELIMINARY = 'preliminary',
  FINAL = 'final',
  BOTH = 'both',
}
```

#### ProjectScore

```typescript
@Entity({ tableName: 'judging_project_score' })
@Unique({ properties: ['projectId', 'judgeId', 'round'] }) // One score per judge per project per round
class ProjectScore {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  projectId!: string

  @Property({ type: 'uuid' })
  @Index()
  judgeId!: string    // customer_user_id

  @Property({ type: 'uuid' })
  judgePanelId!: string

  @Enum({ items: () => JudgingRound })
  @Index()
  round!: JudgingRound

  @Property({ type: 'float', nullable: true })
  totalScore?: number    // Computed: sum of weighted criterion scores

  @Property({ type: 'text', nullable: true })
  comment?: string       // Feedback visible to team after results

  @Property({ type: 'text', nullable: true })
  privateNotes?: string  // Visible only to admin + judge

  @Property({ type: 'boolean', default: false })
  conflictOfInterest!: boolean   // Judge recused

  @Property({ type: 'boolean', default: false })
  isSubmitted!: boolean

  @Property({ type: 'timestamptz', nullable: true })
  submittedAt?: Date

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'uuid' })
  competitionId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}
```

#### CriterionScore

```typescript
@Entity({ tableName: 'judging_criterion_score' })
@Unique({ properties: ['projectScoreId', 'criterionId'] })
class CriterionScore {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  projectScoreId!: string   // FK → ProjectScore

  @Property({ type: 'uuid' })
  criterionId!: string       // FK → JudgingCriterion

  @Property({ type: 'int' })
  score!: number             // 0 to criterion.maxScore

  @Property({ type: 'text', nullable: true })
  note?: string

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}
```

#### DemoSession

```typescript
@Entity({ tableName: 'judging_demo_session' })
class DemoSession {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'uuid' })
  teamId!: string

  @Property({ type: 'uuid' })
  @Index()
  projectId!: string    // FK → projects.Project — avoids N+1 lookup

  @Property({ type: 'uuid' })
  trackId!: string

  @Property({ type: 'int' })
  presentationOrder!: number

  @Property({ type: 'timestamptz', nullable: true })
  scheduledStart?: Date

  @Property({ type: 'int', default: 3 })
  presentationDurationMinutes!: number

  @Property({ type: 'int', default: 2 })
  qaDurationMinutes!: number

  @Enum({ items: () => DemoStatus, default: DemoStatus.QUEUED })
  @Index()
  status!: DemoStatus

  @Property({ type: 'timestamptz', nullable: true })
  actualStart?: Date

  @Property({ type: 'timestamptz', nullable: true })
  actualEnd?: Date

  @Enum({ items: () => JudgingRound })
  @Index()
  round!: JudgingRound

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}

enum DemoStatus {
  QUEUED = 'queued',
  ON_DECK = 'on_deck',
  PRESENTING = 'presenting',
  QA = 'qa',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}
```

---

### 5.6 sponsors module

#### Sponsor

```typescript
@Entity({ tableName: 'sponsors_sponsor' })
class Sponsor {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Enum({ items: () => SponsorTier })
  tier!: SponsorTier

  @Property({ type: 'varchar', length: 1000 })
  logoUrl!: string

  @Property({ type: 'varchar', length: 1000, nullable: true })
  websiteUrl?: string

  @Property({ type: 'text', nullable: true })
  description?: string

  // Sponsor challenge (optional)
  @Property({ type: 'varchar', length: 255, nullable: true })
  challengeTitle?: string

  @Property({ type: 'text', nullable: true })
  challengeDescription?: string

  @Property({ type: 'varchar', length: 1000, nullable: true })
  challengeResourcesUrl?: string

  // Contact
  @Property({ type: 'varchar', length: 255, nullable: true })
  contactName?: string

  @Property({ type: 'varchar', length: 255, nullable: true })
  contactEmail?: string

  // Display
  @Property({ type: 'int', default: 0 })
  order!: number

  @Property({ type: 'boolean', default: true })
  isVisible!: boolean

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'boolean', default: true })
  isActive!: boolean

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}

enum SponsorTier {
  TITLE = 'title',
  GOLD = 'gold',
  SILVER = 'silver',
  PARTNER = 'partner',
  IN_KIND = 'in_kind',
}
```

#### Prize

```typescript
@Entity({ tableName: 'sponsors_prize' })
class Prize {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'varchar', length: 255 })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string

  @Enum({ items: () => PrizeCategory })
  category!: PrizeCategory

  @Property({ type: 'uuid', nullable: true })
  trackId?: string

  @Property({ type: 'uuid', nullable: true })
  sponsorId?: string

  @Property({ type: 'varchar', length: 255, nullable: true })
  value?: string       // "5000 PLN", "Claude API Credits"

  @Property({ type: 'int', nullable: true })
  rank?: number        // 1st, 2nd, 3rd

  @Property({ type: 'varchar', length: 500, nullable: true })
  iconUrl?: string

  // Award (set by admin after judging)
  @Property({ type: 'uuid', nullable: true })
  winningProjectId?: string

  @Property({ type: 'uuid', nullable: true })
  winningTeamId?: string

  @Property({ type: 'timestamptz', nullable: true })
  awardedAt?: Date

  @Property({ type: 'uuid', nullable: true })
  awardedBy?: string   // admin user id

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'int', default: 0 })
  order!: number

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}

enum PrizeCategory {
  TRACK_PLACEMENT = 'track_placement',
  SPECIAL_AWARD = 'special_award',
  SPONSOR_PRIZE = 'sponsor_prize',
  PEOPLES_CHOICE = 'peoples_choice',
}
```

#### PeerVote

```typescript
@Entity({ tableName: 'sponsors_peer_vote' })
@Unique({ properties: ['competitionId', 'voterId', 'projectId'] }) // No duplicate votes
class PeerVote {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'uuid' })
  @Index()
  voterId!: string      // customer_user_id (must be checked-in participant)

  @Property({ type: 'uuid' })
  @Index()
  projectId!: string

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date
}
```

---

### 5.7 incidents module

#### IncidentReport

```typescript
@Entity({ tableName: 'incidents_report' })
class IncidentReport {
  @PrimaryKey({ type: 'uuid', defaultRaw: `gen_random_uuid()` })
  id!: string

  @Property({ type: 'uuid' })
  @Index()
  competitionId!: string

  @Property({ type: 'uuid', nullable: true })
  reporterId?: string     // null = anonymous report

  @Property({ type: 'uuid', nullable: true })
  reportedUserId?: string

  @Property({ type: 'text' })
  description!: string

  @Enum({ items: () => IncidentSeverity })
  severity!: IncidentSeverity

  @Enum({ items: () => IncidentStatus, default: IncidentStatus.REPORTED })
  status!: IncidentStatus

  @Property({ type: 'text', nullable: true })
  adminNotes?: string

  @Property({ type: 'uuid', nullable: true })
  resolvedBy?: string

  @Property({ type: 'text', nullable: true })
  resolutionDescription?: string

  @Property({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date

  // Multi-tenancy
  @Property({ type: 'uuid' })
  tenantId!: string

  @Property({ type: 'uuid' })
  organizationId!: string

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date
}

enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

enum IncidentStatus {
  REPORTED = 'reported',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}
```

---

### 5.8 Entity Relationship Summary (Cross-Module FKs)

```
competitions.Competition (1) ←──FK── (N) tracks.Track
competitions.Competition (1) ←──FK── (N) teams.Team
competitions.Competition (1) ←──FK── (N) projects.Project
competitions.Competition (1) ←──FK── (N) judging.JudgePanel
competitions.Competition (1) ←──FK── (N) judging.JudgingCriterion
competitions.Competition (1) ←──FK── (N) judging.DemoSession
competitions.Competition (1) ←──FK── (N) sponsors.Sponsor
competitions.Competition (1) ←──FK── (N) sponsors.Prize
competitions.Competition (1) ←──FK── (N) sponsors.PeerVote
competitions.Competition (1) ←──FK── (N) incidents.IncidentReport
competitions.Competition (1) ←──FK── (N) competitions.AgendaItem
competitions.Competition (1) ←──FK── (N) competitions.Announcement
competitions.Competition (1) ←──FK── (N) competitions.CompetitionParticipation

competitions.ParticipantProfile ──FK──→ customer_accounts.CustomerUser (customerUserId)

tracks.Track (1) ←──FK── (N) teams.Team
tracks.Track (1) ←──FK── (N) projects.Project
tracks.Track (1) ←──FK── (N) judging.JudgingCriterion
tracks.Track (1) ←──FK── (N) judging.DemoSession

teams.Team (1) ←──FK── (1) projects.Project
teams.Team (1) ←──FK── (N) teams.TeamMember
teams.Team (1) ←──FK── (N) teams.TeamInvitation
teams.Team (1) ←──FK── (N) judging.DemoSession

judging.DemoSession ──FK──→ projects.Project (projectId)

customer_accounts.CustomerUser ←──FK── competitions.CompetitionParticipation
customer_accounts.CustomerUser ←──FK── competitions.ParticipantProfile
customer_accounts.CustomerUser ←──FK── teams.TeamMember
customer_accounts.CustomerUser ←──FK── teams.TeamInvitation (inviter/invitee)
customer_accounts.CustomerUser ←──FK── judging.ProjectScore (judge)
customer_accounts.CustomerUser ←──FK── judging.JudgePanelJudge
customer_accounts.CustomerUser ←──FK── sponsors.PeerVote (voter)

judging.JudgePanel (N) ←──junction── (N) customer_accounts.CustomerUser  [via JudgePanelJudge]
judging.JudgePanel (N) ←──junction── (N) tracks.Track                    [via JudgePanelTrack]
judging.ProjectScore (1) ←──FK── (N) judging.CriterionScore
judging.JudgingCriterion (1) ←──FK── (N) judging.CriterionScore

sponsors.Sponsor (1) ←──FK── (N) sponsors.Prize
sponsors.Prize ──FK──→ projects.Project (winning_project_id)
sponsors.Prize ──FK──→ teams.Team (winning_team_id)
```

**Note:** All cross-module references are FK IDs only — no ORM `@ManyToOne` relationships across modules. ORM relationships (e.g., `@OneToMany`) are used only within the same module (e.g., `ProjectScore` → `CriterionScore` within `judging`).

---

## 6. API Contracts

### 6.1 competitions module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/competitions` | Staff | List competitions |
| POST | `/api/competitions` | Staff + `competitions.create` | Create competition |
| GET | `/api/competitions/:id` | Staff/Portal | Get competition detail |
| PUT | `/api/competitions/:id` | Staff + `competitions.edit` | Update competition |
| DELETE | `/api/competitions/:id` | Staff + `competitions.delete` | Delete competition |
| POST | `/api/competitions/:id/advance-stage` | Staff + `competitions.stages.manage` | Advance to next stage |
| POST | `/api/competitions/:id/set-stage` | Staff + `competitions.stages.manage` | Set specific stage (admin override) |
| GET | `/api/competitions/:id/dashboard` | Staff | Real-time metrics dashboard data |
| GET | `/api/competitions/:id/stage-preview` | Staff + `competitions.stages.manage` | Preview side effects before advancing (counts, warnings) |
| POST | `/api/competitions/:id/rerun-side-effects` | Staff + `competitions.stages.manage` | Re-run side effects for current stage (recovery) |
| GET | `/api/competitions/participations` | Staff/Portal | List participations (with filters) |
| POST | `/api/competitions/participations` | Staff + `competitions.participants.manage` | Register participant |
| POST | `/api/competitions/participations/bulk` | Staff + `competitions.participants.manage` | Bulk import via CSV |
| POST | `/api/competitions/participations/resend-invitation` | Staff + `competitions.participants.manage` | Re-send invitation email |
| PUT | `/api/competitions/participations/:id` | Staff/Portal | Update participation (CoC, check-in) |
| POST | `/api/competitions/participations/:id/checkin` | Staff + `competitions.checkin.manage` | Check in participant |
| GET | `/api/competitions/agenda` | Staff/Portal | List agenda items |
| POST | `/api/competitions/agenda` | Staff + `competitions.agenda.manage` | Create agenda item |
| PUT | `/api/competitions/agenda/:id` | Staff + `competitions.agenda.manage` | Update agenda item |
| DELETE | `/api/competitions/agenda/:id` | Staff + `competitions.agenda.manage` | Delete agenda item |
| GET | `/api/competitions/announcements` | Staff/Portal | List announcements (filtered by role/track) |
| POST | `/api/competitions/announcements` | Staff + `competitions.announcements.manage` | Create announcement |

**Stage Advance Command (key endpoint):**

```
POST /api/competitions/:id/advance-stage
Request:  { targetStage: CompetitionStage }
Response: { ok: true, competition: { id, stage, updatedAt } }
```

Validation rules:
- Only valid transitions allowed (DRAFT→OPEN→TEAM_FORMATION→...→ARCHIVED)
- TEAM_FORMATION→TRACK_SELECTION can be skipped if `stageConfig.allowSimultaneousFormationAndTrack`
- Moving to HACKING: warns if teams are below min size
- Moving to DEMOS: auto-publishes DRAFT projects, generates presentation queue
- Moving to DELIBERATION: closes People's Choice voting
- Moving to FINISHED: calculates final scores, generates leaderboard

Each transition emits: `competitions.competition.stage_advanced` (clientBroadcast + portalBroadcast)

**Stage Advance Guardrails:**

Before executing, the endpoint returns a preview (also available via GET `.../stage-preview`):
- Count of side effects that will fire (e.g., "12 projects will be auto-published")
- Warnings: teams below min size, teams without tracks, projects still in draft, judges with incomplete scores
- Count of unmatched participants (no team)

The admin confirmation dialog MUST display:
1. Current stage → target stage
2. Bulleted list of all side effects with counts
3. All warnings (highlighted in yellow/red)
4. Required checkbox: "I understand this action cannot be undone"
5. For DEMOS and FINISHED: type-the-stage-name confirmation

**Unmatched participants at HACKING:**
- If `stageConfig.allowSoloParticipants` is true: auto-create solo "teams" for each unmatched participant
- If false: teamless participants see a clear message: "The team formation period has ended. Contact an organizer for assistance."
- The advance dialog warns: "X participants have no team"

**Under-sized teams at HACKING:**
- Admin must explicitly acknowledge teams below `minTeamSize`
- Options: dissolve team, grant exception (flag on team), or block advancement until resolved

---

### 6.2 tracks module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tracks` | Staff/Portal | List tracks for a competition |
| POST | `/api/tracks` | Staff + `tracks.create` | Create track |
| GET | `/api/tracks/:id` | Staff/Portal | Get track detail |
| PUT | `/api/tracks/:id` | Staff + `tracks.edit` | Update track |
| DELETE | `/api/tracks/:id` | Staff + `tracks.delete` | Delete track |

Query params: `?competitionId=uuid` (required filter)

---

### 6.3 teams module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/teams` | Staff/Portal | List teams (filter by competition, track, status) |
| POST | `/api/teams` | Portal + `portal.teams.create` | Create team (participant becomes OWNER) |
| GET | `/api/teams/:id` | Staff/Portal | Get team with members |
| PUT | `/api/teams/:id` | Staff/Portal (owner) | Update team (name, description, track) |
| DELETE | `/api/teams/:id` | Staff + `teams.delete` | Delete team |
| POST | `/api/teams/:id/select-track` | Portal (owner) | Select track for team |
| POST | `/api/teams/:id/disqualify` | Staff + `teams.disqualify` | Disqualify team |
| POST | `/api/teams/:id/reactivate` | Staff + `teams.manage` | Reactivate withdrawn/disqualified team |
| POST | `/api/teams/:id/assign-member` | Staff + `teams.manage` | Admin manually assigns participant to team |
| GET | `/api/teams/members` | Staff/Portal | List members (filter by team, competition) |
| POST | `/api/teams/members/:id/remove` | Portal (owner)/Staff | Remove member |
| POST | `/api/teams/members/:id/leave` | Portal | Leave team |
| GET | `/api/teams/invitations` | Staff/Portal | List invitations (filter by team, invitee, status) |
| POST | `/api/teams/invitations` | Portal | Create invitation or join request |
| POST | `/api/teams/invitations/:id/accept` | Portal | Accept invitation/join request |
| POST | `/api/teams/invitations/:id/decline` | Portal | Decline invitation/join request |
| POST | `/api/teams/invitations/:id/cancel` | Portal | Cancel pending invitation |

---

### 6.4 projects module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/projects` | Staff/Portal | List projects (filter by competition, track, status, team) |
| POST | `/api/projects` | Portal (team member) | Create project for team |
| GET | `/api/projects/:id` | Staff/Portal | Get project detail |
| PUT | `/api/projects/:id` | Portal (team member)/Staff | Update project (only if DRAFT or admin override) |
| POST | `/api/projects/:id/submit` | Portal (team owner) | Submit project (DRAFT → PUBLISHED) |
| POST | `/api/projects/:id/flag` | Staff + `projects.flag` | Flag for code reuse |
| POST | `/api/projects/:id/unflag` | Staff + `projects.flag` | Remove reuse flag |

**Portal access control:** `GET /api/projects` for portal users MUST filter `status = PUBLISHED` unless the project belongs to the requesting user's team. Draft projects of other teams are never visible.

---

### 6.5 judging module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/judging/panels` | Staff | List judge panels |
| POST | `/api/judging/panels` | Staff + `judging.panels.manage` | Create panel |
| PUT | `/api/judging/panels/:id` | Staff + `judging.panels.manage` | Update panel |
| DELETE | `/api/judging/panels/:id` | Staff + `judging.panels.manage` | Delete panel |
| POST | `/api/judging/panels/:id/judges` | Staff + `judging.panels.manage` | Add judge to panel |
| DELETE | `/api/judging/panels/:id/judges/:judgeId` | Staff + `judging.panels.manage` | Remove judge |
| POST | `/api/judging/panels/:id/tracks` | Staff + `judging.panels.manage` | Assign track to panel |
| GET | `/api/judging/criteria` | Staff/Portal (judge) | List criteria |
| POST | `/api/judging/criteria` | Staff + `judging.criteria.manage` | Create criterion |
| PUT | `/api/judging/criteria/:id` | Staff + `judging.criteria.manage` | Update criterion |
| DELETE | `/api/judging/criteria/:id` | Staff + `judging.criteria.manage` | Delete criterion |
| GET | `/api/judging/scores` | Staff/Portal (judge) | List scores (judge sees own, admin sees all) |
| POST | `/api/judging/scores` | Portal (judge) + `portal.judging.score` | Submit/update score |
| PUT | `/api/judging/scores/:id` | Portal (judge)/Staff | Update score |
| DELETE | `/api/judging/scores/:id` | Staff + `judging.scores.manage` | Remove outlier score |
| GET | `/api/judging/scores/progress` | Staff | Scoring progress per judge/project |
| GET | `/api/judging/leaderboard` | Staff/Portal | Leaderboard per track (admin: always available during DELIBERATION+; portal: only after FINISHED) |
| POST | `/api/judging/finalists` | Staff + `judging.finalists.manage` | Select finalists for final round |
| GET | `/api/judging/demos` | Staff/Portal | List demo sessions |
| POST | `/api/judging/demos/generate` | Staff + `judging.demos.manage` | Generate demo queue from teams |
| PUT | `/api/judging/demos/:id` | Staff + `judging.demos.manage` | Update demo session (reorder, reschedule) |
| POST | `/api/judging/demos/:id/advance` | Staff + `judging.demos.manage` | Advance demo status (ON_DECK→PRESENTING→QA→COMPLETED) |
| POST | `/api/judging/demos/:id/skip` | Staff + `judging.demos.manage` | Skip a demo |
| GET | `/api/judging/demos/current` | Staff/Portal | Get currently active demo (for timer display) |

**Score visibility:** `GET /api/judging/scores` for portal judge users MUST filter `WHERE judgeId = currentUser.id`. Judges MUST NOT see other judges' scores. Only admins see all scores.

**Leaderboard access control:** For portal users, the endpoint returns 403 if competition stage < FINISHED. Admin can access during DELIBERATION+.

**Demo Timer SSE Pattern:**

The demo timer is NOT a simple REST endpoint — it uses the DOM Event Bridge:

1. Admin calls `POST /api/judging/demos/:id/advance` to start a presentation
2. Server records `actualStart` and emits `judging.demo.status_changed` event with `portalBroadcast: true`
3. All portal clients receive the event via SSE and start local countdown timers
4. Timer is computed client-side: `timeRemaining = (actualStart + durationMinutes * 60) - now()`
5. When timer expires locally, the client shows visual/audio cue
6. Admin advances to next status (QA) via another API call → another SSE event
7. For the projector/kiosk view: a dedicated full-screen portal page subscribes to the same events

SSE event payload:
```
payload: { demoId, status: 'presenting', actualStart, durationMinutes, teamId, teamName, serverTime: Date.now() }
```

**Clock skew correction:** Every SSE event includes `serverTime`. Clients compute `clockDelta = serverTime - Date.now()` on first event, then apply `clockDelta` to all timer calculations. This corrects for client clock drift without requiring NTP.

This approach is:
- Network-resilient (timer runs locally even if SSE drops temporarily)
- Sub-second accurate (local clock, not server-polled)
- Synchronized (all clients start from the same `actualStart` timestamp)

---

### 6.6 sponsors module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sponsors` | Staff/Portal | List sponsors |
| POST | `/api/sponsors` | Staff + `sponsors.create` | Create sponsor |
| PUT | `/api/sponsors/:id` | Staff + `sponsors.edit` | Update sponsor |
| DELETE | `/api/sponsors/:id` | Staff + `sponsors.delete` | Delete sponsor |
| GET | `/api/sponsors/prizes` | Staff/Portal | List prizes |
| POST | `/api/sponsors/prizes` | Staff + `sponsors.prizes.manage` | Create prize |
| PUT | `/api/sponsors/prizes/:id` | Staff + `sponsors.prizes.manage` | Update prize |
| DELETE | `/api/sponsors/prizes/:id` | Staff + `sponsors.prizes.manage` | Delete prize |
| POST | `/api/sponsors/prizes/:id/assign` | Staff + `sponsors.prizes.assign` | Assign prize to project/team |
| POST | `/api/sponsors/prizes/:id/unassign` | Staff + `sponsors.prizes.assign` | Remove prize assignment |
| GET | `/api/sponsors/votes` | Portal (participant) | Get my votes |
| POST | `/api/sponsors/votes` | Portal (participant) + `portal.voting.cast` | Cast vote |
| DELETE | `/api/sponsors/votes/:id` | Portal (participant) + `portal.voting.cast` | Retract vote (if configured) |
| GET | `/api/sponsors/votes/tally` | Staff | Vote tally (admin only until FINISHED) |
| GET | `/api/sponsors/votes/tally/public` | Portal (after FINISHED) | Public vote tally after results published |

---

### 6.7 incidents module

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/incidents` | Staff + `incidents.view` | List incident reports |
| POST | `/api/incidents` | Portal (any role) | File incident report (anonymous allowed) |
| GET | `/api/incidents/:id` | Staff + `incidents.view` | Get incident detail |
| PUT | `/api/incidents/:id` | Staff + `incidents.manage` | Update incident (admin notes, status) |
| POST | `/api/incidents/:id/resolve` | Staff + `incidents.resolve` | Resolve incident |

---

## 7. Portal Pages

Portal pages live at `src/modules/<module>/frontend/[orgSlug]/portal/<path>/page.tsx`.

### Navigation Structure

**Important UX rule:** All navigation items remain visible at all times. Items not available for the current stage or role are rendered as disabled/greyed with a tooltip explaining when they become available (e.g., "Available during hacking phase"). Items are NEVER removed from navigation — only disabled. This preserves spatial memory.

**Sidebar (menu:portal:sidebar:main):**

| Nav Item | Visible To | Module | Condition |
|----------|-----------|--------|-----------|
| Dashboard | All | competitions | Always |
| Competition | All | competitions | Always |
| Agenda | All | competitions | Always |
| Participants | All | competitions | Always (for browsing participant profiles) |
| Announcements | All | competitions | Always |
| My Team | Participant | teams | TEAM_FORMATION+ |
| Browse Teams | Participant | teams | TEAM_FORMATION/TRACK_SELECTION |
| My Project | Participant | projects | HACKING+ |
| Presentations | All | judging | DEMOS+ |
| Vote | Participant | sponsors | Voting window open |
| Judging | Judge | judging | DEMOS+ |
| Mentor Tracks | Mentor | tracks | Always (Phase 1 minimal mentor page) |
| My Sessions | Mentor | (Phase 2) | HACKING |
| Results | All | judging | FINISHED+ |
| Sponsors & Prizes | All | sponsors | Always |

**Sidebar (menu:portal:sidebar:account):**

| Nav Item | Module |
|----------|--------|
| Profile | customer_accounts |
| My QR Code | competitions |
| Report Incident | incidents |

### Key Portal Pages

#### Dashboard (`/portal/dashboard`)
- **"Your Current Task" card** (top of page, most prominent element):
  - Stage-aware action prompt that tells the user exactly what to do right now
  - Examples: "Accept the Code of Conduct to continue" / "Form a team before [time]" / "Submit your project — [countdown]" / "Vote for your favorite projects — [X] votes remaining" / "Your team presents in 3 slots"
  - Links directly to the relevant page
- Role-specific content via portal dashboard widgets
- **Participant**: My team status, project status, next agenda item, pending invitations, presentation slot, voting status
- **Judge**: Assigned projects, scoring progress, current presenter
- **Mentor**: Assigned tracks with team/project overview, quick links to team details
- **All**: Current stage indicator, countdown to next deadline, latest announcements

#### Competition Overview (`/portal/competition`)
- Competition description, rules, CoC link
- Current stage with visual progress indicator
- Key dates and deadlines

#### Agenda (`/portal/agenda`)
- Timeline view with "now" indicator
- Filter by track (optional)
- Mandatory items highlighted

#### Participants Directory (`/portal/participants`)
- Searchable/filterable list of all participants in the competition
- Filters: skills, organization, "looking for team" status, role
- Cards show: name, avatar, organization, skills tags, "looking for team" badge
- Actions: "Invite to Team" button (if user is a team owner with open spots)
- Complements Team Browser — browse people, not just teams

#### Announcements Feed (`/portal/announcements`)
- Chronological list of all announcements for the competition
- Filtered by user's role and track
- Visual differentiation by priority:
  - INFO: standard card with blue/grey left border
  - WARNING: yellow background, bell icon
  - URGENT: red background, full-width banner, cannot be dismissed without acknowledgment
- Badge on nav item shows unread announcement count

#### Team Management (`/portal/team`)
- My team roster with member roles
- Pending invitations (sent and received)
- Track selection (when available)
- Table assignment
- When participant has no team: shows three clear options: 'Create a Team', 'Browse & Join a Team', 'Mark yourself as Looking for a Team'
- Incoming invitations and outgoing join requests visible even without a team

#### Team Browser (`/portal/teams/browse`)
- List of all teams (name, description, members, skills, open spots)
- Filter: has spots, by track, by skill
- Join request button
- Tab or section: 'People Looking for Teams' showing individual participants with skills

#### Project Editor (`/portal/project`)
- Full project form (title, tagline, description, problem, solution, tech stack)
- URL fields (demo, repo, video, slides)
- Screenshot/attachment upload (via `attachments` module)
- Originality disclosure section
- Preview mode
- Submit button (with deadline countdown)
- Auto-saves draft every 30 seconds to prevent data loss
- Countdown timer turns visually urgent (red, larger) at 15 minutes
- When deadline passes while editing: submit button disabled with message 'Submission deadline has passed. Contact an organizer for an extension.' Unsaved work preserved in localStorage.

#### Presentation Queue (`/portal/presentations`)
- Live presentation board: current team, next on deck, full queue
- Timer display (presentation + Q&A)
- My team's position highlighted
- Real-time updates via `usePortalAppEvent('judging.demo.*')`

#### Presentation Kiosk (`/portal/kiosk`)
- Full-screen, projector-optimized view
- Large timer with color changes (green → yellow → red)
- Current team name + project title
- Next team on deck
- No sidebar/header (standalone layout via component replacement)
- Auto-advances with SSE events
- Timer digits: minimum 20% of viewport height. Team name: minimum 8% of viewport height. Dark background (black) with white text for maximum projector contrast. CSS `vw/vh` based sizing, not pixels. Minimum resolution: 1920x1080. Accessible via keyboard shortcut settings panel.

#### Judging Dashboard (`/portal/judging`)
- Judge-only view
- List of assigned projects with scored/unscored indicator
- Click to open score card
- Current presenter auto-highlighted

#### Score Card (`/portal/judging/[projectId]`)
- Judge-only
- **Conflict of interest prompt** (top of page, before scoring fields): 'Do you have a conflict of interest with this team? [Yes, recuse myself] [No, proceed to scoring]'
- Project details pulled up (description, demo, video, screenshots)
- Originality disclosure + reuse flag visible
- Criterion scoring: tappable number buttons (0 to max_score) for mobile precision — NOT sliders
- Written feedback textarea
- Private notes textarea
- Save draft / Submit buttons
- Split-screen layout on desktop (project details left, scoring right). On mobile: collapsible project details with floating 'Quick Notes' area
- Auto-saves on every field change (debounced). 'Draft' badge in judging dashboard for partially completed scores, distinct from 'Unscored' and 'Submitted'.

#### Mentor Tracks (`/portal/mentor/tracks`) — Phase 1
- Mentor-only view of assigned tracks
- For each track: list of teams with their project status, member count, tech stack
- Click team to see project details (read-only)
- Phase 2 will add session request flow

#### People's Choice Voting (`/portal/voting`)
- Grid/list of all published projects (excluding own team)
- Vote button on each project
- Counter: "X of Y votes used"
- Already-voted projects marked
- Unvote capability: voted projects show a 'Remove vote' toggle. Removing a vote frees it for reuse.
- Countdown to voting window close. When window closes: overlay 'Voting has ended. Your [N] votes have been recorded.' Disable buttons.

#### Results (`/portal/results`)
- Visible only after FINISHED stage
- Per-track leaderboard
- Project cards with scores, prizes
- People's Choice winner
- My team's scores breakdown + judge feedback
- Frame scores around learning: show team's strongest criteria, contextualize scores relative to track average

#### QR Code (`/portal/qr`)
- Personal QR code for check-in
- Full-screen display mode
- QR code: error correction level H (high) for screen glare resistance. Minimum 60% of screen width. Black-on-white only (no branded colors).

#### Report Incident (`/portal/incident`)
- Accessible from any page (persistent button in portal shell)
- Also accessible via a persistent floating action button in the portal shell (always visible, every page)
- Form: description, severity, optional reported user
- Anonymous toggle (removes reporter identity)
- Submit confirmation

---

## 8. Backend Pages

Backend pages live at `src/modules/<module>/backend/<path>/page.tsx`.

### Navigation (menu:sidebar:main injections)

| Nav Item | Module | Icon |
|----------|--------|------|
| Event Command Center | competitions | lucide:command |
| Competitions | competitions | lucide:trophy |
| Tracks | tracks | lucide:git-branch |
| Teams | teams | lucide:users |
| Projects | projects | lucide:folder-code |
| Demos & Judging | judging | lucide:gavel |
| Sponsors & Prizes | sponsors | lucide:award |
| Incidents | incidents | lucide:shield-alert |
| Check-In | competitions | lucide:qr-code |

### Key Backend Pages

#### Event Command Center (`/backend/competitions/command-center`)
Real-time dashboard with metrics:
- Checked-in count / total registered
- Teams formed / teams without tracks / teams below min size
- Projects: draft / submitted / flagged
- Demo progress: completed / total
- Judging progress: scores submitted / total expected
- People's Choice votes cast / total possible
- Incidents: open / resolved
- Live activity feed (recent audit log entries)
- Metrics organized with traffic-light indicators (green/yellow/red). Problems float to top. 'Needs Attention' section aggregates all yellow/red items.
- Side effect status for current stage: shows pending/completed/failed for each stage transition subscriber

All metrics use `useAppEvent('competitions.*')` for real-time refresh.

#### Competition Management (`/backend/competitions`)
- DataTable listing all competitions
- Create/edit with CrudForm
- Stage control panel: current stage indicator, "Advance" button with confirmation dialog
- Configuration tabs: General, Teams, Demos, Judging, Voting, Legal
- Stage advance confirmation dialog with guardrails (see API section for details): side effect preview, warning list, explicit acknowledgment checkbox, type-confirmation for DEMOS/FINISHED
- `set-stage` override endpoint: hidden under 'Emergency' menu, requires superadmin + type-confirmation. For recovery purposes only.

#### User/Participant Management (`/backend/competitions/participants`)
- DataTable of CompetitionParticipation records
- Enriched with CustomerUser data (name, email, role, organization)
- Filters: role, check-in status, CoC status, team assignment
- Actions: check in, send reminder, assign to team
- Action: 'Assign to team' — admin can manually assign a participant to a team
- Bulk import (CSV upload)
- CSV import flow: (1) file upload with drag-and-drop, (2) client-side preview with validation errors highlighted, (3) confirmation showing 'X users will be created, Y rows have errors', (4) background processing via worker with progress bar, (5) final report with downloadable error log for failed rows

#### Check-In Scanner (`/backend/competitions/checkin`)
- Camera-based QR scanner
- Manual check-in search/confirm
- Live check-in count

#### Track Management (`/backend/tracks`)
- DataTable with color badges
- Track distribution chart (teams per track)
- CRUD via CrudForm

#### Team Management (`/backend/teams`)
- DataTable with team status badges
- Filters: competition, track, status, member count
- Actions: view details, assign table, disqualify, dissolve
- Detail page: member list, project link, invitation history

#### Project Management (`/backend/projects`)
- DataTable with status badges, reuse flags
- Filters: competition, track, status, flagged
- Actions: view details, flag/unflag, grant edit exception
- Submission progress bar

#### Demo Control (`/backend/judging/demos`)
- Presentation queue (drag-to-reorder)
- Timer controls: start, pause, advance, skip
- Live status of each demo session
- "Generate Queue" button (from published projects)
- Kiosk mode launch button
- Focused minimal interface during live operation. Primary action buttons (Start, Advance to Q&A, Complete, Skip) are very large and prominent. Queue reordering only available when no presentation is active. Keyboard shortcuts for primary actions (Space=advance, S=skip, Esc=pause). Co-pilot mode: second admin can monitor queue while first controls timer.
- Mobile alternative for drag-to-reorder: up/down arrow buttons
- Total event time calculation displayed: `(presentation + Q&A + buffer) × teams = estimated total time`

#### Judging Management (`/backend/judging`)
- Tabs: Panels, Criteria, Scoring Progress, Finalists, Leaderboard
- Panel CRUD with judge assignment
- Criteria CRUD with weight validation (must sum to 1.0 per scope)
- Scoring progress heat map (judge × project)
- Nudge judges button
- Finalist selection (based on preliminary scores)
- Score anomaly detection (standard deviation analysis)
- Admin can trigger 'Recalculate Scores' at any time
- Leaderboard accessible during DELIBERATION+ for admin

#### Results & Prize Management (`/backend/sponsors/results`)
- Leaderboard per track (from computed scores)
- People's Choice tally
- Prize assignment interface
- Auto-suggestions for track placements based on scores
- "Publish Results" button → advances to FINISHED stage

#### Incident Management (`/backend/incidents`)
- DataTable with severity badges
- Filters: severity, status, competition
- Resolution workflow: admin notes, resolution description, link to team disqualification

---

## 9. Event Architecture

### 9.1 Event Declarations by Module

#### competitions module (`events.ts`)

```typescript
const events = [
  { id: 'competitions.competition.created', label: 'Competition Created', entity: 'competition', category: 'crud', clientBroadcast: true },
  { id: 'competitions.competition.updated', label: 'Competition Updated', entity: 'competition', category: 'crud', clientBroadcast: true },
  { id: 'competitions.competition.deleted', label: 'Competition Deleted', entity: 'competition', category: 'crud', clientBroadcast: true },
  { id: 'competitions.competition.stage_advanced', label: 'Stage Advanced', entity: 'competition', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'competitions.participation.created', label: 'Participant Registered', entity: 'participation', category: 'crud', clientBroadcast: true },
  { id: 'competitions.participation.updated', label: 'Participation Updated', entity: 'participation', category: 'crud', clientBroadcast: true },
  { id: 'competitions.participation.deleted', label: 'Participation Deleted', entity: 'participation', category: 'crud', clientBroadcast: true },
  { id: 'competitions.participation.checked_in', label: 'Participant Checked In', entity: 'participation', category: 'lifecycle', clientBroadcast: true },
  { id: 'competitions.participation.coc_accepted', label: 'CoC Accepted', entity: 'participation', category: 'lifecycle' },
  { id: 'competitions.announcement.created', label: 'Announcement Published', entity: 'announcement', category: 'crud', clientBroadcast: true, portalBroadcast: true },
  { id: 'competitions.announcement.updated', label: 'Announcement Updated', entity: 'announcement', category: 'crud', clientBroadcast: true },
  { id: 'competitions.announcement.deleted', label: 'Announcement Deleted', entity: 'announcement', category: 'crud', clientBroadcast: true },
] as const
```

#### teams module (`events.ts`)

```typescript
const events = [
  { id: 'teams.team.created', label: 'Team Created', entity: 'team', category: 'crud', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.updated', label: 'Team Updated', entity: 'team', category: 'crud', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.deleted', label: 'Team Deleted', entity: 'team', category: 'crud', clientBroadcast: true },
  { id: 'teams.team.track_selected', label: 'Track Selected', entity: 'team', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.disqualified', label: 'Team Disqualified', entity: 'team', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.withdrawn', label: 'Team Withdrawn', entity: 'team', category: 'lifecycle', clientBroadcast: true },
  { id: 'teams.member.joined', label: 'Member Joined', entity: 'member', category: 'lifecycle', portalBroadcast: true },
  { id: 'teams.member.left', label: 'Member Left', entity: 'member', category: 'lifecycle', portalBroadcast: true },
  { id: 'teams.invitation.created', label: 'Invitation Created', entity: 'invitation', category: 'crud', portalBroadcast: true },
  { id: 'teams.invitation.accepted', label: 'Invitation Accepted', entity: 'invitation', category: 'lifecycle', portalBroadcast: true },
  { id: 'teams.invitation.declined', label: 'Invitation Declined', entity: 'invitation', category: 'lifecycle', portalBroadcast: true },
] as const
```

#### projects module (`events.ts`)

```typescript
const events = [
  { id: 'projects.project.created', label: 'Project Created', entity: 'project', category: 'crud', clientBroadcast: true },
  { id: 'projects.project.updated', label: 'Project Updated', entity: 'project', category: 'crud', clientBroadcast: true },
  { id: 'projects.project.deleted', label: 'Project Deleted', entity: 'project', category: 'crud', clientBroadcast: true },
  { id: 'projects.project.submitted', label: 'Project Submitted', entity: 'project', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'projects.project.flagged', label: 'Project Flagged', entity: 'project', category: 'lifecycle', clientBroadcast: true },
  { id: 'projects.batch.auto_published', label: 'Projects Auto-Published', entity: 'project', category: 'lifecycle', clientBroadcast: true },
] as const
```

#### judging module (`events.ts`)

```typescript
const events = [
  { id: 'judging.panel.created', label: 'Panel Created', entity: 'panel', category: 'crud', clientBroadcast: true },
  { id: 'judging.panel.updated', label: 'Panel Updated', entity: 'panel', category: 'crud', clientBroadcast: true },
  { id: 'judging.panel.deleted', label: 'Panel Deleted', entity: 'panel', category: 'crud', clientBroadcast: true },
  { id: 'judging.criterion.created', label: 'Criterion Created', entity: 'criterion', category: 'crud', clientBroadcast: true },
  { id: 'judging.criterion.updated', label: 'Criterion Updated', entity: 'criterion', category: 'crud', clientBroadcast: true },
  { id: 'judging.criterion.deleted', label: 'Criterion Deleted', entity: 'criterion', category: 'crud', clientBroadcast: true },
  { id: 'judging.score.submitted', label: 'Score Submitted', entity: 'score', category: 'crud', clientBroadcast: true },
  { id: 'judging.score.updated', label: 'Score Updated', entity: 'score', category: 'crud', clientBroadcast: true },
  { id: 'judging.score.deleted', label: 'Score Deleted', entity: 'score', category: 'crud', clientBroadcast: true },
  { id: 'judging.demo.status_changed', label: 'Demo Status Changed', entity: 'demo', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'judging.demo.queue_updated', label: 'Demo Queue Updated', entity: 'demo', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'judging.finalists.selected', label: 'Finalists Selected', entity: 'finalist', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'judging.results.published', label: 'Results Published', entity: 'result', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
] as const
```

#### sponsors module (`events.ts`)

```typescript
const events = [
  { id: 'sponsors.sponsor.created', label: 'Sponsor Created', entity: 'sponsor', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.sponsor.updated', label: 'Sponsor Updated', entity: 'sponsor', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.sponsor.deleted', label: 'Sponsor Deleted', entity: 'sponsor', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.prize.created', label: 'Prize Created', entity: 'prize', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.prize.updated', label: 'Prize Updated', entity: 'prize', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.prize.deleted', label: 'Prize Deleted', entity: 'prize', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.prize.awarded', label: 'Prize Awarded', entity: 'prize', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'sponsors.vote.cast', label: 'Vote Cast', entity: 'vote', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.vote.retracted', label: 'Vote Retracted', entity: 'vote', category: 'crud', clientBroadcast: true },
] as const
```

#### incidents module (`events.ts`)

```typescript
const events = [
  { id: 'incidents.report.created', label: 'Incident Reported', entity: 'report', category: 'crud', clientBroadcast: true },
  { id: 'incidents.report.updated', label: 'Incident Updated', entity: 'report', category: 'crud', clientBroadcast: true },
  { id: 'incidents.report.resolved', label: 'Incident Resolved', entity: 'report', category: 'lifecycle', clientBroadcast: true },
] as const
```

### 9.2 Key Event-Driven Side Effects (Subscribers)

All stage transition subscribers dispatch heavy work as worker jobs (via OM queue) to avoid inline timeouts. The subscriber enqueues the job; the worker processes it and emits a completion event. Backend shows progress via `useOperationProgress`.

**Ordering dependency:** `generate-demo-queue` subscribes to `projects.batch.auto_published` (emitted by `publish-draft-projects` on completion) rather than directly to `stage_advanced`. This guarantees projects are published before the queue is generated.

| Event | Subscriber | Module | Persistent | Effect |
|-------|-----------|--------|------------|--------|
| `competitions.competition.stage_advanced` → HACKING | `lock-team-membership` | teams | yes | Set `membershipLocked = true` on all teams |
| `competitions.competition.stage_advanced` → HACKING | `create-draft-projects` | projects | yes | Auto-create DRAFT project for each team |
| `competitions.competition.stage_advanced` → HACKING | `create-solo-teams` | teams | yes | If allowSoloParticipants, create solo teams for unmatched participants |
| `competitions.competition.stage_advanced` → DEMOS | `publish-draft-projects` | projects | yes | Auto-publish remaining DRAFT projects; emits `projects.batch.auto_published` on completion |
| `projects.batch.auto_published` | `generate-demo-queue` | judging | yes | Create DemoSession entries for all published projects |
| `competitions.competition.stage_advanced` → DELIBERATION | `close-voting` | sponsors | yes | Mark voting window as closed |
| `competitions.competition.stage_advanced` → FINISHED | `calculate-final-scores` | judging | yes | Compute weighted scores, rankings |
| `competitions.competition.stage_advanced` → FINISHED | `auto-suggest-prizes` | sponsors | yes | Auto-assign track placement prizes based on rankings |
| `teams.invitation.accepted` | `add-team-member` | teams | yes | Create TeamMember, update team count |
| `teams.member.joined` / `teams.member.left` | `notify-team-members` | teams | yes | Send notification to team members |
| `projects.project.submitted` | `notify-project-submitted` | projects | yes | Notification to all team members (notification type: `projects.submitted`) |
| `judging.score.submitted` | `check-scoring-complete` | judging | yes | If all judges scored, mark project as SCORED |
| `judging.demo.status_changed` → ON_DECK | `notify-on-deck` | judging | yes | Push urgent notification to on-deck team |
| `incidents.report.created` (HIGH/CRITICAL) | `alert-admins` | incidents | yes | Immediate notification to all admins |
| `incidents.report.resolved` + disqualify | `disqualify-team` | teams | yes | Update team status if incident led to disqualification |

---

## 10. Notification Plan

Using OM's built-in `notifications` module. Each module declares notification types in `notifications.ts`.

### competitions module notifications

```typescript
export const notificationTypes = [
  { id: 'competitions.stage_changed', label: 'Competition Stage Changed', channels: ['in_app'], priority: 'high' },
  { id: 'competitions.announcement', label: 'New Announcement', channels: ['in_app'], priority: 'normal' },
  { id: 'competitions.checkin_reminder', label: 'Check-In Reminder', channels: ['in_app', 'email'], priority: 'normal' },
  { id: 'competitions.deadline_approaching', label: 'Deadline Approaching', channels: ['in_app'], priority: 'high' },
  { id: 'competitions.welcome_checkin', label: 'Welcome After Check-In', channels: ['in_app'], priority: 'normal' },
]
```

### teams module notifications

```typescript
export const notificationTypes = [
  { id: 'teams.invitation_received', label: 'Team Invitation', channels: ['in_app'], priority: 'normal' },
  { id: 'teams.join_request_received', label: 'Join Request', channels: ['in_app'], priority: 'normal' },
  { id: 'teams.invitation_response', label: 'Invitation Response', channels: ['in_app'], priority: 'normal' },
  { id: 'teams.track_selected', label: 'Track Selected', channels: ['in_app'], priority: 'normal' },
  { id: 'teams.member_change', label: 'Team Roster Change', channels: ['in_app'], priority: 'normal' },
]
```

### projects module notifications

```typescript
export const notificationTypes = [
  { id: 'projects.submitted', label: 'Project Submitted', channels: ['in_app'], priority: 'normal' },
  { id: 'projects.auto_published', label: 'Project Auto-Published', channels: ['in_app'], priority: 'high' },
  { id: 'projects.flagged', label: 'Project Flagged for Reuse', channels: ['in_app'], priority: 'high' },
]
```

### judging module notifications

```typescript
export const notificationTypes = [
  { id: 'judging.on_deck', label: 'Your Team Is On Deck', channels: ['in_app'], priority: 'urgent' },
  { id: 'judging.scoring_reminder', label: 'Complete Your Scoring', channels: ['in_app', 'email'], priority: 'high' },
  { id: 'judging.results_published', label: 'Results Published', channels: ['in_app', 'email'], priority: 'high' },
]
```

### sponsors module notifications

```typescript
export const notificationTypes = [
  { id: 'sponsors.voting_open', label: 'Voting Is Open', channels: ['in_app'], priority: 'normal' },
  { id: 'sponsors.voting_closing', label: 'Voting Closing Soon', channels: ['in_app'], priority: 'high' },
  { id: 'sponsors.prize_awarded', label: 'Prize Awarded', channels: ['in_app', 'email'], priority: 'high' },
]
```

### incidents module notifications

```typescript
export const notificationTypes = [
  { id: 'incidents.high_severity', label: 'High Severity Incident', channels: ['in_app', 'email'], priority: 'urgent' },
  { id: 'incidents.resolved', label: 'Incident Resolved', channels: ['in_app'], priority: 'normal' },
]
```

---

## 11. Real-Time Features

### 11.1 SSE Event Bridge Usage

All real-time features use OM's built-in DOM Event Bridge (SSE). No WebSocket needed.

| Feature | Events | Consumer |
|---------|--------|----------|
| Stage changes | `competitions.competition.stage_advanced` | Portal: `usePortalAppEvent` — update stage indicator, unlock/lock features |
| Demo timer | `judging.demo.status_changed` | Portal: `usePortalAppEvent` — start/stop local timers |
| Presentation queue | `judging.demo.queue_updated` | Portal: `usePortalAppEvent` — refresh queue list |
| Announcements | `competitions.announcement.created` | Portal: `usePortalAppEvent` — show toast + add to feed |
| Scoring progress | `judging.score.submitted` | Backend: `useAppEvent` — update progress dashboard |
| Check-in count | `competitions.participation.checked_in` | Backend: `useAppEvent` — increment counter |
| Team changes | `teams.team.*` | Portal/Backend: refresh team lists |
| Vote tally | `sponsors.vote.cast` | Backend: `useAppEvent` — update admin vote tally |

### 11.2 Demo Timer Architecture

```
Admin clicks "Start Presentation"
  │
  ▼
POST /api/judging/demos/:id/advance  { status: 'presenting' }
  │
  ├─► DB: DemoSession.status = PRESENTING, actualStart = now()
  │
  ├─► Emit: judging.demo.status_changed
  │         payload: { demoId, status: 'presenting', actualStart, durationMinutes, teamId, teamName, serverTime: Date.now() }
  │         portalBroadcast: true
  │
  ▼
All portal clients receive SSE event
  │
  ├─► Dashboard: Update "currently presenting" card
  ├─► Presentation Queue page: Highlight current team, start timer
  ├─► Kiosk view: Display team name, start large countdown
  └─► Judge view: Auto-load project details for current team
       Timer logic (client-side):
         clockDelta = serverTime - Date.now()  // computed on first event
         remaining = (actualStart + duration * 60_000) - (Date.now() + clockDelta)
         if remaining <= 0: show "TIME'S UP" visual/audio cue
```

**Clock skew correction:** Every SSE event includes `serverTime`. Clients compute `clockDelta = serverTime - Date.now()` on first event, then apply `clockDelta` to all timer calculations. This corrects for client clock drift without requiring NTP.

### 11.3 Audience Filtering

OM's SSE filters events by `tenantId`, `organizationId`, and optionally `recipientRoleIds`. This is leveraged:

- `judging.score.*` events include `recipientRoleIds: [adminRoleId]` → only admin sees scoring events
- `teams.invitation.*` events include `recipientUserIds: [inviteeId, inviterId]` → only relevant parties see invitation events
- `competitions.announcement.*` filtered by role/track via custom subscriber that re-emits targeted events

### 11.4 SSE Reconnection Strategy

When the SSE connection drops and reconnects:
1. Client shows a small "Reconnecting..." indicator
2. On reconnect, client fetches current state from API (current stage, current demo status, latest announcements)
3. Client reconciles local state with server state
4. Shows "Connected" indicator briefly, then hides
5. Last known state cached in `localStorage` as fallback during disconnection

### 11.5 Stage Transition UX (Portal)

When a `stage_advanced` event is received:
1. A dismissable banner/modal appears: "The competition has moved to [STAGE NAME]. [Brief description]. [CTA button to relevant page]"
2. The stage indicator in the header updates immediately
3. Newly available navigation items pulse/highlight briefly (2-3 seconds)
4. No forced navigation — the user chooses when to act
5. Features that became locked show a "This feature is no longer available" message if the user tries to access them

---

## 12. Access Control Matrix

### 12.1 Staff (Backend) Features

| Feature | superadmin | admin |
|---------|-----------|-------|
| `competitions.*` | ✓ | ✓ |
| `tracks.*` | ✓ | ✓ |
| `teams.*` | ✓ | ✓ |
| `projects.*` | ✓ | ✓ |
| `judging.*` | ✓ | ✓ |
| `sponsors.*` | ✓ | ✓ |
| `incidents.*` | ✓ | ✓ |

### 12.2 Customer (Portal) Features

| Feature | participant | mentor | judge |
|---------|------------|--------|-------|
| `portal.competitions.view` | ✓ | ✓ | ✓ |
| `portal.competitions.checkin` | ✓ | ✓ | ✓ |
| `portal.participants.view` | ✓ | ✓ | ✓ |
| `portal.tracks.view` | ✓ | ✓ | ✓ |
| `portal.teams.view` | ✓ | ✓ | ✓ |
| `portal.teams.create` | ✓ | | |
| `portal.teams.join` | ✓ | | |
| `portal.teams.invite` | ✓ | | |
| `portal.teams.leave` | ✓ | | |
| `portal.projects.view` | ✓ | ✓ | ✓ |
| `portal.projects.edit` | ✓ | | |
| `portal.projects.submit` | ✓ | | |
| `portal.judging.score` | | | ✓ |
| `portal.judging.view_assigned` | | | ✓ |
| `portal.judging.demos.view` | ✓ | ✓ | ✓ |
| `portal.judging.results.view` | ✓ | ✓ | ✓ |
| `portal.voting.cast` | ✓ | | |
| `portal.voting.view` | ✓ | ✓ | ✓ |
| `portal.sponsors.view` | ✓ | ✓ | ✓ |
| `portal.incidents.report` | ✓ | ✓ | ✓ |
| `portal.mentoring.view` | | ✓ | |
| `portal.mentoring.tracks` | | ✓ | |

**Runtime checks** (beyond RBAC features):
- Team-related write operations check user is team OWNER
- Project edit checks user is a member of the project's team
- Vote cast checks user is checked-in participant and not voting for own team
- Score submit checks judge is assigned to the project's panel
- Leaderboard endpoint: returns 403 for portal users if competition stage < FINISHED
- Projects list endpoint: portal users see only PUBLISHED projects (except their own team's project)
- Scores endpoint: portal judges see only their own scores (WHERE judgeId = currentUser.id)

---

## 13. Search Configuration

### 13.1 competitions module search

```typescript
export const searchConfig: SearchModuleConfig = {
  entities: [{
    entityId: 'competitions:competition',
    priority: 10,
    fieldPolicy: {
      searchable: ['name', 'description', 'location'],
      excluded: [],
    },
    formatResult: async (ctx) => ({
      title: ctx.record.name,
      subtitle: ctx.record.stage,
      icon: 'lucide:trophy',
      badge: 'Competition',
    }),
    resolveUrl: async (ctx) => `/backend/competitions/${ctx.record.id}`,
  }],
}
```

### 13.2 teams module search

```typescript
export const searchConfig: SearchModuleConfig = {
  entities: [{
    entityId: 'teams:team',
    priority: 8,
    fieldPolicy: {
      searchable: ['name', 'description'],
      excluded: [],
    },
    formatResult: async (ctx) => ({
      title: ctx.record.name,
      subtitle: ctx.record.status,
      icon: 'lucide:users',
      badge: 'Team',
    }),
    resolveUrl: async (ctx) => `/backend/teams/${ctx.record.id}`,
  }],
}
```

### 13.3 projects module search

```typescript
export const searchConfig: SearchModuleConfig = {
  entities: [{
    entityId: 'projects:project',
    priority: 9,
    fieldPolicy: {
      searchable: ['title', 'tagline', 'description', 'problemStatement', 'solution'],
      excluded: [],
    },
    buildSource: async (ctx) => ({
      text: [
        `Title: ${ctx.record.title}`,
        `Tagline: ${ctx.record.tagline}`,
        ctx.record.description,
        `Tech: ${(ctx.record.techStack as string[])?.join(', ')}`,
      ].filter(Boolean),
      presenter: { title: ctx.record.title, subtitle: ctx.record.tagline, icon: 'lucide:folder-code', badge: 'Project' },
      checksumSource: { record: ctx.record },
    }),
    formatResult: async (ctx) => ({
      title: ctx.record.title,
      subtitle: ctx.record.tagline,
      icon: 'lucide:folder-code',
      badge: 'Project',
    }),
    resolveUrl: async (ctx) => `/backend/projects/${ctx.record.id}`,
  }],
}
```

---

## 14. Framework Compliance Rules

These rules apply to EVERY module and EVERY endpoint. They are OM hard requirements.

### 14.1 API Route Compliance

- **Every API route file MUST export `openApi`** using `createCrudOpenApiFactory`. Include Zod schemas for request/response.
- **Every custom write endpoint** (POST/PUT/PATCH/DELETE that is not `makeCrudRoute`) **MUST call `validateCrudMutationGuard` before mutation** and `runCrudMutationGuardAfterSuccess` after.
- **Every non-CrudForm write operation** in the frontend MUST use `useGuardedMutation`.

### 14.2 Data Integrity

- **All multi-step write operations MUST use `withAtomicFlush({ transaction: true })`**. Critical operations:
  - Invitation acceptance (create TeamMember + update invitation status + cancel other pending invitations)
  - Score submission (create/update ProjectScore + create/update CriterionScores + compute totalScore)
  - Stage advancement (update competition stage + emit event)
  - Prize assignment (update Prize + emit event)
- **Concurrent mutation protection:**
  - Team membership: rely on DB unique constraint on `TeamMember(['competitionId', 'customerUserId'])`; handle constraint violation with user-friendly error
  - Team size limit: use `SELECT FOR UPDATE` on Team record when adding a member
  - Vote limit: use `SELECT FOR UPDATE` per voter or advisory lock; handle race with graceful error
  - Project editing: optimistic locking via `updatedAt` check on PUT requests

### 14.3 Module Structure

- **Each module MUST have `di.ts`** if it contains non-trivial business logic. Required for: `competitions` (StageService), `teams` (TeamService), `judging` (ScoringService, DemoTimerService), `sponsors` (VotingService)
- **Each module MUST have `setup.ts`** with `defaultRoleFeatures` AND `defaultCustomerRoleFeatures` specifying portal role permissions
- **Events MUST use `as const`** and be declared in `events.ts` before emission
- **Cross-module FKs are soft** (UUID columns, no ORM @ManyToOne). Verify `yarn db:generate` does not create actual FK constraints across modules. Migration order follows dependency graph: competitions → tracks → teams → projects → judging → sponsors → incidents

### 14.4 Command Pattern

All CRUD operations use `makeCrudRoute` which handles commands internally. Custom write operations (stage advance, disqualify, flag, assign-prize, cast-vote) MUST use `withAtomicFlush` for safe entity mutation and `emitCrudSideEffects` for indexing and cache invalidation.

### 14.5 Confirmation Dialogs

Every destructive or hard-to-reverse action MUST have a confirmation dialog showing:
1. Clear description of what will happen
2. Consequences (e.g., "You will not be able to rejoin this team")
3. Confirm/cancel buttons with destructive action in red

Actions requiring confirmation: leave team, remove member, decline invitation, dissolve team, disqualify team, flag project, advance stage, delete any entity.

---

## 15. Non-Functional Requirements

### 15.1 Mobile-First Design

The platform is mobile-first — most participants use phones during the event.

| Page | Mobile Considerations |
|------|----------------------|
| Score Card | Tappable number buttons (not sliders), collapsible project details, floating quick notes |
| Project Editor | Vertically stacked fields, touch-friendly file upload |
| Demo Queue | No drag-to-reorder on mobile; use up/down arrow buttons instead |
| Team Browser | Card layout, touch-friendly join/invite buttons |
| Kiosk | Detects small screen and suggests "Use a larger screen for the best experience" |
| Demo Control (admin) | Large action buttons with ample touch targets (min 48x48px) |

### 15.2 Accessibility (WCAG 2.1 AA)

- All track color badges MUST pass 4.5:1 contrast ratio, or use color as border/accent with text on neutral background
- All interactive elements MUST have ARIA labels
- Timer kiosk MUST be perceivable without color (use both color AND text labels: "TIME'S UP")
- All forms MUST have proper label associations and logical tab order
- Real-time updates MUST use `aria-live="polite"` (announcements) or `aria-live="assertive"` (urgent: "Your team is on deck")
- Timer MUST have `aria-label` that updates: "3 minutes 45 seconds remaining"
- All page content MUST be navigable via keyboard

### 15.3 Offline Resilience

- Service worker caches: agenda, team roster, project draft, competition config on first load
- Offline banner: "You're offline — some features may be outdated"
- Write operations (vote cast, score save, project draft save) queued in localStorage and retried on reconnect
- Project editor saves drafts to localStorage as last-resort backup
- Presentation timer runs locally even if SSE disconnects (computed from last known actualStart)

### 15.4 GDPR / RODO Compliance

- **Privacy policy acceptance** required during onboarding (separate from CoC). Tracked via `CompetitionParticipation.privacyPolicyAccepted` with timestamp.
- **Profile completeness gate**: participants must fill in at least display name and skills before team formation
- **Data retention**: After competition ARCHIVED, a configurable retention period applies (default: 12 months). After expiry, a background job anonymizes PII (names, emails, bios) while preserving aggregate statistics.
- **Right to erasure**: Admin can trigger anonymization for a specific user via `customer_accounts` deletion/anonymization flow. This replaces personal data with "[Anonymized]" across all entities referencing the user.
- **Data export**: Participant can request an export of their personal data (profile, team membership, project, scores) via a portal endpoint.

### 15.5 Empty States

Every list/collection page MUST define an empty state with illustration, explanation, and CTA where applicable:
- Team Browser (no teams): "No teams have been created yet. Be the first to start one! [Create Team]"
- Projects (no submissions): "No projects submitted yet. Check back after the hacking phase."
- Announcements (none): "No announcements yet. Check back soon."
- Judging Dashboard (no assigned projects): "No projects assigned to you yet. Panels will be configured by the organizer."
- Results (before FINISHED): "Results will be available after the judging phase."
- Participants (looking for team, none): "No one is currently looking for a team."

### 15.6 Onboarding & Guidance

- Brief tooltip tour (3-5 steps) on first login: "Welcome to HackOn! Here's your dashboard. The competition is currently in [STAGE]. Your next step is [ACTION]."
- Contextual help icons (?) next to complex concepts: "Originality Disclosure", "Track Selection", "Scoring Criteria"
- Progress indicator for onboarding flow: activate → profile → CoC → privacy → check-in (shown in dashboard)
- Project submission completeness checklist: "5 of 8 required fields completed"

---

## 16. Caching Strategy

Using OM's built-in `cacheService` with tag-based invalidation.

| Cache Key Pattern | TTL | Tags | Invalidated By |
|-------------------|-----|------|----------------|
| `{tenantId}:competitions:{id}:config` | 5 min | `competitions`, `tenant:{tenantId}` | Competition CRUD events |
| `{tenantId}:competitions:{id}:tracks` | 5 min | `tracks`, `tenant:{tenantId}` | Track CRUD events |
| `{tenantId}:competitions:{id}:leaderboard:{trackId}` | 30 sec | `judging`, `tenant:{tenantId}` | Score events |
| `{tenantId}:competitions:{id}:checkin-count` | 10 sec | `competitions`, `tenant:{tenantId}` | Check-in events |
| `{tenantId}:competitions:{id}:team-stats` | 30 sec | `teams`, `tenant:{tenantId}` | Team CRUD events |
| `{tenantId}:competitions:{id}:submission-stats` | 30 sec | `projects`, `tenant:{tenantId}` | Project events |

Competition config is the hottest cache entry — read on nearly every API call for business rule checks (team sizes, stage config, deadlines). Even short TTL (30 seconds) eliminates redundant DB reads during high-traffic moments.

---

## 17. Deployment Architecture

### Production Topology

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  Next.js Server         │     │  Event Worker            │
│  (HTTP + SSE)           │────▶│  (persistent subs)       │
│  Port 3000              │     │  yarn mercato events     │
└────────┬────────────────┘     │  worker --concurrency=5  │
         │                      └────────┬────────────────┘
         │                               │
         ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  PostgreSQL             │     │  Redis                   │
│  (data store)           │     │  (queue + event bus)     │
└─────────────────────────┘     └─────────────────────────┘
```

### Key Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| `QUEUE_STRATEGY` | `async` | Redis-backed for cross-process event delivery |
| `CACHE_STRATEGY` | `redis` | Shared cache across processes |
| nginx `proxy_read_timeout` | `86400` (24h) | SSE connections must not be killed by proxy |
| nginx `proxy_buffering` | `off` | SSE requires unbuffered responses |
| Worker concurrency | `5` | Balance between throughput and DB connection usage |

### Development Topology

Single process with `QUEUE_STRATEGY=local` and `CACHE_STRATEGY=memory`. All events processed in-process.

---

## 18. Testing Strategy

### Unit Tests
- Score calculation: pure function with comprehensive test cases for single-round, two-round, weighted averages, missing scores, outlier removal
- Stage transition validation: all valid/invalid transition pairs
- Vote limit enforcement: concurrent vote scenarios
- Zod validators for all JSONB config blocks
- Invitation expiration logic

### Integration Tests (Event Flows)
- Use OM's local queue strategy for synchronous event processing
- Test: advance to HACKING → verify draft projects created for all teams
- Test: advance to DEMOS → verify projects auto-published → verify demo queue generated (ordering dependency)
- Test: advance to FINISHED → verify scores calculated → verify leaderboard correct
- Test: invitation acceptance → verify TeamMember created + other pending invitations cancelled

### End-to-End Tests
- Full competition lifecycle: DRAFT → ... → ARCHIVED with all side effects verified at each stage
- Multi-role flow: admin creates competition, participant joins team, submits project, judge scores, results published

### Dry Run Mode
- `GET /api/competitions/:id/stage-preview` returns what side effects would fire without executing them
- Used by integration tests and admin preview

---

## 19. Implementation Plan

### Phase 1 — Foundation & Competition Shell (Week 1)

**Goal:** Competition entity, admin CRUD, portal shell, user registration.

| Step | Module | Deliverable | Testable? |
|------|--------|-------------|-----------|
| 1.1 | `competitions` | Scaffold module, Competition entity + migration | ✓ DB migration runs |
| 1.2 | `competitions` | Competition CRUD API + backend pages (list/create/edit) | ✓ CRUD works in backend |
| 1.3 | `competitions` | Stage advance command with validation | ✓ Can advance DRAFT→OPEN→...→ARCHIVED |
| 1.3a | `competitions` | ParticipantProfile entity + CRUD | ✓ Profile fields stored |
| 1.4 | `competitions` | CompetitionParticipation entity + CRUD | ✓ Can register participants |
| 1.5 | `competitions` | Bulk CSV import for participants | ✓ Can import 100+ users from CSV |
| 1.6 | `competitions` | Portal shell setup: customer roles (participant, mentor, judge), portal nav, dashboard widget | ✓ Users can login to portal |
| 1.6a | `competitions` | Competition context response enricher | ✓ Other modules can access competition name/stage via enrichment |
| 1.7 | `competitions` | CoC acceptance gate + privacy policy acceptance gate (portal middleware) | ✓ Portal blocked until CoC and privacy policy accepted |
| 1.8 | `competitions` | QR code generation + check-in API | ✓ Check-in flow works |
| 1.9 | `competitions` | AgendaItem entity + CRUD + portal agenda page | ✓ Agenda visible in portal |
| 1.10 | `competitions` | Announcement entity + CRUD + portal feed | ✓ Announcements broadcast |
| 1.11 | `competitions` | Participants Directory portal page | ✓ Participants browsable |
| 1.12 | `competitions` | Announcements Feed portal page | ✓ Announcements browsable |

**Events wired:** `competitions.competition.stage_advanced`, `competitions.participation.checked_in`, `competitions.announcement.created`

---

### Phase 2 — Tracks & Teams (Week 2)

**Goal:** Track management, team formation, invitations, track selection.

| Step | Module | Deliverable | Testable? |
|------|--------|-------------|-----------|
| 2.1 | `tracks` | Scaffold module, Track entity + migration + CRUD | ✓ Tracks manageable in backend |
| 2.2 | `tracks` | Portal tracks view (browse tracks with details) | ✓ Participants see tracks |
| 2.2a | `teams` | Team member count enricher for teams module | ✓ Team lists show member counts |
| 2.3 | `teams` | Scaffold module, Team + TeamMember + TeamInvitation entities + migration | ✓ Entities created |
| 2.4 | `teams` | Team creation API + portal page | ✓ Participant creates team |
| 2.5 | `teams` | Invitation flow: send invite, accept, decline, expire | ✓ Full invitation lifecycle |
| 2.6 | `teams` | Join request flow: request, approve, reject | ✓ Join request works |
| 2.7 | `teams` | Team browser portal page with filters + "People Looking for Teams" tab | ✓ Browse and join teams |
| 2.8 | `teams` | Track selection API + portal UI | ✓ Team owner selects track |
| 2.9 | `teams` | "Looking for team" flag on CompetitionParticipation | ✓ Flag visible in team browser |
| 2.10 | `teams` | Team management backend page (admin view all teams) | ✓ Admin sees all teams |
| 2.11 | `teams` | Disqualification/withdraw flow | ✓ Admin can disqualify |
| 2.12 | `teams` | Stage-aware lockdown subscriber (lock on HACKING) | ✓ Membership locked after stage advance |
| 2.13 | `tracks` | Mentor tracks portal page (read-only team/project browse) | ✓ Mentors can see assigned tracks |

**Events wired:** All `teams.*` events

---

### Phase 3 — Projects & Submissions (Week 3)

**Goal:** Project CRUD, media uploads, originality disclosure, submission flow.

| Step | Module | Deliverable | Testable? |
|------|--------|-------------|-----------|
| 3.1 | `projects` | Scaffold module, Project entity + migration | ✓ Entity created |
| 3.2 | `projects` | Project CRUD API | ✓ API returns projects |
| 3.3 | `projects` | Portal project editor with all fields | ✓ Team members can edit |
| 3.3a | `projects` | Project enricher (team name, track name) | ✓ Project lists show team/track context |
| 3.3b | `projects` | Project editor auto-save + deadline UX | ✓ Auto-save works, deadline warnings show |
| 3.4 | `projects` | Screenshot/attachment upload via `attachments` module | ✓ Media uploads work |
| 3.5 | `projects` | Originality disclosure UI section | ✓ Disclosure fields work |
| 3.6 | `projects` | Submit flow: validation, DRAFT→PUBLISHED | ✓ Submission with deadline check |
| 3.7 | `projects` | Admin flag/unflag for code reuse | ✓ Flag visible to judges |
| 3.8 | `projects` | Auto-create drafts on HACKING stage (subscriber) | ✓ Projects created for all teams |
| 3.9 | `projects` | Backend project management page | ✓ Admin views all projects |
| 3.10 | `projects` | Submission progress tracker | ✓ Admin sees submitted/total |

**Events wired:** All `projects.*` events

---

### Phase 4 — Demos & Judging (Week 4)

**Goal:** Demo presentation queue, timer, judging panels, scoring.

| Step | Module | Deliverable | Testable? |
|------|--------|-------------|-----------|
| 4.1 | `judging` | Scaffold module, all judging entities + migration | ✓ Entities created |
| 4.2 | `judging` | JudgePanel CRUD + judge/track assignment APIs | ✓ Panels configurable |
| 4.3 | `judging` | JudgingCriterion CRUD (with weight validation) | ✓ Criteria manageable |
| 4.4 | `judging` | Demo queue generation from published projects | ✓ Queue generated |
| 4.5 | `judging` | Demo status advancement API + SSE events | ✓ Status changes broadcast |
| 4.6 | `judging` | Portal presentation queue page with live timer | ✓ Timer syncs across clients |
| 4.7 | `judging` | Kiosk/projector view (full-screen timer) | ✓ Large-screen timer works |
| 4.8 | `judging` | Demo control backend page (admin queue management) | ✓ Admin controls queue |
| 4.9 | `judging` | Score submission API + portal score card | ✓ Judges can score |
| 4.10 | `judging` | Scoring progress dashboard (backend) | ✓ Admin sees progress |
| 4.11 | `judging` | Final score calculation: on-demand for leaderboard, persisted snapshot at FINISHED | ✓ Scores compute correctly |
| 4.12 | `judging` | Leaderboard generation per track | ✓ Rankings correct |
| 4.13 | `judging` | Two-round judging: finalist selection + final round | ✓ Two-round flow works |
| 4.14 | `judging` | Score auto-save + draft/submitted badge UX | ✓ Partial scores saved |

**Events wired:** All `judging.*` events

---

### Phase 5 — Voting, Sponsors & Prizes (Week 5)

**Goal:** People's Choice, sponsor management, prize assignment, results.

| Step | Module | Deliverable | Testable? |
|------|--------|-------------|-----------|
| 5.1 | `sponsors` | Scaffold module, Sponsor + Prize + PeerVote entities + migration | ✓ Entities created |
| 5.2 | `sponsors` | Sponsor CRUD + backend pages | ✓ Sponsors manageable |
| 5.3 | `sponsors` | Prize CRUD + backend pages | ✓ Prizes configurable |
| 5.4 | `sponsors` | Portal sponsors & prizes view | ✓ Visible in portal |
| 5.5 | `sponsors` | People's Choice voting API + portal voting page | ✓ Participants can vote |
| 5.6 | `sponsors` | Vote tally + auto-suggest People's Choice prize | ✓ Tally correct |
| 5.7 | `sponsors` | Prize assignment API + backend UI | ✓ Admin assigns prizes |
| 5.8 | `sponsors` | Results portal page (scores, prizes, leaderboard) | ✓ Results visible after FINISHED |
| 5.9 | `sponsors` | "Publish Results" flow (DELIBERATION → FINISHED) | ✓ All results published simultaneously |

**Events wired:** All `sponsors.*` events

---

### Phase 6 — Incidents, Cross-Cutting & Polish (Week 6)

**Goal:** CoC reporting, remaining notifications, cross-cutting concerns, polish.

| Step | Module | Deliverable | Testable? |
|------|--------|-------------|-----------|
| 6.1 | `incidents` | Scaffold module, IncidentReport entity + migration + CRUD | ✓ Incidents work |
| 6.2 | `incidents` | Portal incident report form + floating button | ✓ Incident report from any portal page |
| 6.3 | `incidents` | Backend incident management page | ✓ Admin manages incidents |
| 6.4 | `incidents` | Anonymous reporting flow (with audit log bypass) | ✓ Anonymous reports preserved |
| 6.5 | All | Wire remaining notification types + handlers | ✓ All notifications delivered |
| 6.6 | `competitions` | Event Command Center with traffic lights + side effect status | ✓ Real-time metrics with priority |
| 6.7 | All | Search configuration for all modules | ✓ Search works |
| 6.8 | All | i18n: Polish (pl.json) + English (en.json) translations | ✓ Both languages work |
| 6.9 | All | Caching: competition config, track list, leaderboard | ✓ Cache reduces DB load |
| 6.10 | All | Mobile responsiveness pass for all portal pages | ✓ All pages work on 375px |
| 6.11 | All | Accessibility audit (WCAG 2.1 AA) | ✓ Contrast, ARIA, keyboard nav |
| 6.12 | All | Onboarding tour + contextual help icons | ✓ First-time guidance works |
| 6.13 | All | Offline resilience: service worker + localStorage fallbacks | ✓ Works with spotty Wi-Fi |
| 6.14 | All | End-to-end flow testing: full competition lifecycle | ✓ Complete flow works |

---

## 20. Risks

| Risk | Severity | Mitigation | Residual |
|------|----------|-----------|----------|
| Demo timer sync across clients with poor venue Wi-Fi | High | Timer is client-side computed from server-sent `actualStart` timestamp; works even if SSE drops. Add periodic SSE heartbeat to detect disconnection. Cache essential state in localStorage. | Brief visual discrepancy on reconnect |
| CustomerUser RBAC may not support hackathon-specific runtime checks (team ownership, competition membership) | Medium | Layer custom middleware on portal API routes that checks `CompetitionParticipation` and `TeamMember` records. Feature flags gate broad access; middleware gates contextual access. | Additional middleware code per route |
| Stage transition side effects (auto-publish projects, generate queue, calculate scores) could partially complete | Critical | Each subscriber is idempotent and dispatches heavy work as worker jobs. Admin can re-run side effects via `POST /api/competitions/:id/rerun-side-effects`. Event Command Center shows side effect status (pending/completed/failed). Score calculation for FINISHED can be run synchronously as fallback. | Manual recovery available via admin re-run |
| 200+ concurrent SSE connections may stress server | Medium | OM's event bridge is designed for this scale. Use `async` queue strategy in production (Redis-backed). SSE audience filtering reduces payload. Consider CloudFlare/nginx buffering for SSE. | Unlikely to be an issue at 200 users |
| Customer roles (participant/mentor/judge) may need to be per-competition, not global | Medium | `CompetitionParticipation.role` handles per-competition roles. Portal features gated by customer role + participation check. A user could be a judge in one competition and participant in another. | Need careful middleware |
| Score calculation complexity for two-round judging | Medium | Implement score calculation as a pure function with comprehensive unit tests. Admin can recalculate at any time. Intermediate scores stored, final computed on demand. | Admin override available |
| Bulk CSV import of 100+ users may be slow synchronously | Low | Use OM's queue system: import CSV → create worker job → process records in background → emit progress events. | Background processing with progress indicator |
| Race conditions in invitation/voting concurrent mutations | High | DB unique constraints as safety net + SELECT FOR UPDATE for limits. Handle constraint violations with user-friendly errors. | Edge case: two users accept simultaneously, one gets error |
| Clock skew on venue devices affects demo timer accuracy | Medium | SSE events include `serverTime` for client-side delta correction. | Sub-second accuracy restored after first event |
| Concurrent project editing (last-write-wins) | Medium | Optimistic locking via `updatedAt` check on PUT requests. Reject stale writes with "This project was modified by another team member. Please refresh." | Minor UX friction on concurrent edits |
| Anonymous incident reports de-anonymized via audit logs | High | Custom audit entry for anonymous reports uses system user identity. Bypass standard audit log for `POST /api/incidents` when `reporterId` is null. | Requires custom audit subscriber |
| Stage transition side effects partially complete | Critical | Each subscriber is idempotent and dispatches heavy work as worker jobs. Admin can re-run side effects. Event Command Center shows side effect status (pending/completed/failed). Score calculation for FINISHED can be run synchronously as fallback. | Manual recovery available via admin re-run |

---

## 21. Design Decisions

| # | Decision | Rationale | Alternatives Considered |
|---|----------|-----------|------------------------|
| 1 | Use `customer_accounts` for all non-admin users (participant, mentor, judge) | Leverages existing auth, invitation, profile, RBAC. Avoids building auth from scratch. Portal infrastructure is ready-made. | Custom auth module — rejected: massive duplication of existing OM auth |
| 2 | 7 custom modules (competitions, tracks, teams, projects, judging, sponsors, incidents) | Balanced between isolation (OM module independence) and pragmatism (avoiding too many tiny modules). Each module has 1-7 entities with related business logic. | Fewer modules (3-4 large) — rejected: too much coupling within modules. More modules (12+) — rejected: too much cross-module boilerplate for single-entity modules. |
| 3 | JSONB for configuration blocks (stageConfig, demoConfig, judgingConfig, peerVotingConfig) | Config is read-as-whole, rarely queried by individual fields. JSONB avoids unnecessary table proliferation for settings. | Separate config tables — rejected per OM JSONB guidelines (read as whole = JSONB) |
| 4 | JSONB array for Track.mentorIds instead of junction table | Small cardinality (2-5 mentors per track), queried only "mentors for this track" direction. Saves a module-crossing junction table. | Junction table — acceptable but adds cross-module complexity for minimal gain |
| 5 | PeerVote in `sponsors` module (not `projects` or `judging`) | Voting results feed into the People's Choice prize (which lives in sponsors). Vote cast is about the prize outcome, not about the project content. | In `projects` — rejected: projects don't own the voting configuration. In `judging` — acceptable but judging is already complex. |
| 6 | Demo timer via SSE event + client-side countdown (not server polling) | Sub-second accuracy, network-resilient, low server load. All clients compute from same `actualStart` timestamp. | WebSocket with server ticks — rejected: OM doesn't provide WS infrastructure; SSE is built-in. Server polling — rejected: too much latency and server load |
| 7 | CriterionScore as separate entity (not JSONB array on ProjectScore) | Need to query "all scores for criterion X" for anomaly detection and statistics. Need unique constraint per criterion per score. | JSONB array on ProjectScore — rejected: can't query individual criterion scores efficiently |
| 8 | Single-org deployment (one tenant, one organization) | Hackathon platform serves one organization running events. Multi-tenancy fields still present (OM requirement) but seeded with single values. | Multi-org — deferred: no current requirement for white-label |
| 9 | `ParticipantProfile` as a separate entity in `competitions` module (not custom fields via `ce.ts`) | Need to query by skills for participant directory filtering. Custom fields via ce.ts don't support efficient querying. Separate entity allows proper indexes and Zod validation. | Custom fields via ce.ts — rejected: not queryable for filtering. Extending CustomerUser directly — rejected: cross-module entity modification |
| 10 | Leaderboard scores computed on-demand, persisted only at FINISHED | Admin needs provisional leaderboard during DELIBERATION. On-demand computation avoids stale cache issues when scores are updated. Snapshot at FINISHED is the final record. | Compute on every score change — rejected: too expensive. Cache only — rejected: stale data risk during active judging |
| 11 | Stage transition side effects dispatched as worker jobs | Subscribers handling 50+ entities (auto-publish, queue generation, score calculation) would time out inline. Workers provide retry semantics, progress tracking, and isolation. | Inline execution — rejected: timeout risk for large competitions |

---

## Acceptance Criteria

- [ ] Admin can create a competition with all configuration fields
- [ ] Admin can advance competition through all stages (DRAFT → ... → ARCHIVED)
- [ ] Stage transitions trigger correct side effects (lock teams, publish projects, generate queue, calculate scores)
- [ ] Participants/mentors/judges can login via portal (magic link or password)
- [ ] CoC acceptance gate blocks portal access until accepted
- [ ] QR check-in flow works (admin scans, participant status updates)
- [ ] Participants can create teams, send invitations, accept join requests
- [ ] Team size constraints enforced (min/max from competition config)
- [ ] Teams can select tracks (with optional track-change before hacking)
- [ ] Teams can create/edit projects with all fields, screenshots, and originality disclosure
- [ ] Project submission validates required fields and locks content
- [ ] Demo presentation queue displays correctly with live timer across all clients
- [ ] Kiosk/projector view shows large timer with color transitions
- [ ] Admin can control demo flow (start, advance, skip, reorder)
- [ ] Judges can score projects with per-criterion scores and written feedback
- [ ] Scoring progress visible to admin (who scored what)
- [ ] Final scores calculated correctly (weighted averages, two-round support)
- [ ] Leaderboard generated per track with correct rankings
- [ ] People's Choice voting: participants can vote (with constraints), tally is correct
- [ ] Admin can assign prizes to projects
- [ ] Results published simultaneously to all participants
- [ ] Incident reports can be filed (including anonymously) from any portal page
- [ ] HIGH/CRITICAL incidents trigger immediate admin notification
- [ ] Announcements broadcast to portal users in real-time
- [ ] Event Command Center shows real-time metrics
- [ ] All audit-worthy actions logged via audit_logs module
- [ ] Full event lifecycle testable end-to-end
- [ ] Privacy policy acceptance gate works alongside CoC gate
- [ ] Participant profile (skills, bio, social links, organization) can be created and queried
- [ ] Participants Directory page shows filterable participant list
- [ ] Announcements Feed page shows chronological announcements with priority visual differentiation
- [ ] Mentor portal shows assigned tracks with team/project overview
- [ ] Portal dashboard shows "Your Current Task" card with stage-aware prompts
- [ ] All portal nav items visible at all times (disabled when unavailable)
- [ ] Stage advance confirmation shows side effect preview, warnings, and requires explicit acknowledgment
- [ ] Admin can re-run side effects for current stage
- [ ] Score card uses tappable number buttons (not sliders) and works on mobile
- [ ] All pages have defined empty states
- [ ] WCAG 2.1 AA compliance: contrast ratios, ARIA labels, keyboard navigation
- [ ] Offline: service worker caches essential data, writes queued during disconnection
- [ ] All portal pages responsive on 375px mobile screens
- [ ] All destructive actions have confirmation dialogs
- [ ] Anonymous incident reports are not traceable in audit logs

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-17 | Initial draft — full specification covering all 7 modules, data models, API contracts, portal/backend pages, events, notifications, RBAC, search, and phased implementation plan |
| 2026-03-17 | Rev 2 — Applied all findings from three-perspective review (SPEC-001-REVIEW). Added: ParticipantProfile entity, GDPR/privacy policy fields, Zod validators for JSONB configs, missing indexes, soft delete on TeamMember/JudgingCriterion/JudgePanel, projectId on DemoSession, framework compliance rules section, non-functional requirements (mobile-first, WCAG, offline, GDPR), caching strategy, deployment architecture, testing strategy, missing CRUD events, stage advance guardrails, score visibility security, anonymous incident audit fix, clock skew correction, Participants Directory page, Announcements Feed page, Mentor Tracks page, "Your Current Task" dashboard card, 16 new acceptance criteria. Revised implementation plan to distribute enrichers/search/notifications per-phase. |
