# Bounty Hunting Track — Development Progress

**Spec**: `.ai/specs/SPEC-004-2026-04-04-bounty-hunting-track.md`
**Branch**: `feat/bounty-hounting`
**Started**: 2026-04-04

---

## Phase 1: Foundation -- DONE

- [x] 1.1 Register `bounties` module in `src/modules.ts`
- [x] 1.2 Create entities (`BountyPullRequest`, `BountyActivityLog`) in `data/entities.ts`
- [x] 1.3 Add `githubUsername` to `CompetitionParticipation` entity
- [x] 1.4 Run `yarn db:generate` → review migration → `yarn db:migrate`
- [x] 1.5 Create module boilerplate (`index.ts`, `acl.ts`, `setup.ts`, `di.ts`, `events.ts`)
- [x] 1.6 Install dependencies (`ai`, `@ai-sdk/anthropic`, `octokit`)
- [x] 1.7 Create Zod validators in `data/validators.ts`
- [x] 1.8 Run `yarn generate`

## Phase 2: Core Pipeline -- DONE

- [x] 2.1 Implement `GitHubService` (Octokit wrapper)
- [x] 2.2 Implement `poll-github` worker
- [x] 2.3 Implement `ClassificationService` (classify + duplicate detection)
- [x] 2.4 Implement `classify-pr` worker
- [x] 2.5 Implement `on-pr-detected` subscriber
- [x] 2.6 Implement `LeaderboardService`
- [x] 2.7 Build API routes (9 routes: list, approve, reject, classify, duplicate, points, leaderboard, activity, poll)
- [x] 2.8 Create response enrichers

## Phase 3: Judging Panel -- DONE

- [x] 3.1 Judge panel backend page with DataTable (BountyJudgingPanel)
- [x] 3.2 PR detail panel with classification display (BountyDetailPanel)
- [x] 3.3 Action forms (approve/reject/adjust points with reason)
- [x] 3.4 Activity feed with `useAppEvent('bounties.*')` (BountyActivityFeed)
- [x] 3.5 Manual refresh button (triggers poll API)
- [x] 3.6 Sidebar menu injection widget (BountyMenuItem + injection-table)

## Phase 4: Leaderboard & Portal -- DONE

- [x] 4.1 In-app leaderboard backend page (BountyLeaderboard component)
- [x] 4.2 Kiosk portal page (dark theme, large fonts, auto-refresh, rank animations)
- [x] 4.3 GitHub username field on portal profile page
- [x] 4.4 Notification type definitions (pr_approved, pr_rejected, pr_detected)
- [x] 4.5 Search configuration (title, description, github_author searchable)

## Phase 5: Testing & Hardening -- DONE

- [ ] 5.1 End-to-end flow test (manual — requires running app + GitHub PRs)
- [x] 5.2 `yarn build` verification — PASSING

## Post-Phase: Portal & Config (added from user feedback)

- [x] 6.1 Bounty track config via `ModuleConfigService` (stored per-tenant)
- [x] 6.2 Config API endpoint (`GET/PUT /api/bounties/config`)
- [x] 6.3 Backend settings page with track dropdown (`/backend/bounties/settings`)
- [x] 6.4 GitHub username field added to profile edit page + API
- [x] 6.5 Portal leaderboard page (`/{orgSlug}/portal/bounties/leaderboard`)
- [x] 6.6 Portal "My Bounty PRs" page (`/{orgSlug}/portal/bounties/my-prs`) — only shows if on bounty track
- [x] 6.7 Portal sidebar menu injection (leaderboard + my PRs links)
- [x] 6.8 Judging panel edit: tracks filtered by competition_id
- [x] 6.9 `yarn build` — PASSING
