# SPEC-004 — Bounty Hunting Track

**Date**: 2026-04-04
**Status**: Draft
**Deadline**: 2026-04-10

## TLDR

**Key Points:**
- Automated pipeline that polls GitHub PRs labeled `bounty-hunting`, classifies them via Claude (Vercel AI SDK), detects duplicates, and awards points to hackathon participants. Judges review/approve PRs via a dedicated panel; a real-time leaderboard shows team and individual scores.
- Builds on Open Mercato's scheduler, event system, queue/workers, notifications, and DOM Event Bridge — avoiding custom infrastructure where the framework already provides a solution.

**Scope:**
- GitHub PR polling via scheduler → queue worker (reuses `@open-mercato/scheduler`)
- LLM classification + duplicate detection (Vercel AI SDK + Claude)
- Judge review panel (backend UI using `@open-mercato/ui` primitives)
- Real-time leaderboard + kiosk portal view (reuses DOM Event Bridge / SSE)
- Participant GitHub username registration (extends existing Participant entity)
- Activity feed with real-time updates

**Out of Scope (deferred):**
- GitHub webhook integration (polling-only for hackathon timeline)
- Multi-repo support (single repo: `open-mercato/open-mercato`)
- Bounty board where organizers post bounties (this is PR-detection-based)

---

## Overview

The Bounty Hunting track rewards hackathon participants for meaningful open-source contributions to the Open Mercato monorepo. Participants submit GitHub Pull Requests labeled `bounty-hunting`. An automated pipeline (scheduler → worker → LLM) classifies each PR, detects duplicates via semantic comparison, and calculates points. Judges approve or reject PRs via a dedicated judging panel. A real-time leaderboard displays individual and team scores both in-app and on a projected kiosk screen.

> **Market Reference**: Inspired by Hacktoberfest and GitHub Bounty programs. Adopted: multi-category point tiers, automated detection. Rejected: manual bounty posting (too slow for a 1-day hackathon), token-gated rewards.

## Problem Statement

- Hackathon participants contributing to open-source need immediate, visible feedback on their work
- Manual PR review and point tracking is error-prone and slow during a live event
- Duplicate submissions waste judge time without automated detection
- No existing module in the HackOn app handles GitHub PR tracking, LLM classification, or contribution scoring

## Proposed Solution

A new `bounties` module that uses the Open Mercato scheduler to poll GitHub every minute, a queue worker to run the LLM classification pipeline, the framework event system for real-time updates, and standard backend UI primitives for the judging panel.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Scheduler cron (1min) + queue worker instead of `setInterval` | Framework manages lifecycle, retries, enable/disable from admin UI. Idiomatic. |
| `createModuleEvents` + DOM Event Bridge instead of custom EventBus + SSE endpoint | Zero custom SSE code. Events with `clientBroadcast: true` auto-push to browser. |
| FK IDs + response enrichers instead of cross-module `@ManyToOne` | Module isolation. Enrichers resolve participant/team names without ORM coupling. |
| Add `githubUsername` to existing Participant entity | Simplest approach — avoids extra linking entity. Requires entity modification + migration. |
| UUID primary keys | Framework convention. Consistent with all other entities. |
| Kiosk as portal (frontend) page | Reuses portal infrastructure. No-auth public route via portal. |
| Vercel AI SDK `generateObject()` with Zod schemas | Type-safe structured LLM output. No parsing needed. |

## User Stories

- **Judge** wants to **review auto-classified PRs and approve/reject them** so that **points are awarded accurately**
- **Judge** wants to **override LLM classifications and adjust points** so that **edge cases are handled fairly**
- **Judge** wants to **see real-time activity of incoming PRs** so that **they can respond quickly during the event**
- **Participant** wants to **register their GitHub username** so that **their PRs are detected and scored**
- **Participant** wants to **see a real-time leaderboard** so that **they can track their team's progress**
- **Organizer** wants to **display a kiosk leaderboard on a projector** so that **the event has visible energy**
- **Organizer** wants to **trigger manual GitHub refresh** so that **new PRs appear immediately when needed**

---

## Data Models

### BountyPullRequest (Singular)

Main entity representing a GitHub PR detected by the polling service.

- `id`: string (UUID, PK, `gen_random_uuid()`)
- `tenant_id`: string (UUID, FK, indexed)
- `organization_id`: string (UUID, FK, indexed)
- `competition_id`: string (UUID, FK, indexed) — links to the competition this bounty track belongs to
- `github_pr_id`: number — GitHub's unique PR ID (unique per tenant)
- `github_pr_number`: number — PR number in the repo
- `github_pr_url`: string (text) — full URL to the PR
- `title`: string (text) — PR title
- `description`: string | null (text) — PR body/description
- `diff_content`: string | null (text) — cached diff content
- `github_author`: string (varchar 255) — GitHub username of PR author
- `participant_id`: string | null (UUID, FK, indexed) — FK to Participant entity
- `team_id`: string | null (UUID, FK, indexed) — FK to Team entity (denormalized for leaderboard queries)
- `status`: BountyPRStatus (text, indexed, default: `'detected'`)
- `classifications`: BountyClassification[] | null (jsonb) — LLM classification results
- `classification_confidence`: number | null (float) — overall confidence 0.0–1.0
- `classification_summary`: string | null (text) — one-sentence LLM summary of PR
- `total_points`: number (int, default: 0) — calculated point total
- `points_override`: BountyClassification[] | null (jsonb) — judge-overridden classifications
- `is_duplicate`: boolean (default: false)
- `duplicate_of_id`: string | null (UUID, FK) — FK to original BountyPullRequest
- `duplicate_marked_by`: string | null (varchar 50) — `'llm'` or `'judge'`
- `duplicate_similarity`: number | null (float) — semantic similarity score
- `github_created_at`: Date (timestamptz) — when PR was created on GitHub
- `created_at`: Date (timestamptz, auto)
- `updated_at`: Date (timestamptz, auto)
- `deleted_at`: Date | null (timestamptz, soft delete)

**Compound unique**: `['github_pr_id', 'tenant_id']`

```typescript
export const BountyPRStatus = {
  DETECTED: 'detected',
  CLASSIFIED: 'classified',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DUPLICATE: 'duplicate',
} as const
export type BountyPRStatus = (typeof BountyPRStatus)[keyof typeof BountyPRStatus]
```

### BountyActivityLog (Singular)

Feeds the real-time activity feed on the judging panel.

- `id`: string (UUID, PK, `gen_random_uuid()`)
- `tenant_id`: string (UUID, FK, indexed)
- `organization_id`: string (UUID, FK, indexed)
- `type`: BountyActivityType (text)
- `pull_request_id`: string | null (UUID, FK) — FK to BountyPullRequest
- `actor_user_id`: string | null (UUID) — staff user who performed action (null for automated)
- `message`: string (text) — human-readable activity message
- `metadata`: Record<string, unknown> | null (jsonb) — extra structured data
- `created_at`: Date (timestamptz, auto, indexed DESC)

```typescript
export const BountyActivityType = {
  PR_DETECTED: 'pr_detected',
  PR_CLASSIFIED: 'pr_classified',
  PR_APPROVED: 'pr_approved',
  PR_REJECTED: 'pr_rejected',
  PR_DUPLICATE: 'pr_duplicate',
  POINTS_ADJUSTED: 'points_adjusted',
  POINTS_REVOKED: 'points_revoked',
  CLASSIFICATION_OVERRIDDEN: 'classification_overridden',
  MANUAL_REFRESH: 'manual_refresh',
} as const
export type BountyActivityType = (typeof BountyActivityType)[keyof typeof BountyActivityType]
```

### BountyClassification (Type — stored as JSONB)

```typescript
export interface BountyClassification {
  category: BountyCategory
  points: number
  reasoning: string
}

export const BountyCategory = {
  CRITICAL_BUG_FIX: 'critical_bug_fix',
  REGULAR_BUG_FIX: 'regular_bug_fix',
  NEW_IMPROVED_TEST: 'new_improved_test',
  DOCUMENTATION_IMPROVEMENT: 'documentation_improvement',
  MINOR_FIX: 'minor_fix',
} as const
export type BountyCategory = (typeof BountyCategory)[keyof typeof BountyCategory]

export const BOUNTY_POINTS: Record<BountyCategory, number> = {
  critical_bug_fix: 10,
  regular_bug_fix: 5,
  new_improved_test: 3,
  documentation_improvement: 2,
  minor_fix: 1,
}
```

### Participant Entity Extension

Add `githubUsername` field to the existing Participant entity in `src/modules/competitions/data/entities.ts`:

```typescript
@Property({ name: 'github_username', type: 'varchar', length: 255, nullable: true })
githubUsername?: string | null
```

This requires a migration on the competitions module via `yarn db:generate`.

### Point Tiers

| Category | Points |
|---|---|
| Critical bug fix | 10 |
| Regular bug fix | 5 |
| New / improved test | 3 |
| Documentation improvement | 2 |
| Minor fix | 1 |

A single PR can earn from **multiple categories** (e.g., bug fix + test = 5 + 3 = 8 points).

---

## Core Flow (Open Mercato Architecture)

```
Scheduler cron job fires (every 1 minute)
  → Dispatches to queue: 'bounties-queue' / worker: 'poll-github'

Worker: poll-github (idempotent)
  → Octokit: fetch PRs with label 'bounty-hunting'
  → For each new PR:
      → Match github_author to Participant.githubUsername
      → Skip if unregistered
      → Create BountyPullRequest entity (status: DETECTED)
      → Emit event: bounties.pull_request.detected
  → For each existing PR:
      → Check GitHub label changes (approved/rejected by judge on GitHub)
      → Update status if changed
      → Emit events accordingly

Subscriber: on bounties.pull_request.detected (persistent)
  → Dispatches to queue: 'bounties-queue' / worker: 'classify-pr'

Worker: classify-pr (idempotent)
  → Vercel AI SDK generateObject() → classification (categories + confidence)
  → Vercel AI SDK generateObject() → duplicate detection
  → Update BountyPullRequest (status: PENDING_REVIEW or DUPLICATE)
  → Emit event: bounties.pull_request.classified (clientBroadcast: true)

Judge action (approve/reject/override) via API:
  → Route with requireFeatures: ['bounties.judge']
  → Update entity status + recalculate points
  → Octokit: add GitHub label (approved/rejected)
  → Emit event: bounties.pull_request.approved (clientBroadcast: true, portalBroadcast: true)

DOM Event Bridge:
  → Judge panel: useAppEvent('bounties.*') → refresh PR list + activity feed
  → Leaderboard: useAppEvent('bounties.pull_request.approved') → refresh scores
  → Kiosk (portal): portalBroadcast events → auto-update leaderboard
```

---

## Events

Declared in `src/modules/bounties/events.ts`:

```typescript
import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'bounties.pull_request.detected', label: 'PR Detected', entity: 'pull_request', category: 'lifecycle' },
  { id: 'bounties.pull_request.classified', label: 'PR Classified', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true },
  { id: 'bounties.pull_request.approved', label: 'PR Approved', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'bounties.pull_request.rejected', label: 'PR Rejected', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true },
  { id: 'bounties.pull_request.duplicate_detected', label: 'Duplicate Detected', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true },
  { id: 'bounties.pull_request.points_adjusted', label: 'Points Adjusted', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'bounties.poll.completed', label: 'Poll Completed', entity: 'poll', category: 'lifecycle', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'bounties', events })
export const emitBountiesEvent = eventsConfig.emit
export default eventsConfig
```

### Subscribers

| File | Event | Persistent | Purpose |
|---|---|---|---|
| `on-pr-detected.ts` | `bounties.pull_request.detected` | Yes | Dispatches classify-pr worker |
| `on-pr-approved.ts` | `bounties.pull_request.approved` | Yes | Sends notification to participant |
| `on-pr-rejected.ts` | `bounties.pull_request.rejected` | Yes | Sends notification to participant |

---

## Workers

| File | Queue | ID | Concurrency | Purpose |
|---|---|---|---|---|
| `poll-github.ts` | `bounties-queue` | `poll-github` | 1 | Polls GitHub API, creates/updates BountyPullRequest entities, emits events |
| `classify-pr.ts` | `bounties-queue` | `classify-pr` | 5 | Runs LLM classification + duplicate detection, updates entity |

Both workers MUST be idempotent. `poll-github` checks existing records before creating. `classify-pr` checks status before re-classifying.

### Scheduler Configuration

A scheduled job created in `setup.ts` via `onTenantCreated`:

- **Queue**: `bounties-queue`
- **Worker**: `poll-github`
- **Schedule**: `*/1 * * * *` (every minute)
- **Enabled**: defaults to `false` (admin enables when track starts)

---

## API Contracts

### Bounty PR List

- `GET /api/bounties/prs`
- Auth: `requireFeatures: ['bounties.view']`
- Query: `{ status?: BountyPRStatus, competition_id: string, page?: number, pageSize?: number, sort?: string }`
- Response: Paged list of BountyPullRequest with enriched participant/team names
- `openApi`: required

### Bounty PR Detail

- `GET /api/bounties/prs/:id`
- Auth: `requireFeatures: ['bounties.view']`
- Response: Full BountyPullRequest with classifications, activity logs
- `openApi`: required

### Approve PR

- `PATCH /api/bounties/prs/:id/approve`
- Auth: `requireFeatures: ['bounties.judge']`
- Request: `{}`
- Response: `{ ok: true, totalPoints: number }`
- Side effects: adds `approved` label on GitHub via Octokit, recalculates points, emits `bounties.pull_request.approved`
- Undo: `PATCH /api/bounties/prs/:id/reject` reverts to rejected, removes label

### Reject PR

- `PATCH /api/bounties/prs/:id/reject`
- Auth: `requireFeatures: ['bounties.judge']`
- Request: `{ reason?: string }`
- Response: `{ ok: true }`
- Side effects: adds `rejected` label on GitHub, zeroes points, emits `bounties.pull_request.rejected`
- Undo: `PATCH /api/bounties/prs/:id/approve`

### Override Classification

- `PATCH /api/bounties/prs/:id/classify`
- Auth: `requireFeatures: ['bounties.judge']`
- Request: `{ classifications: Array<{ category: BountyCategory, reasoning: string }> }`
- Response: `{ ok: true, totalPoints: number }`
- Side effects: stores override, recalculates points, emits `bounties.pull_request.points_adjusted`, logs activity

### Mark Duplicate

- `PATCH /api/bounties/prs/:id/duplicate`
- Auth: `requireFeatures: ['bounties.judge']`
- Request: `{ duplicate_of_id: string, reason?: string }`
- Response: `{ ok: true }`
- Side effects: zeroes points, sets `duplicate_marked_by: 'judge'`, emits event
- Undo: `PATCH /api/bounties/prs/:id/unduplicate` — clears duplicate flag, restores points

### Adjust Points

- `PATCH /api/bounties/prs/:id/points`
- Auth: `requireFeatures: ['bounties.judge']`
- Request: `{ total_points: number, reason: string }` (Zod: `z.number().min(0)`)
- Response: `{ ok: true }`
- Side effects: logs activity with reason, emits `bounties.pull_request.points_adjusted`

### Leaderboard

- `GET /api/bounties/leaderboard`
- Auth: public (no auth required)
- Query: `{ competition_id: string }`
- Response:
```typescript
{
  teams: Array<{
    team_id: string
    team_name: string
    total_points: number
    rank: number
    members: Array<{
      participant_id: string
      name: string
      github_username: string
      points: number
      pr_count: number
    }>
  }>
  last_updated: string // ISO datetime
}
```

### Activity Feed

- `GET /api/bounties/activity`
- Auth: `requireFeatures: ['bounties.view']`
- Query: `{ competition_id: string, limit?: number }` (default 50, max 100)
- Response: Paged list of BountyActivityLog

### Manual Poll Trigger

- `POST /api/bounties/poll`
- Auth: `requireFeatures: ['bounties.judge']`
- Request: `{ competition_id: string }`
- Response: `{ ok: true, new_prs: number }`
- Side effects: dispatches `poll-github` worker immediately, logs `MANUAL_REFRESH` activity

### Register GitHub Username

- `PATCH /api/portal/participants/:id/github`
- Auth: portal customer auth (participant's own record)
- Request: `{ github_username: string }` (Zod: `z.string().min(1).max(39).regex(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i)`)
- Response: `{ ok: true }`

---

## Response Enrichers

`src/modules/bounties/data/enrichers.ts` — resolves participant and team names on BountyPullRequest list responses:

```typescript
export const enrichers: ResponseEnricher[] = [
  {
    id: 'bounties.pr-participant-context',
    targetEntity: 'bounties:bounty_pull_request',
    priority: 10,
    timeout: 2000,
    fallback: { _participant: { name: null, github_username: null }, _team: { name: null } },
    async enrichMany(records, ctx) {
      // Batch-resolve participant_id → name, github_username
      // Batch-resolve team_id → team name
      // Return records with _participant and _team objects
    },
  },
]
```

---

## ACL Features

`src/modules/bounties/acl.ts`:

```typescript
export const features = [
  { id: 'bounties.view', title: 'View bounty PRs', module: 'bounties' },
  { id: 'bounties.judge', title: 'Judge bounty PRs (approve/reject/override)', module: 'bounties' },
  { id: 'bounties.admin', title: 'Administer bounty settings', module: 'bounties' },
]
```

`src/modules/bounties/setup.ts`:

```typescript
export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    superadmin: ['bounties.view', 'bounties.judge', 'bounties.admin'],
    admin: ['bounties.view', 'bounties.judge', 'bounties.admin'],
  },
  defaultCustomerRoleFeatures: {
    participant: ['portal.bounties.view', 'portal.bounties.register_github'],
    judge: ['portal.bounties.view'],
  },
  async onTenantCreated({ em, tenantId, organizationId }) {
    // Create scheduled job for GitHub polling (disabled by default)
  },
}
```

---

## Notifications

`src/modules/bounties/notifications.ts`:

| Type | Recipient | Trigger |
|---|---|---|
| `bounties.pr_approved` | Participant (customer) | PR approved by judge |
| `bounties.pr_rejected` | Participant (customer) | PR rejected by judge |
| `bounties.pr_detected` | Judges (staff) | New PR detected and classified |

---

## Search

`src/modules/bounties/search.ts`:

```typescript
export const searchConfig: SearchModuleConfig = {
  entities: [{
    entityId: 'bounties:bounty_pull_request',
    priority: 10,
    fieldPolicy: { searchable: ['title', 'description', 'github_author'], excluded: ['diff_content'] },
    formatResult: async (ctx) => ({
      title: `PR #${ctx.record.github_pr_number}: ${ctx.record.title}`,
      subtitle: `@${ctx.record.github_author} — ${ctx.record.status}`,
      icon: 'git-pull-request',
      badge: 'Bounty',
    }),
    resolveUrl: async (ctx) => `/backend/bounties/prs/${ctx.record.id}`,
  }],
}
```

---

## New Dependencies

```json
{
  "ai": "^6.0.146",
  "@ai-sdk/anthropic": "^3.0.66",
  "octokit": "^4.1.2"
}
```

- **`ai`** — Vercel AI SDK core, provides `generateObject()` for structured LLM output with Zod schema validation
- **`@ai-sdk/anthropic`** — Anthropic provider for Vercel AI SDK, connects to Claude API
- **`octokit`** — Official GitHub SDK for REST API (PR listing, label management, diff fetching)

### Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
GITHUB_REPO_OWNER=open-mercato
GITHUB_REPO_NAME=open-mercato
BOUNTY_LABEL=bounty-hunting
BOUNTY_APPROVED_LABEL=approved
BOUNTY_REJECTED_LABEL=rejected
```

---

## LLM Classification Pipeline

### Classification Service

Registered in `di.ts`. Uses Vercel AI SDK `generateObject()` with Zod schemas for type-safe structured output.

**Classification step**: Analyzes PR title, description, and diff content. Outputs one or more categories with confidence score. Categories are additive — a PR fixing a bug and adding a test gets both.

**Duplicate detection step**: Compares new PR diff against existing non-duplicate, non-rejected PRs. Uses semantic comparison. Only marks duplicate if PRs clearly resolve the same specific issue.

### Zod Schemas for LLM Output

```typescript
// Classification
export const classificationResultSchema = z.object({
  classifications: z.array(z.object({
    category: z.enum(['critical_bug_fix', 'regular_bug_fix', 'new_improved_test', 'documentation_improvement', 'minor_fix']),
    reasoning: z.string(),
  })),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
})

// Duplicate detection
export const duplicateCheckResultSchema = z.object({
  is_duplicate: z.boolean(),
  duplicate_of_pr_number: z.number().nullable(),
  similarity: z.number().min(0).max(1),
  reasoning: z.string(),
})
```

### LLM Model

Uses `anthropic('claude-sonnet-4-20250514')` — fast enough for real-time classification, capable enough for accurate code analysis.

### Diff Handling

- Fetch diffs via Octokit (`mediaType: { format: 'diff' }`)
- Truncate to 100KB for classification, 3KB preview per PR for duplicate comparison
- Skip generated files (lock files, `.mercato/generated/`)

---

## UI Pages

### Judge Panel — Backend Page

**Route**: `/backend/bounties` (auto-discovered from `src/modules/bounties/backend/page.tsx`)

**Layout**: Master-detail with activity feed.

```
┌─────────────────────────────────────────────────────────────────┐
│  Bounty Hunting — Judging Panel                    [Refresh]    │
├──────────────────────────┬──────────────────────────────────────┤
│  PR List (DataTable)     │  PR Detail Panel                     │
│                          │                                      │
│  Status filter tabs:     │  PR #42: Fix checkout race condition │
│  [All][Pending][Approved │  Author: @john-doe (Team Alpha)      │
│  ][Rejected][Duplicate]  │  Status: Classified                  │
│                          │  Confidence: 85%                     │
│  ┌────────────────────┐  │                                      │
│  │ PR #42  Classified │  │  LLM Classification:                 │
│  │ @john-doe — 8 pts  │  │  [x] Regular bug fix (5 pts)        │
│  ├────────────────────┤  │  [x] New test (3 pts)               │
│  │ PR #38  Approved   │  │  Total: 8 pts                       │
│  │ @jane — 10 pts     │  │                                      │
│  └────────────────────┘  │  Actions:                            │
│                          │  [Approve] [Reject]                  │
│                          │  [Override Classification]            │
│                          │  [Mark Duplicate] [Adjust Points]    │
├──────────────────────────┴──────────────────────────────────────┤
│  Activity Feed (real-time via useAppEvent)                       │
│  12:34:21  PR #42 detected from @john-doe: "Fix checkout..."    │
│  12:34:23  PR #42 classified: regular_bug_fix, new_test (85%)   │
│  12:33:01  PR #38 approved — 10 points to @jane                 │
└─────────────────────────────────────────────────────────────────┘
```

Uses `DataTable` for PR list, `CrudForm` for detail/actions. Low-confidence PRs (< 0.7) shown with amber badge. Real-time updates via `useAppEvent('bounties.*')`.

### Leaderboard — Backend Page

**Route**: `/backend/bounties/leaderboard`

Team ranking with expandable individual scores. Updates via `useAppEvent('bounties.pull_request.approved')`.

```
┌─────────────────────────────────────────────┐
│  Bounty Hunting Leaderboard                  │
│                                              │
│  #1  Team Alpha ················· 23 pts     │
│      @jane (10)  @john-doe (8)  @ali (5)     │
│                                              │
│  #2  Team Beta ·················· 18 pts     │
│      @sarah (10)  @mike (5)  @lee (3)        │
│                                              │
│  #3  Team Gamma ················· 12 pts     │
│      @bob (7)  @ann (5)                      │
│                                              │
│  Last updated: 12:35:01                      │
└─────────────────────────────────────────────┘
```

### Kiosk — Portal (Frontend) Page

**Route**: `/frontend/[orgSlug]/portal/bounties/kiosk` (auto-discovered)

Full-screen, projection-optimized. Uses `portalBroadcast` events for real-time updates.

Design:
- Dark background, high-contrast colors
- Large font sizes (team names ~48px, points ~64px)
- Animated rank changes (CSS transitions on position swap)
- Auto-scroll if more teams than fit on screen
- HackOn branding in corner
- No navigation or interactive elements

### GitHub Registration — Portal Widget

Inject a GitHub username field into the participant profile form via widget injection:

- Widget: `widgets/injection/GithubUsernameField/widget.tsx`
- Spot: `crud-form:competitions:participant:fields`
- Displays text input for GitHub username with validation

---

## Module File Structure

```
src/modules/bounties/
├── index.ts                              # Module metadata
├── acl.ts                                # Permission features
├── setup.ts                              # Role defaults + scheduled job creation
├── di.ts                                 # Awilix: ClassificationService, LeaderboardService
├── events.ts                             # Typed event declarations
├── notifications.ts                      # Notification type definitions
├── notifications.client.ts               # Client-side renderers
├── search.ts                             # Search config for bounty PRs
├── data/
│   ├── entities.ts                       # BountyPullRequest, BountyActivityLog
│   ├── validators.ts                     # Zod schemas (list query, approve, reject, override, etc.)
│   └── enrichers.ts                      # Resolve participant/team names
├── api/
│   ├── bounties/prs/route.ts             # GET list (makeCrudRoute)
│   ├── bounties/prs/[id]/route.ts        # GET detail
│   ├── bounties/prs/[id]/approve/route.ts
│   ├── bounties/prs/[id]/reject/route.ts
│   ├── bounties/prs/[id]/classify/route.ts
│   ├── bounties/prs/[id]/duplicate/route.ts
│   ├── bounties/prs/[id]/points/route.ts
│   ├── bounties/leaderboard/route.ts     # GET (public)
│   ├── bounties/activity/route.ts        # GET list
│   └── bounties/poll/route.ts            # POST (manual trigger)
├── subscribers/
│   ├── on-pr-detected.ts                 # → dispatches classify-pr worker
│   ├── on-pr-approved.ts                 # → notification to participant
│   └── on-pr-rejected.ts                 # → notification to participant
├── workers/
│   ├── poll-github.ts                    # Scheduled: GitHub API polling
│   └── classify-pr.ts                    # LLM classification + duplicate detection
├── services/
│   ├── ClassificationService.ts          # Vercel AI SDK integration
│   ├── LeaderboardService.ts             # Aggregation queries
│   └── GitHubService.ts                  # Octokit wrapper
├── backend/
│   ├── page.tsx                          # Judge panel (module root)
│   └── leaderboard/page.tsx              # Leaderboard page
├── frontend/
│   └── [orgSlug]/portal/bounties/
│       └── kiosk/page.tsx                # Kiosk leaderboard
├── widgets/
│   ├── injection/
│   │   ├── BountyMenuItem/widget.ts      # Sidebar menu item
│   │   └── GithubUsernameField/widget.tsx # Profile form field
│   └── injection-table.ts
└── translations.ts                       # i18n keys
```

Register in `src/modules.ts`: `{ id: 'bounties', from: '@app' }`

---

## Implementation Plan

### Phase 1: Foundation (Day 1 — Apr 4)

1. Register `bounties` module in `src/modules.ts`
2. Create `BountyPullRequest` and `BountyActivityLog` entities in `data/entities.ts`
3. Add `githubUsername` to Participant entity
4. Run `yarn db:generate` → review migrations → `yarn db:migrate`
5. Run `yarn generate`
6. Create `acl.ts`, `setup.ts`, `di.ts`, `events.ts`
7. Install dependencies (`ai`, `@ai-sdk/anthropic`, `octokit`)
8. Create Zod validators in `data/validators.ts`

### Phase 2: Core Pipeline (Day 2–3 — Apr 5–6)

1. Implement `GitHubService` (Octokit wrapper: fetch PRs, fetch diff, add label)
2. Implement `poll-github` worker (scheduled via cron)
3. Implement `ClassificationService` (classify + duplicate detection)
4. Implement `classify-pr` worker
5. Implement `on-pr-detected` subscriber (dispatches classify worker)
6. Implement `LeaderboardService` (aggregation query)
7. Build all API routes with `openApi` exports
8. Create response enrichers

### Phase 3: Judging Panel (Day 3–4 — Apr 6–7)

1. Build judge panel backend page with `DataTable` for PR list
2. PR detail panel with classification display
3. Approve/reject/override/duplicate/adjust action forms
4. Activity feed component with `useAppEvent('bounties.*')`
5. Manual refresh button (triggers `POST /api/bounties/poll`)
6. Low-confidence visual indicators (amber badge for < 0.7)
7. Sidebar menu injection widget

### Phase 4: Leaderboard & Portal (Day 4–5 — Apr 7–8)

1. In-app leaderboard backend page
2. Kiosk portal page (dark theme, large fonts, auto-refresh)
3. GitHub username registration widget (portal profile form injection)
4. Notification type definitions + client renderers
5. `portalBroadcast` event wiring for kiosk real-time updates
6. Animated rank changes on kiosk (CSS transitions)

### Phase 5: Testing & Hardening (Day 5 — Apr 9)

1. End-to-end: create PR → detect → classify → approve → leaderboard
2. Test duplicate detection with similar PRs
3. Test judge override flows
4. Test point revocation and adjustment
5. Verify GitHub label sync (approve/reject from panel)
6. Kiosk display on projector hardware
7. Run `yarn build` to verify no TS errors

### Buffer: Apr 10 (Event Day)

- Final smoke test
- Enable scheduled polling job from admin UI
- Deploy kiosk to projector

---

## Risks

| Risk | Severity | Mitigation | Residual |
|------|----------|------------|----------|
| GitHub API rate limiting (5,000 req/hr authenticated) | Low | 1-min poll = ~60 req/hr + diffs. Well within limits. Cache diffs in entity. | Could hit limits if manually refreshing frequently. Monitor. |
| LLM classification latency (2–5s per PR) | Medium | Async via queue worker. UI shows "classifying..." state. Confidence threshold flags ambiguous cases for judge review. | Burst of 10+ PRs simultaneously could queue up. Concurrency=5 mitigates. |
| Large PR diffs exceeding Claude context | Medium | Truncate diffs to 100KB. Skip generated/lock files. Focus on changed files only. | Very large PRs may lose classification accuracy at boundaries. |
| Duplicate detection false positives | Medium | LLM comparison + manual judge override as safety net. `duplicate_marked_by` tracks who flagged it. | Judges must review flagged duplicates. |
| SSE connection drops (kiosk) | Low | DOM Event Bridge has built-in reconnect. Kiosk page can also poll leaderboard API as fallback. | Brief visual stale data between reconnects. |
| Participant entity migration risk | Low | Simple nullable column addition. Non-breaking. Existing data unaffected. | None. |
| Tight timeline (6 days) | High | Phased plan with core pipeline (Phase 1–2) prioritized. Kiosk animations are nice-to-have. Phase 5 testing can be compressed if needed. | Kiosk polish may be cut. |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-04 | Initial spec — skeleton with open questions |
| 2026-04-04 | Full spec after Q1–Q5 answers: scheduler cron, FK IDs + enrichers, Participant entity extension, UUIDs, portal kiosk |
