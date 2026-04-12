import { createQueue } from '@open-mercato/queue'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { invalidateBountyPrCache } from '../../../../lib/cache'

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

    if (pr.status !== BountyPRStatus.DETECTED) {
      return new Response(JSON.stringify({ error: 'AI check can only be rerun for PRs in Detected state' }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })
    }

    const activity = em.create(BountyActivityLog, {
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      type: BountyActivityType.MANUAL_REFRESH,
      pullRequestId: pr.id,
      actorUserId: auth.userId ?? auth.sub ?? null,
      message: `PR #${pr.githubPrNumber} queued for manual AI classification`,
      metadata: { source: 'backend_judge_panel' },
      createdAt: new Date(),
    })

    em.persist(activity)
    await em.flush()

    const queue = createQueue('bounties-queue', 'local')
    await queue.enqueue({
      workerId: 'classify-pr',
      pullRequestId: pr.id,
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
    })

    await invalidateBountyPrCache(container, {
      id: pr.id,
      organizationId: pr.organizationId,
      tenantId: pr.tenantId,
    }, 'bounties.pr.rerun-ai')

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    console.error('[bounties/rerun-ai] PATCH error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Queue manual AI classification for a detected bounty PR',
  methods: { PATCH: { summary: 'Rerun AI classification for a detected bounty PR' } },
}
