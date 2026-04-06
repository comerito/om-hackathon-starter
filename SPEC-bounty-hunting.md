# SPEC: Bounty Hunting Track — HackOn App

**Version:** 1.0
**Date:** 2026-04-04
**Author:** Patryk Lewczuk / Claude
**Status:** Draft
**Deadline:** April 10, 2026

---

## 1. Overview

The Bounty Hunting track rewards hackathon participants for meaningful open-source contributions to the Open Mercato monorepo. Participants submit GitHub Pull Requests labeled `bounty-hunting`. An automated pipeline polls the GitHub API, classifies each PR using Claude (via Vercel AI SDK), detects duplicates via LLM semantic comparison, and calculates points. Judges (assigned to the track) approve or reject PRs via a dedicated judging panel. A real-time leaderboard displays individual and team scores both in-app and on a projected kiosk screen.

### 1.1 Point Tiers

| Category                  | Points |
|---------------------------|--------|
| Critical bug fix          | 10     |
| Regular bug fix           | 5      |
| New / improved test       | 3      |
| Documentation improvement | 2      |
| Minor fix                 | 1      |

A single PR can earn points from **multiple categories** (e.g., bug fix + test = 5 + 3 = 8 points).

### 1.2 Core Flow

```
GitHub PR (label: bounty-hunting)
  → Polling Service detects PR
  → Match PR author to registered participant (skip if unregistered)
  → LLM Classification (categories + confidence)
  → LLM Duplicate Detection (semantic diff comparison)
  → PR appears in Judging Panel (status: pending_review)
  → Judge approves (adds `approved` label) or rejects (`rejected` label)
  → Points calculated for approved, non-duplicate PRs
  → Leaderboard updates in real-time
```

---

## 2. Tech Stack & Dependencies

### 2.1 Existing Stack (HackOn App)

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict)
- **ORM:** MikroORM
- **DI:** Awilix
- **Validation:** zod
- **Database:** PostgreSQL (assumed from MikroORM setup)

### 2.2 New Dependencies

```json
{
  "ai": "^6.0.146",
  "@ai-sdk/anthropic": "^3.0.66",
  "octokit": "^4.1.2"
}
```

- **`ai`** — Vercel AI SDK core, provides `generateObject()` for structured LLM output with zod schema validation.
- **`@ai-sdk/anthropic`** — Anthropic provider for Vercel AI SDK, connects to Claude API.
- **`octokit`** — Official GitHub SDK for REST API (PR listing, label management, diff fetching).

### 2.3 Environment Variables

```env
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=ghp_...
GITHUB_REPO_OWNER=open-mercato
GITHUB_REPO_NAME=open-mercato
BOUNTY_POLL_INTERVAL_MS=30000
BOUNTY_LABEL=bounty-hunting
BOUNTY_APPROVED_LABEL=approved
BOUNTY_REJECTED_LABEL=rejected
```

---

## 3. Domain Model

### 3.1 Entity: BountyPullRequest

Represents a GitHub PR detected by the polling service.

```typescript
@Entity()
export class BountyPullRequest {
  @PrimaryKey()
  id!: number;

  @Property()
  githubPrId!: number;

  @Property()
  githubPrNumber!: number;

  @Property()
  githubPrUrl!: string;

  @Property({ type: 'text' })
  title!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'text', nullable: true })
  diffContent?: string;

  @Property()
  githubAuthor!: string;

  @ManyToOne(() => Participant, { nullable: true })
  participant?: Participant;

  @ManyToOne(() => Team, { nullable: true })
  team?: Team;

  @Enum(() => BountyPRStatus)
  status!: BountyPRStatus;

  @Property({ type: 'json', nullable: true })
  classifications?: BountyClassification[];

  @Property({ type: 'float', nullable: true })
  classificationConfidence?: number;

  @Property()
  totalPoints!: number;

  @Property({ type: 'json', nullable: true })
  pointsOverride?: BountyClassification[] | null;

  @Property()
  isDuplicate!: boolean;

  @ManyToOne(() => BountyPullRequest, { nullable: true })
  duplicateOf?: BountyPullRequest;

  @Property({ nullable: true })
  duplicateMarkedBy?: string; // 'llm' | 'judge'

  @Property()
  githubCreatedAt!: Date;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
```

### 3.2 Enum: BountyPRStatus

```typescript
export enum BountyPRStatus {
  DETECTED = 'detected',           // PR found by poller, not yet classified
  CLASSIFIED = 'classified',       // LLM classification complete
  PENDING_REVIEW = 'pending_review', // Awaiting judge approval
  APPROVED = 'approved',           // Judge approved, points counted
  REJECTED = 'rejected',           // Judge rejected
  DUPLICATE = 'duplicate',         // Marked as duplicate
}
```

### 3.3 Type: BountyClassification

```typescript
export interface BountyClassification {
  category: BountyCategory;
  points: number;
  reasoning: string;
}

export enum BountyCategory {
  CRITICAL_BUG_FIX = 'critical_bug_fix',
  REGULAR_BUG_FIX = 'regular_bug_fix',
  NEW_IMPROVED_TEST = 'new_improved_test',
  DOCUMENTATION_IMPROVEMENT = 'documentation_improvement',
  MINOR_FIX = 'minor_fix',
}

export const BOUNTY_POINTS: Record<BountyCategory, number> = {
  [BountyCategory.CRITICAL_BUG_FIX]: 10,
  [BountyCategory.REGULAR_BUG_FIX]: 5,
  [BountyCategory.NEW_IMPROVED_TEST]: 3,
  [BountyCategory.DOCUMENTATION_IMPROVEMENT]: 2,
  [BountyCategory.MINOR_FIX]: 1,
};
```

### 3.4 Entity: BountyActivityLog

Feeds the real-time activity feed on the judging panel.

```typescript
@Entity()
export class BountyActivityLog {
  @PrimaryKey()
  id!: number;

  @Enum(() => BountyActivityType)
  type!: BountyActivityType;

  @ManyToOne(() => BountyPullRequest)
  pullRequest!: BountyPullRequest;

  @Property({ type: 'text' })
  message!: string;

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @Property()
  createdAt: Date = new Date();
}

export enum BountyActivityType {
  PR_DETECTED = 'pr_detected',
  PR_CLASSIFIED = 'pr_classified',
  PR_APPROVED = 'pr_approved',
  PR_REJECTED = 'pr_rejected',
  PR_DUPLICATE = 'pr_duplicate',
  POINTS_ADJUSTED = 'points_adjusted',
  POINTS_REVOKED = 'points_revoked',
  CLASSIFICATION_OVERRIDDEN = 'classification_overridden',
  MANUAL_REFRESH = 'manual_refresh',
}
```

### 3.5 Participant Extension

Add `githubUsername` to the existing `Participant` entity:

```typescript
// Addition to existing Participant entity
@Property({ nullable: true, unique: true })
githubUsername?: string;
```

---

## 4. GitHub Polling Service

### 4.1 Overview

A server-side service that polls the GitHub API at a configurable interval (`BOUNTY_POLL_INTERVAL_MS`, default 30s) to discover new PRs with the `bounty-hunting` label. Also monitors label changes (`approved`, `rejected`) on known PRs.

### 4.2 Implementation

```typescript
// src/modules/bounty/services/GitHubPollingService.ts

import { Octokit } from 'octokit';

export class GitHubPollingService {
  private octokit: Octokit;
  private intervalId?: NodeJS.Timeout;

  constructor(
    private readonly config: BountyConfig,
    private readonly bountyPRRepo: BountyPullRequestRepository,
    private readonly classificationService: ClassificationService,
    private readonly participantRepo: ParticipantRepository,
    private readonly activityLogger: BountyActivityLogger,
  ) {
    this.octokit = new Octokit({ auth: config.githubToken });
  }

  async startPolling(): Promise<void> {
    await this.poll(); // Initial poll
    this.intervalId = setInterval(
      () => this.poll(),
      this.config.pollIntervalMs,
    );
  }

  stopPolling(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  async poll(): Promise<void> {
    // 1. Fetch all open PRs with bounty-hunting label
    const prs = await this.fetchBountyPRs();

    for (const pr of prs) {
      const existing = await this.bountyPRRepo.findByGithubPrId(pr.id);

      if (!existing) {
        await this.handleNewPR(pr);
      } else {
        await this.handleExistingPR(existing, pr);
      }
    }
  }

  async pollOnDemand(): Promise<void> {
    await this.poll();
    await this.activityLogger.log({
      type: BountyActivityType.MANUAL_REFRESH,
      message: 'Manual GitHub refresh triggered by judge',
    });
  }

  private async fetchBountyPRs() {
    const { data } = await this.octokit.rest.pulls.list({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      state: 'all',
      per_page: 100,
    });

    // Filter to only PRs with the bounty-hunting label
    return data.filter(pr =>
      pr.labels.some(label => label.name === this.config.bountyLabel)
    );
  }

  private async handleNewPR(pr: GitHubPR): Promise<void> {
    // 1. Match to registered participant
    const participant = await this.participantRepo.findByGithubUsername(
      pr.user.login
    );
    if (!participant) return; // Skip unregistered users

    // 2. Fetch the diff
    const diff = await this.fetchPRDiff(pr.number);

    // 3. Create BountyPullRequest entity
    const bountyPR = new BountyPullRequest();
    bountyPR.githubPrId = pr.id;
    bountyPR.githubPrNumber = pr.number;
    bountyPR.githubPrUrl = pr.html_url;
    bountyPR.title = pr.title;
    bountyPR.description = pr.body ?? undefined;
    bountyPR.diffContent = diff;
    bountyPR.githubAuthor = pr.user.login;
    bountyPR.participant = participant;
    bountyPR.team = participant.team;
    bountyPR.status = BountyPRStatus.DETECTED;
    bountyPR.totalPoints = 0;
    bountyPR.isDuplicate = false;
    bountyPR.githubCreatedAt = new Date(pr.created_at);

    await this.bountyPRRepo.persistAndFlush(bountyPR);

    await this.activityLogger.log({
      type: BountyActivityType.PR_DETECTED,
      pullRequest: bountyPR,
      message: `New PR #${pr.number} detected from @${pr.user.login}: "${pr.title}"`,
    });

    // 4. Trigger classification pipeline
    await this.classificationService.classifyAndDetectDuplicates(bountyPR);
  }

  private async handleExistingPR(
    existing: BountyPullRequest,
    pr: GitHubPR
  ): Promise<void> {
    const labels = pr.labels.map(l => l.name);
    const hasApproved = labels.includes(this.config.approvedLabel);
    const hasRejected = labels.includes(this.config.rejectedLabel);

    if (hasApproved && existing.status !== BountyPRStatus.APPROVED) {
      existing.status = BountyPRStatus.APPROVED;
      if (!existing.isDuplicate) {
        existing.totalPoints = this.calculatePoints(existing);
      }
      await this.bountyPRRepo.persistAndFlush(existing);
      await this.activityLogger.log({
        type: BountyActivityType.PR_APPROVED,
        pullRequest: existing,
        message: `PR #${existing.githubPrNumber} approved — ${existing.totalPoints} points awarded to @${existing.githubAuthor}`,
      });
    }

    if (hasRejected && existing.status !== BountyPRStatus.REJECTED) {
      existing.status = BountyPRStatus.REJECTED;
      existing.totalPoints = 0;
      await this.bountyPRRepo.persistAndFlush(existing);
      await this.activityLogger.log({
        type: BountyActivityType.PR_REJECTED,
        pullRequest: existing,
        message: `PR #${existing.githubPrNumber} rejected`,
      });
    }
  }

  private async fetchPRDiff(prNumber: number): Promise<string> {
    const { data } = await this.octokit.rest.pulls.get({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    });
    return data as unknown as string;
  }

  private calculatePoints(pr: BountyPullRequest): number {
    const classifications = pr.pointsOverride ?? pr.classifications ?? [];
    return classifications.reduce((sum, c) => sum + c.points, 0);
  }
}
```

### 4.3 Polling Lifecycle

The polling service starts when the HackOn App boots (or when the bounty hunting track is activated) and runs until stopped. It should be registered as a singleton in the Awilix container.

```typescript
// Awilix registration
container.register({
  githubPollingService: asClass(GitHubPollingService).singleton(),
});
```

---

## 5. LLM Classification Pipeline

### 5.1 Zod Schemas

```typescript
// src/modules/bounty/schemas/classification.schema.ts

import { z } from 'zod';

export const BountyCategorySchema = z.enum([
  'critical_bug_fix',
  'regular_bug_fix',
  'new_improved_test',
  'documentation_improvement',
  'minor_fix',
]);

export const ClassificationResultSchema = z.object({
  classifications: z.array(
    z.object({
      category: BountyCategorySchema,
      reasoning: z.string().describe(
        'Brief explanation of why this category was assigned'
      ),
    })
  ).describe('One or more categories this PR falls into. A single PR can match multiple categories.'),
  confidence: z.number().min(0).max(1).describe(
    'Overall confidence in the classification (0.0 to 1.0). Below 0.7 flags for judge review.'
  ),
  summary: z.string().describe(
    'One-sentence summary of what this PR does'
  ),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
```

### 5.2 Duplicate Detection Schema

```typescript
// src/modules/bounty/schemas/duplicate.schema.ts

import { z } from 'zod';

export const DuplicateCheckResultSchema = z.object({
  isDuplicate: z.boolean().describe(
    'Whether this PR resolves the same problem as an existing PR'
  ),
  duplicateOfPrNumber: z.number().nullable().describe(
    'The PR number this is a duplicate of, or null if not a duplicate'
  ),
  similarity: z.number().min(0).max(1).describe(
    'Semantic similarity score (0.0 = unrelated, 1.0 = identical fix)'
  ),
  reasoning: z.string().describe(
    'Explanation of why this is or is not a duplicate'
  ),
});

export type DuplicateCheckResult = z.infer<typeof DuplicateCheckResultSchema>;
```

### 5.3 Classification Service

```typescript
// src/modules/bounty/services/ClassificationService.ts

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import {
  ClassificationResultSchema,
  DuplicateCheckResultSchema,
} from '../schemas';

export class ClassificationService {
  constructor(
    private readonly bountyPRRepo: BountyPullRequestRepository,
    private readonly activityLogger: BountyActivityLogger,
  ) {}

  async classifyAndDetectDuplicates(pr: BountyPullRequest): Promise<void> {
    // Step 1: Classify
    const classification = await this.classify(pr);

    pr.classifications = classification.classifications.map(c => ({
      category: c.category as BountyCategory,
      points: BOUNTY_POINTS[c.category as BountyCategory],
      reasoning: c.reasoning,
    }));
    pr.classificationConfidence = classification.confidence;
    pr.status = BountyPRStatus.CLASSIFIED;

    await this.activityLogger.log({
      type: BountyActivityType.PR_CLASSIFIED,
      pullRequest: pr,
      message: `PR #${pr.githubPrNumber} classified: ${classification.classifications.map(c => c.category).join(', ')} (confidence: ${(classification.confidence * 100).toFixed(0)}%)`,
      metadata: { classification },
    });

    // Step 2: Duplicate detection
    await this.detectDuplicates(pr);

    // Step 3: Set final status
    if (!pr.isDuplicate) {
      pr.status = BountyPRStatus.PENDING_REVIEW;
    }

    await this.bountyPRRepo.persistAndFlush(pr);
  }

  private async classify(pr: BountyPullRequest): Promise<ClassificationResult> {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: ClassificationResultSchema,
      prompt: this.buildClassificationPrompt(pr),
    });

    return object;
  }

  private buildClassificationPrompt(pr: BountyPullRequest): string {
    return `You are a code review classifier for a hackathon bounty hunting track.

Analyze the following Pull Request and classify it into one or more categories.
A single PR can belong to multiple categories if it addresses multiple concerns.

## Categories and Criteria

- **critical_bug_fix** (10 pts): Fixes a bug that causes crashes, data loss, security vulnerabilities, or breaks core functionality. The fix is non-trivial and addresses a significant issue.
- **regular_bug_fix** (5 pts): Fixes a bug that causes incorrect behavior, UI glitches, or edge case failures. The fix is meaningful but not critical.
- **new_improved_test** (3 pts): Adds new test cases or significantly improves existing tests. Must add real coverage, not trivial/obvious tests.
- **documentation_improvement** (2 pts): Improves README, JSDoc, inline comments, or other documentation. Must be substantive (not just typo fixes in comments).
- **minor_fix** (1 pt): Small improvements like typo fixes, code formatting, minor refactoring, dependency updates, or trivial changes.

## PR Information

**Title:** ${pr.title}
**Description:** ${pr.description ?? 'No description provided.'}

## Code Diff (Primary Classification Factor)

\`\`\`diff
${pr.diffContent ?? 'No diff available.'}
\`\`\`

Classify based primarily on the code diff. The title and description provide context but the actual code changes determine the category.
Set confidence below 0.7 if the classification is ambiguous between tiers.`;
  }

  private async detectDuplicates(pr: BountyPullRequest): Promise<void> {
    // Fetch all existing non-duplicate, non-rejected PRs (excluding current)
    const existingPRs = await this.bountyPRRepo.findForDuplicateCheck(pr.id);

    if (existingPRs.length === 0) return;

    // Build summaries of existing PRs for comparison
    const existingSummaries = existingPRs.map(existing => ({
      prNumber: existing.githubPrNumber,
      title: existing.title,
      diffPreview: (existing.diffContent ?? '').substring(0, 2000),
      categories: existing.classifications?.map(c => c.category) ?? [],
      createdAt: existing.githubCreatedAt.toISOString(),
    }));

    const { object: result } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: DuplicateCheckResultSchema,
      prompt: this.buildDuplicatePrompt(pr, existingSummaries),
    });

    if (result.isDuplicate && result.duplicateOfPrNumber) {
      const originalPR = existingPRs.find(
        e => e.githubPrNumber === result.duplicateOfPrNumber
      );
      if (originalPR) {
        pr.isDuplicate = true;
        pr.duplicateOf = originalPR;
        pr.duplicateMarkedBy = 'llm';
        pr.status = BountyPRStatus.DUPLICATE;
        pr.totalPoints = 0;

        await this.activityLogger.log({
          type: BountyActivityType.PR_DUPLICATE,
          pullRequest: pr,
          message: `PR #${pr.githubPrNumber} marked as duplicate of PR #${originalPR.githubPrNumber} (similarity: ${(result.similarity * 100).toFixed(0)}%)`,
          metadata: { duplicateCheck: result },
        });
      }
    }
  }

  private buildDuplicatePrompt(
    pr: BountyPullRequest,
    existingPRs: Array<{
      prNumber: number;
      title: string;
      diffPreview: string;
      categories: string[];
      createdAt: string;
    }>
  ): string {
    return `You are a duplicate detection system for hackathon PR submissions.

Determine if the NEW PR below resolves the same problem as any of the EXISTING PRs.
Two PRs are duplicates if they fix the same underlying issue, even if their implementations differ.

## New PR

**#${pr.githubPrNumber}: ${pr.title}**

\`\`\`diff
${(pr.diffContent ?? '').substring(0, 3000)}
\`\`\`

## Existing PRs

${existingPRs.map(e => `### PR #${e.prNumber}: ${e.title}
Categories: ${e.categories.join(', ')}
Submitted: ${e.createdAt}
\`\`\`diff
${e.diffPreview}
\`\`\``).join('\n\n')}

If this is a duplicate, reference the EARLIEST submitted PR that addresses the same problem.
Only mark as duplicate if the PRs clearly resolve the same specific issue — not merely touching similar files or areas.`;
  }
}
```

---

## 6. API Endpoints

### 6.1 Bounty PR Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/bounty/prs` | List all bounty PRs (filterable by status) | Judge |
| GET | `/api/bounty/prs/:id` | Get single bounty PR with full details | Judge |
| PATCH | `/api/bounty/prs/:id/classify` | Override LLM classification | Judge |
| PATCH | `/api/bounty/prs/:id/approve` | Approve PR (adds GitHub label) | Judge |
| PATCH | `/api/bounty/prs/:id/reject` | Reject PR (adds GitHub label) | Judge |
| PATCH | `/api/bounty/prs/:id/duplicate` | Manually mark as duplicate | Judge |
| PATCH | `/api/bounty/prs/:id/points` | Adjust/revoke points | Judge |

### 6.2 Leaderboard Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/bounty/leaderboard` | Team leaderboard with individual breakdowns | Public |
| GET | `/api/bounty/leaderboard/kiosk` | Kiosk-optimized leaderboard (no auth, large format) | Public |

### 6.3 Activity & Control Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/bounty/activity` | Activity feed (supports SSE for real-time) | Judge |
| POST | `/api/bounty/poll` | Trigger on-demand GitHub poll | Judge |

### 6.4 Participant Registration

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| PATCH | `/api/participants/:id/github` | Register GitHub username | Participant |

### 6.5 Request/Response Schemas

```typescript
// Override classification
const OverrideClassificationSchema = z.object({
  classifications: z.array(z.object({
    category: BountyCategorySchema,
    reasoning: z.string(),
  })),
});

// Adjust points
const AdjustPointsSchema = z.object({
  totalPoints: z.number().min(0),
  reason: z.string(),
});

// Mark duplicate
const MarkDuplicateSchema = z.object({
  duplicateOfId: z.number(),
  reason: z.string().optional(),
});

// Leaderboard response
const LeaderboardResponseSchema = z.object({
  teams: z.array(z.object({
    teamId: z.number(),
    teamName: z.string(),
    totalPoints: z.number(),
    rank: z.number(),
    members: z.array(z.object({
      participantId: z.number(),
      name: z.string(),
      githubUsername: z.string(),
      points: z.number(),
      prCount: z.number(),
    })),
  })),
  lastUpdated: z.string().datetime(),
});
```

---

## 7. Leaderboard Calculation

### 7.1 Service

```typescript
// src/modules/bounty/services/LeaderboardService.ts

export class LeaderboardService {
  constructor(
    private readonly bountyPRRepo: BountyPullRequestRepository,
  ) {}

  async getLeaderboard(): Promise<LeaderboardData> {
    // Only count PRs that are APPROVED and NOT DUPLICATE
    const approvedPRs = await this.bountyPRRepo.find({
      status: BountyPRStatus.APPROVED,
      isDuplicate: false,
    }, {
      populate: ['participant', 'participant.team'],
    });

    // Group by team
    const teamMap = new Map<number, TeamScore>();

    for (const pr of approvedPRs) {
      if (!pr.participant?.team) continue;

      const teamId = pr.team!.id;
      if (!teamMap.has(teamId)) {
        teamMap.set(teamId, {
          teamId,
          teamName: pr.team!.name,
          totalPoints: 0,
          members: new Map(),
        });
      }

      const team = teamMap.get(teamId)!;
      const memberId = pr.participant.id;

      if (!team.members.has(memberId)) {
        team.members.set(memberId, {
          participantId: memberId,
          name: pr.participant.name,
          githubUsername: pr.participant.githubUsername!,
          points: 0,
          prCount: 0,
        });
      }

      const member = team.members.get(memberId)!;
      member.points += pr.totalPoints;
      member.prCount += 1;
      team.totalPoints += pr.totalPoints;
    }

    // Sort teams by total points descending
    const teams = Array.from(teamMap.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((team, index) => ({
        ...team,
        rank: index + 1,
        members: Array.from(team.members.values())
          .sort((a, b) => b.points - a.points),
      }));

    return { teams, lastUpdated: new Date().toISOString() };
  }
}
```

---

## 8. Real-Time Updates

### 8.1 Strategy: Server-Sent Events (SSE)

Use SSE for pushing real-time updates to both the judging panel and leaderboard UIs. This avoids the complexity of WebSocket setup while providing true real-time push.

### 8.2 SSE Endpoint

```typescript
// src/app/api/bounty/events/route.ts

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Subscribe to bounty events
      const unsubscribe = bountyEventBus.subscribe((event) => {
        switch (event.type) {
          case 'pr_detected':
          case 'pr_classified':
          case 'pr_approved':
          case 'pr_rejected':
          case 'pr_duplicate':
            send('activity', event);
            break;
          case 'leaderboard_updated':
            send('leaderboard', event.data);
            break;
        }
      });

      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

### 8.3 Event Bus

```typescript
// src/modules/bounty/services/BountyEventBus.ts

type BountyEventHandler = (event: BountyEvent) => void;

export class BountyEventBus {
  private handlers: Set<BountyEventHandler> = new Set();

  subscribe(handler: BountyEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(event: BountyEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
```

### 8.4 Client-Side Hook

```typescript
// src/hooks/useBountyEvents.ts

export function useBountyEvents(onEvent: (event: BountyEvent) => void) {
  useEffect(() => {
    const eventSource = new EventSource('/api/bounty/events');

    eventSource.addEventListener('activity', (e) => {
      onEvent(JSON.parse(e.data));
    });

    eventSource.addEventListener('leaderboard', (e) => {
      onEvent({ type: 'leaderboard_updated', data: JSON.parse(e.data) });
    });

    return () => eventSource.close();
  }, [onEvent]);
}
```

---

## 9. Judging Panel UI

### 9.1 Route

```
/dashboard/tracks/bounty-hunting/judge
```

Access: Judges assigned to the Bounty Hunting track (existing auth/role system).

### 9.2 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  BOUNTY HUNTING — Judging Panel                    [🔄 Refresh] │
├──────────────────────────┬───────────────────────────────────────┤
│                          │                                       │
│   PR List (filterable)   │   PR Detail Panel                     │
│                          │                                       │
│   Status filter:         │   PR #42: Fix checkout race condition │
│   [All][Pending][Approved│   Author: @john-doe (Team Alpha)      │
│    ][Rejected][Duplicate] │   Status: ● Classified                │
│                          │   Confidence: 85%                     │
│   ┌────────────────────┐ │                                       │
│   │ PR #42 ● Classified│ │   LLM Classification:                │
│   │ @john-doe — 8 pts  │ │   ☑ Regular bug fix (5 pts)          │
│   ├────────────────────┤ │   ☑ New test (3 pts)                 │
│   │ PR #38 ✓ Approved  │ │   Total: 8 pts                       │
│   │ @jane — 10 pts     │ │                                       │
│   ├────────────────────┤ │   Reasoning: "Fixes race condition   │
│   │ PR #35 ✕ Duplicate │ │    in checkout flow + adds test..."  │
│   │ @bob — 0 pts       │ │                                       │
│   └────────────────────┘ │   Actions:                            │
│                          │   [✓ Approve] [✕ Reject]              │
│                          │   [Override Tier ▼] [Mark Duplicate]  │
│                          │   [Adjust Points: ___]                │
│                          │                                       │
├──────────────────────────┴───────────────────────────────────────┤
│  Activity Feed (real-time)                                       │
│  12:34:21  New PR #42 detected from @john-doe: "Fix checkout..." │
│  12:34:23  PR #42 classified: regular_bug_fix, new_test (85%)    │
│  12:33:01  PR #38 approved — 10 points awarded to @jane          │
└──────────────────────────────────────────────────────────────────┘
```

### 9.3 Key Interactions

- **Approve/Reject:** Calls PATCH endpoint → adds GitHub label via Octokit → updates status → recalculates leaderboard → emits SSE event.
- **Override Tier:** Dropdown to change classification categories, recalculates points.
- **Mark Duplicate:** Select which existing PR it duplicates, zeroes points.
- **Adjust Points:** Manual number input with reason (logged in activity feed).
- **Refresh:** Triggers POST `/api/bounty/poll` for on-demand GitHub fetch.
- **Confidence indicator:** PRs with confidence < 0.7 are visually flagged (e.g., amber badge) to prompt judge review.

---

## 10. Leaderboard UI

### 10.1 In-App Leaderboard

**Route:** `/dashboard/tracks/bounty-hunting/leaderboard`

Visible to teams on the Bounty Hunting track. Shows team ranking with expandable individual scores. Updates in real-time via SSE.

```
┌─────────────────────────────────────────────┐
│  🏆 Bounty Hunting Leaderboard              │
│                                             │
│  #1  Team Alpha ··················· 23 pts  │
│      @jane (10)  @john-doe (8)  @ali (5)    │
│                                             │
│  #2  Team Beta ···················· 18 pts  │
│      @sarah (10)  @mike (5)  @lee (3)       │
│                                             │
│  #3  Team Gamma ··················· 12 pts  │
│      @bob (7)  @ann (5)                     │
│                                             │
│  Last updated: 12:35:01                     │
└─────────────────────────────────────────────┘
```

### 10.2 Kiosk Screen

**Route:** `/kiosk/bounty-hunting`

Full-screen, no-auth, projection-optimized. Large fonts, high contrast, auto-refreshing. Minimal UI — just the leaderboard with team names, total points, and rank.

Design considerations:

- Dark background, high-contrast colors
- Large font sizes (team names ~48px, points ~64px)
- Animated rank changes (position swap animation)
- Auto-scroll if more teams than fit on screen
- HackOn branding in corner
- No navigation or interactive elements

---

## 11. Awilix DI Registration

```typescript
// src/modules/bounty/container.ts

import { asClass, asValue } from 'awilix';

export function registerBountyModule(container: AwilixContainer) {
  container.register({
    // Config
    bountyConfig: asValue({
      githubToken: process.env.GITHUB_TOKEN,
      repoOwner: process.env.GITHUB_REPO_OWNER,
      repoName: process.env.GITHUB_REPO_NAME,
      pollIntervalMs: parseInt(process.env.BOUNTY_POLL_INTERVAL_MS ?? '30000'),
      bountyLabel: process.env.BOUNTY_LABEL ?? 'bounty-hunting',
      approvedLabel: process.env.BOUNTY_APPROVED_LABEL ?? 'approved',
      rejectedLabel: process.env.BOUNTY_REJECTED_LABEL ?? 'rejected',
    }),

    // Services
    githubPollingService: asClass(GitHubPollingService).singleton(),
    classificationService: asClass(ClassificationService).scoped(),
    leaderboardService: asClass(LeaderboardService).scoped(),
    bountyActivityLogger: asClass(BountyActivityLogger).scoped(),
    bountyEventBus: asClass(BountyEventBus).singleton(),

    // Repositories
    bountyPRRepo: asClass(BountyPullRequestRepository).scoped(),
  });
}
```

---

## 12. Database Migrations

Two new tables required:

```sql
-- Migration: create_bounty_pull_requests
CREATE TABLE bounty_pull_requests (
  id SERIAL PRIMARY KEY,
  github_pr_id INTEGER NOT NULL UNIQUE,
  github_pr_number INTEGER NOT NULL,
  github_pr_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  diff_content TEXT,
  github_author VARCHAR(255) NOT NULL,
  participant_id INTEGER REFERENCES participants(id),
  team_id INTEGER REFERENCES teams(id),
  status VARCHAR(50) NOT NULL DEFAULT 'detected',
  classifications JSONB,
  classification_confidence FLOAT,
  total_points INTEGER NOT NULL DEFAULT 0,
  points_override JSONB,
  is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_of_id INTEGER REFERENCES bounty_pull_requests(id),
  duplicate_marked_by VARCHAR(50),
  github_created_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bounty_pr_status ON bounty_pull_requests(status);
CREATE INDEX idx_bounty_pr_github_author ON bounty_pull_requests(github_author);
CREATE INDEX idx_bounty_pr_team_id ON bounty_pull_requests(team_id);

-- Migration: create_bounty_activity_logs
CREATE TABLE bounty_activity_logs (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  pull_request_id INTEGER REFERENCES bounty_pull_requests(id),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bounty_activity_created ON bounty_activity_logs(created_at DESC);

-- Migration: add_github_username_to_participants
ALTER TABLE participants
  ADD COLUMN github_username VARCHAR(255) UNIQUE;
```

---

## 13. Implementation Plan

### Phase 1: Foundation (Day 1–2, Apr 4–5)

- [ ] Add `githubUsername` field to Participant entity + migration
- [ ] Create `BountyPullRequest` entity + migration
- [ ] Create `BountyActivityLog` entity + migration
- [ ] Install dependencies (`ai`, `@ai-sdk/anthropic`, `octokit`)
- [ ] Set up environment variables
- [ ] Implement GitHub username registration (PATCH endpoint + UI field)
- [ ] Register Awilix bounty module

### Phase 2: Core Pipeline (Day 3–4, Apr 6–7)

- [ ] Implement `GitHubPollingService` (fetch PRs, detect labels)
- [ ] Implement `ClassificationService` (classify + duplicate detection)
- [ ] Implement `BountyActivityLogger`
- [ ] Implement `LeaderboardService`
- [ ] Build API endpoints (CRUD, approve/reject, override, adjust)
- [ ] Write zod request/response schemas for all endpoints

### Phase 3: Judging Panel (Day 4–5, Apr 7–8)

- [ ] Build judging panel page layout
- [ ] PR list with status filters
- [ ] PR detail panel with classification display
- [ ] Approve/reject/override/duplicate/adjust actions
- [ ] Manual refresh button
- [ ] Integrate SSE for real-time activity feed

### Phase 4: Leaderboard & Polish (Day 5–6, Apr 8–9)

- [ ] Build in-app leaderboard page
- [ ] Build kiosk leaderboard screen
- [ ] SSE integration for real-time leaderboard updates
- [ ] BountyEventBus wiring
- [ ] Animated rank changes on kiosk
- [ ] Low-confidence visual indicators

### Phase 5: Testing & Hardening (Day 6, Apr 9)

- [ ] End-to-end test: create PR → detect → classify → approve → leaderboard
- [ ] Test duplicate detection with similar PRs
- [ ] Test judge override flows
- [ ] Test point revocation
- [ ] Load test polling interval
- [ ] Verify GitHub label sync (approve/reject from panel)
- [ ] Kiosk display on projector hardware

### Buffer: Apr 10 (Event Day)

- Final smoke test
- Polling service activated
- Kiosk screen deployed to projector

---

## 14. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| GitHub API rate limiting (5,000 req/hr authenticated) | 30s poll interval = ~120 req/hr max. Well within limits. Cache diffs. |
| LLM classification latency | Classify async after detection. UI shows "classifying..." state. |
| Large PR diffs exceeding Claude context | Truncate diffs to 100KB. Focus on changed files only (skip lock files, generated code). |
| Duplicate detection accuracy | LLM comparison + manual judge override as safety net. |
| SSE connection drops | Client-side auto-reconnect with EventSource. Fallback: manual refresh. |
| Tight timeline (6 days) | Phased plan with core pipeline prioritized. Kiosk animations are nice-to-have. |
