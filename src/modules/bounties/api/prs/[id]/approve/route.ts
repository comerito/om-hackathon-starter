import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog, BOUNTY_POINTS } from '../../../../data/entities'
import type { BountyClassification } from '../../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  PATCH: { requireAuth: true, requireFeatures: ['bounties.judge'] },
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(request)
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const { id } = await params
    const em = container.resolve('em') as EntityManager
    const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request })
    const scopeOrganizationId = scope.selectedId ?? auth.orgId ?? null

    const filters: FilterQuery<BountyPullRequest> = {
      id,
      tenantId: auth.tenantId,
      deletedAt: null,
    }
    if (scopeOrganizationId) {
      filters.organizationId = scopeOrganizationId
    }

    const pr = await em.findOne(BountyPullRequest, filters)

    if (!pr) {
      return new Response(JSON.stringify({ error: 'PR not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    pr.status = BountyPRStatus.APPROVED
    if (!pr.isDuplicate && !pr.isSplitChild) {
      const classifications: BountyClassification[] = pr.pointsOverride ?? pr.classifications ?? []
      pr.totalPoints = classifications.reduce((sum, c) => sum + c.points, 0)
    }

    const activity = em.create(BountyActivityLog, {
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      type: BountyActivityType.PR_APPROVED,
      pullRequestId: pr.id,
      actorUserId: auth.userId ?? auth.sub ?? null,
      message: `PR #${pr.githubPrNumber} approved — ${pr.totalPoints} points awarded to @${pr.githubAuthor}`,
      createdAt: new Date(),
    })

    em.persist([pr, activity])
    await em.flush()

    await eventBus.emit('bounties.pull_request.approved', {
      pullRequestId: pr.id,
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      totalPoints: pr.totalPoints,
    })

    return new Response(JSON.stringify({ ok: true, totalPoints: pr.totalPoints }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    console.error('[bounties/approve] PATCH error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Approve bounty PR',
  methods: { PATCH: { summary: 'Approve a bounty PR and award points' } },
}
