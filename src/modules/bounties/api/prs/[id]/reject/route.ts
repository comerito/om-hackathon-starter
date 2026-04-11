import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { invalidateBountyPrCache } from '../../../../lib/cache'

const rejectSchema = z.object({
  reason: z.string().optional(),
})

export const metadata = {
  PATCH: { requireAuth: true, requireFeatures: ['bounties.judge'] },
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = rejectSchema.parse(body)
    const em = container.resolve('em') as EntityManager
    const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }

    const pr = await em.findOne(BountyPullRequest, {
      id,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (!pr) {
      return new Response(JSON.stringify({ error: 'PR not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    pr.status = BountyPRStatus.REJECTED
    pr.totalPoints = 0

    const activity = em.create(BountyActivityLog, {
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      type: BountyActivityType.PR_REJECTED,
      pullRequestId: pr.id,
      actorUserId: auth.userId ?? auth.sub ?? null,
      message: `PR #${pr.githubPrNumber} rejected${parsed.reason ? `: ${parsed.reason}` : ''}`,
      metadata: parsed.reason ? { reason: parsed.reason } : null,
      createdAt: new Date(),
    })

    em.persist([pr, activity])
    await em.flush()
    await invalidateBountyPrCache(container, {
      id: pr.id,
      organizationId: pr.organizationId,
      tenantId: pr.tenantId,
    }, 'bounties.pr.reject')

    await eventBus.emit('bounties.pull_request.rejected', {
      pullRequestId: pr.id,
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[bounties/reject] PATCH error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Reject bounty PR',
  methods: { PATCH: { summary: 'Reject a bounty PR' } },
}
