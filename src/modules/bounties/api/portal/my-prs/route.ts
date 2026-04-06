import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BountyPullRequest } from '../../../data/entities'
import { CompetitionParticipation } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Find the user's participation(s)
    const participationFilter: Record<string, unknown> = {
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
      deletedAt: null,
    }
    if (competitionId) participationFilter.competitionId = competitionId

    const participations = await em.find(CompetitionParticipation, participationFilter)
    if (participations.length === 0) {
      return NextResponse.json({ ok: true, prs: [], github_username: null })
    }

    const participantIds = participations.map(p => p.id)
    const githubUsername = participations.find(p => p.githubUsername)?.githubUsername ?? null

    // Fetch bounty PRs for this participant
    const prs = await em.find(BountyPullRequest, {
      participantId: { $in: participantIds },
      tenantId: auth.tenantId,
      deletedAt: null,
    }, {
      orderBy: { createdAt: 'DESC' },
    })

    return NextResponse.json({
      ok: true,
      github_username: githubUsername,
      prs: prs.map(pr => ({
        id: pr.id,
        github_pr_number: pr.githubPrNumber,
        github_pr_url: pr.githubPrUrl,
        title: pr.title,
        status: pr.status,
        classifications: pr.classifications,
        total_points: pr.totalPoints,
        is_duplicate: pr.isDuplicate,
        classification_confidence: pr.classificationConfidence,
        github_created_at: pr.githubCreatedAt,
        created_at: pr.createdAt,
      })),
    })
  } catch (error) {
    console.error('[bounties/portal/my-prs] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'My bounty PRs',
  methods: { GET: { summary: 'Get current participant bounty PRs (portal)' } },
}
