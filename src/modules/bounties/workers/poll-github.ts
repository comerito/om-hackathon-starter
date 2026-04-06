import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../data/entities'
import { GitHubService } from '../services/GitHubService'
import type { GitHubPR } from '../services/GitHubService'
import { CompetitionParticipation, Competition } from '../../competitions/data/entities'

const LOG_PREFIX = '[bounties:poll-github]'
const BOUNTY_TRACK_MAPPINGS_KEY = 'bounty_track_mappings'

export const metadata = {
  queue: 'bounties-queue',
  id: 'poll-github',
  concurrency: 1,
}

export default async function handler(
  job: { data: Record<string, unknown> },
  ctx: { resolve: <T = any>(name: string) => T }
) {
  console.log(LOG_PREFIX, 'Worker started. Job data:', JSON.stringify(job.data))

  const em = ctx.resolve<EntityManager>('em')
  const eventBus = ctx.resolve<{ emit: (id: string, payload: Record<string, unknown>) => Promise<void> }>('eventBus')
  const configService = ctx.resolve<ModuleConfigService>('moduleConfigService')

  // Resolve tenantId/organizationId from job data (may be nested under `data` depending on scheduler dispatch)
  const jobData = (job.data?.data as Record<string, unknown>) ?? job.data ?? {}
  const tenantId = (jobData.tenantId ?? job.data?.tenantId) as string | undefined
  const organizationId = (jobData.organizationId ?? job.data?.organizationId) as string | undefined

  console.log(LOG_PREFIX, `Resolved scope: tenantId=${tenantId}, organizationId=${organizationId}`)

  if (!tenantId) {
    console.warn(LOG_PREFIX, 'No tenantId in job data — cannot poll. Full job:', JSON.stringify(job))
    return
  }

  // Load bounty track mappings to know which competitions have bounty tracks
  const mappings = await configService.getValue<Record<string, string>>('bounties', BOUNTY_TRACK_MAPPINGS_KEY, { defaultValue: {} })
  const competitionIds = Object.keys(mappings ?? {})
  console.log(LOG_PREFIX, `Bounty track mappings: ${JSON.stringify(mappings)} (${competitionIds.length} competitions)`)

  if (competitionIds.length === 0) {
    console.log(LOG_PREFIX, 'No bounty track mappings configured — nothing to poll')
    return
  }

  // Load competition date ranges to filter PRs
  const competitions = await em.find(Competition, {
    id: { $in: competitionIds },
    deletedAt: null,
  } as FilterQuery<Competition>)

  // Determine the widest date window across all bounty competitions
  let earliestStart: Date | undefined
  let latestEnd: Date | undefined
  const competitionDateMap = new Map<string, { startsAt: Date; endsAt: Date }>()

  for (const comp of competitions) {
    competitionDateMap.set(comp.id, { startsAt: comp.startsAt, endsAt: comp.endsAt })
    if (!earliestStart || comp.startsAt < earliestStart) earliestStart = comp.startsAt
    if (!latestEnd || comp.endsAt > latestEnd) latestEnd = comp.endsAt
  }

  console.log(LOG_PREFIX, `Competition date window: ${earliestStart?.toISOString()} — ${latestEnd?.toISOString()}`)

  // Check GitHub config
  const github = new GitHubService()
  console.log(LOG_PREFIX, `GitHub config: owner=${process.env.GITHUB_REPO_OWNER}, repo=${process.env.GITHUB_REPO_NAME}, label=${process.env.BOUNTY_LABEL ?? 'bounty-hunting'}, token=${process.env.GITHUB_TOKEN ? 'SET' : 'NOT SET'}`)

  let prs: GitHubPR[]
  try {
    prs = await github.fetchBountyPRs({
      since: earliestStart,
      until: latestEnd,
    })
    console.log(LOG_PREFIX, `Fetched ${prs.length} PRs from GitHub within competition date range`)
  } catch (err) {
    console.error(LOG_PREFIX, 'Failed to fetch PRs from GitHub:', err)
    return
  }

  if (prs.length === 0) {
    console.log(LOG_PREFIX, 'No PRs found with bounty-hunting label in date range')
  }

  let newPrCount = 0

  for (const pr of prs) {
    console.log(LOG_PREFIX, `Processing PR #${pr.number} by @${pr.user.login}: "${pr.title}"`)

    // Check if already tracked
    const existing = await em.findOne(BountyPullRequest, {
      githubPrId: String(pr.id),
      tenantId,
    } as FilterQuery<BountyPullRequest>)

    if (existing) {
      console.log(LOG_PREFIX, `  PR #${pr.number} already tracked (id=${existing.id}, status=${existing.status})`)

      // If stuck in 'detected' status, retry classification
      if (existing.status === BountyPRStatus.DETECTED) {
        console.log(LOG_PREFIX, `  PR #${pr.number} stuck in detected — triggering classification`)
        try {
          const { ClassificationService } = await import('../services/ClassificationService')
          const classifier = new ClassificationService()
          await classifier.classifyAndDetectDuplicates(em, existing)
          console.log(LOG_PREFIX, `  PR #${pr.number} classified: status=${existing.status}, points=${existing.totalPoints}`)
        } catch (err) {
          console.error(LOG_PREFIX, `  Classification failed for PR #${pr.number}:`, err)
        }
      }

      await handleExistingPR(em, eventBus, github, existing, pr)
      continue
    }

    // New PR — try to match to a participant across all bounty competitions
    const prCreatedAt = new Date(pr.created_at)
    let matched = false
    for (const competitionId of competitionIds) {
      // Check if PR falls within this competition's date range
      const compDates = competitionDateMap.get(competitionId)
      if (compDates && (prCreatedAt < compDates.startsAt || prCreatedAt > compDates.endsAt)) {
        console.log(LOG_PREFIX, `  PR #${pr.number} outside date range for competition ${competitionId} (${compDates.startsAt.toISOString()} — ${compDates.endsAt.toISOString()})`)
        continue
      }

      const participant = await em.findOne(CompetitionParticipation, {
        githubUsername: pr.user.login,
        competitionId,
        tenantId,
        deletedAt: null,
      } as FilterQuery<CompetitionParticipation>)

      if (!participant) {
        console.log(LOG_PREFIX, `  No participant match for @${pr.user.login} in competition ${competitionId}`)
        continue
      }

      console.log(LOG_PREFIX, `  Matched @${pr.user.login} to participant ${participant.id} in competition ${competitionId}`)

      // Resolve team membership
      const teamMember = await em.getConnection().execute(
        `SELECT team_id FROM teams_team_member WHERE customer_user_id = ? AND competition_id = ? AND tenant_id = ? AND deleted_at IS NULL LIMIT 1`,
        [participant.customerUserId, competitionId, tenantId]
      )
      const teamId = teamMember?.[0]?.team_id ?? null
      console.log(LOG_PREFIX, `  Team: ${teamId ?? 'none'}`)

      // Fetch diff
      let diff: string
      try {
        diff = await github.fetchPRDiff(pr.number)
        console.log(LOG_PREFIX, `  Diff fetched: ${diff.length} chars`)
      } catch (err) {
        console.error(LOG_PREFIX, `  Failed to fetch diff for PR #${pr.number}:`, err)
        diff = ''
      }

      const bountyPR = em.create(BountyPullRequest, {
        tenantId,
        organizationId: organizationId ?? '',
        competitionId,
        githubPrId: String(pr.id),
        githubPrNumber: pr.number,
        githubPrUrl: pr.html_url,
        title: pr.title,
        description: pr.body,
        diffContent: diff,
        githubAuthor: pr.user.login,
        participantId: participant.id,
        teamId,
        status: BountyPRStatus.DETECTED,
        totalPoints: 0,
        isDuplicate: false,
        githubCreatedAt: new Date(pr.created_at),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const activity = em.create(BountyActivityLog, {
        tenantId,
        organizationId: organizationId ?? '',
        type: BountyActivityType.PR_DETECTED,
        pullRequestId: bountyPR.id,
        message: `New PR #${pr.number} detected from @${pr.user.login}: "${pr.title}"`,
        createdAt: new Date(),
      })

      em.persist([bountyPR, activity])
      await em.flush()
      console.log(LOG_PREFIX, `  Created BountyPullRequest ${bountyPR.id} for PR #${pr.number}`)

      await eventBus.emit('bounties.pull_request.detected', {
        pullRequestId: bountyPR.id,
        tenantId,
        organizationId: organizationId ?? '',
        competitionId,
      })

      newPrCount++
      matched = true
      break // Only create one record per PR (first matching competition)
    }

    if (!matched) {
      console.log(LOG_PREFIX, `  PR #${pr.number} by @${pr.user.login} — no matching participant in any bounty competition`)
    }
  }

  console.log(LOG_PREFIX, `Poll complete. ${newPrCount} new PRs detected out of ${prs.length} total.`)

  await eventBus.emit('bounties.poll.completed', {
    tenantId,
    organizationId: organizationId ?? '',
    newPrCount,
  })
}

async function handleExistingPR(
  em: EntityManager,
  eventBus: { emit: (id: string, payload: Record<string, unknown>) => Promise<void> },
  github: GitHubService,
  existing: BountyPullRequest,
  pr: GitHubPR
): Promise<void> {
  const labels = pr.labels.map(l => l.name)
  const hasApproved = labels.includes(github.approvedLabel)
  const hasRejected = labels.includes(github.rejectedLabel)

  if (hasApproved && existing.status !== BountyPRStatus.APPROVED) {
    console.log(LOG_PREFIX, `  PR #${existing.githubPrNumber} has approved label — updating status`)
    existing.status = BountyPRStatus.APPROVED
    if (!existing.isDuplicate) {
      const classifications = existing.pointsOverride ?? existing.classifications ?? []
      existing.totalPoints = classifications.reduce((sum, c) => sum + c.points, 0)
    }

    const activity = em.create(BountyActivityLog, {
      tenantId: existing.tenantId,
      organizationId: existing.organizationId,
      type: BountyActivityType.PR_APPROVED,
      pullRequestId: existing.id,
      message: `PR #${existing.githubPrNumber} approved — ${existing.totalPoints} points awarded to @${existing.githubAuthor}`,
      createdAt: new Date(),
    })

    em.persist([existing, activity])
    await em.flush()

    await eventBus.emit('bounties.pull_request.approved', {
      pullRequestId: existing.id,
      tenantId: existing.tenantId,
      organizationId: existing.organizationId,
      totalPoints: existing.totalPoints,
    })
  }

  if (hasRejected && existing.status !== BountyPRStatus.REJECTED) {
    console.log(LOG_PREFIX, `  PR #${existing.githubPrNumber} has rejected label — updating status`)
    existing.status = BountyPRStatus.REJECTED
    existing.totalPoints = 0

    const activity = em.create(BountyActivityLog, {
      tenantId: existing.tenantId,
      organizationId: existing.organizationId,
      type: BountyActivityType.PR_REJECTED,
      pullRequestId: existing.id,
      message: `PR #${existing.githubPrNumber} rejected`,
      createdAt: new Date(),
    })

    em.persist([existing, activity])
    await em.flush()

    await eventBus.emit('bounties.pull_request.rejected', {
      pullRequestId: existing.id,
      tenantId: existing.tenantId,
      organizationId: existing.organizationId,
    })
  }
}
