import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../../../data/entities'
import { CompetitionParticipation, Competition } from '../../../../competitions/data/entities'
import { GitHubService } from '../../../services/GitHubService'
import { submitPRSchema } from '../../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: { requireCustomerAuth: true },
}

const BOUNTY_TRACK_MAPPINGS_KEY = 'bounty_track_mappings'
const LOG_PREFIX = '[bounties:portal:submit-pr]'

export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await req.json()
    const parsed = submitPRSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const { pr_url: prNumber, competition_id: competitionId } = parsed.data

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const configService = container.resolve('moduleConfigService') as ModuleConfigService
    const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }

    // Verify this competition has a bounty track configured
    const mappings = await configService.getValue<Record<string, string>>('bounties', BOUNTY_TRACK_MAPPINGS_KEY, { defaultValue: {} })
    const bountyTrackId = mappings?.[competitionId]
    if (!bountyTrackId) {
      return NextResponse.json({ error: 'Bounty hunting is not enabled for this competition' }, { status: 400 })
    }

    // Find participant record
    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub,
      competitionId,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)

    if (!participation) {
      return NextResponse.json({ error: 'You are not a participant in this competition' }, { status: 403 })
    }

    // Resolve team and verify participant is on the bounty track
    const teamMember = await em.getConnection().execute(
      `SELECT tm.team_id FROM teams_team_member tm WHERE tm.customer_user_id = ? AND tm.competition_id = ? AND tm.tenant_id = ? AND tm.deleted_at IS NULL LIMIT 1`,
      [participation.customerUserId, competitionId, auth.tenantId]
    )
    const teamId = teamMember?.[0]?.team_id ?? null

    if (teamId) {
      const teamTracks = await em.getConnection().execute(
        `SELECT track_id FROM teams_team_track WHERE team_id = ? AND competition_id = ? AND tenant_id = ?`,
        [teamId, competitionId, auth.tenantId]
      )
      const trackIds = (teamTracks as Array<{ track_id: string }>).map(r => r.track_id)
      if (!trackIds.includes(bountyTrackId)) {
        return NextResponse.json({ error: 'Your team is not on the bounty hunting track' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'You are not part of a team in this competition' }, { status: 403 })
    }

    // Fetch PR from GitHub
    const github = new GitHubService()
    let pr
    try {
      pr = await github.fetchSinglePR(prNumber)
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      if (status === 404) {
        return NextResponse.json({ error: `PR #${prNumber} not found in the repository` }, { status: 404 })
      }
      console.error(LOG_PREFIX, 'GitHub API error:', err)
      return NextResponse.json({ error: 'Failed to fetch PR from GitHub' }, { status: 502 })
    }

    // Validate PR was created within the competition time window
    const competition = await em.findOne(Competition, { id: competitionId } as FilterQuery<Competition>)
    if (competition) {
      const prCreatedAt = new Date(pr.created_at)
      if (prCreatedAt < competition.startsAt) {
        return NextResponse.json({ error: `This PR was created before the competition started (${competition.startsAt.toLocaleDateString()})` }, { status: 400 })
      }
      if (prCreatedAt > competition.endsAt) {
        return NextResponse.json({ error: `This PR was created after the competition ended (${competition.endsAt.toLocaleDateString()})` }, { status: 400 })
      }
    }

    // Verify the PR belongs to the participant
    const githubUsername = participation.githubUsername
    if (!githubUsername) {
      return NextResponse.json({ error: 'Set your GitHub username in your profile before submitting PRs' }, { status: 400 })
    }
    if (pr.user.login.toLowerCase() !== githubUsername.toLowerCase()) {
      return NextResponse.json({ error: `This PR belongs to @${pr.user.login}, but your registered GitHub username is @${githubUsername}` }, { status: 403 })
    }

    // Check for duplicate submission
    const existing = await em.findOne(BountyPullRequest, {
      githubPrId: String(pr.id),
      tenantId: auth.tenantId,
    } as FilterQuery<BountyPullRequest>)

    if (existing) {
      return NextResponse.json({
        error: `PR #${prNumber} has already been submitted`,
        existing_id: existing.id,
        existing_status: existing.status,
      }, { status: 409 })
    }

    // Fetch diff
    let diff = ''
    try {
      diff = await github.fetchPRDiff(prNumber)
      console.log(LOG_PREFIX, `Diff fetched for PR #${prNumber}: ${diff.length} chars`)
    } catch (err) {
      console.error(LOG_PREFIX, `Failed to fetch diff for PR #${prNumber}:`, err)
    }

    // Create BountyPullRequest
    const bountyPR = em.create(BountyPullRequest, {
      tenantId: auth.tenantId,
      organizationId: auth.orgId ?? '',
      competitionId,
      githubPrId: String(pr.id),
      githubPrNumber: pr.number,
      githubPrUrl: pr.html_url,
      title: pr.title,
      description: pr.body,
      diffContent: diff,
      githubAuthor: pr.user.login,
      participantId: participation.id,
      teamId,
      status: BountyPRStatus.DETECTED,
      totalPoints: 0,
      isDuplicate: false,
      isSplitChild: false,
      githubCreatedAt: new Date(pr.created_at),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const activity = em.create(BountyActivityLog, {
      tenantId: auth.tenantId,
      organizationId: auth.orgId ?? '',
      type: BountyActivityType.PR_DETECTED,
      pullRequestId: bountyPR.id,
      message: `PR #${pr.number} submitted by participant @${pr.user.login}: "${pr.title}"`,
      createdAt: new Date(),
    })

    em.persist([bountyPR, activity])
    await em.flush()

    console.log(LOG_PREFIX, `Created BountyPullRequest ${bountyPR.id} for PR #${pr.number} (submitted by user ${auth.sub})`)

    // Emit event to trigger classification
    await eventBus.emit('bounties.pull_request.detected', {
      pullRequestId: bountyPR.id,
      tenantId: auth.tenantId,
      organizationId: auth.orgId ?? '',
      competitionId,
    })

    return NextResponse.json({
      ok: true,
      pr: {
        id: bountyPR.id,
        github_pr_number: bountyPR.githubPrNumber,
        github_pr_url: bountyPR.githubPrUrl,
        title: bountyPR.title,
        status: bountyPR.status,
        github_author: bountyPR.githubAuthor,
      },
    })
  } catch (error) {
    console.error(LOG_PREFIX, 'POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'Submit a PR for bounty evaluation',
  methods: { POST: { summary: 'Submit a GitHub PR URL for bounty classification (portal)' } },
}
