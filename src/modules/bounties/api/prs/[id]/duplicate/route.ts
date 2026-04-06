import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const markDuplicateSchema = z.object({
  duplicate_of_id: z.string().uuid(),
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
    const parsed = markDuplicateSchema.parse(body)
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

    // Verify the duplicate target exists
    const originalPR = await em.findOne(BountyPullRequest, {
      id: parsed.duplicate_of_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (!originalPR) {
      return new Response(JSON.stringify({ error: 'Duplicate target PR not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    pr.isDuplicate = true
    pr.duplicateOfId = parsed.duplicate_of_id
    pr.duplicateMarkedBy = 'judge'
    pr.status = BountyPRStatus.DUPLICATE
    pr.totalPoints = 0

    const activity = em.create(BountyActivityLog, {
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      type: BountyActivityType.PR_DUPLICATE,
      pullRequestId: pr.id,
      actorUserId: auth.userId ?? auth.sub ?? null,
      message: `PR #${pr.githubPrNumber} marked as duplicate of PR #${originalPR.githubPrNumber}${parsed.reason ? `: ${parsed.reason}` : ''}`,
      metadata: { duplicateOfId: parsed.duplicate_of_id, reason: parsed.reason },
      createdAt: new Date(),
    })

    em.persist([pr, activity])
    await em.flush()

    await eventBus.emit('bounties.pull_request.duplicate_detected', {
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
    console.error('[bounties/duplicate] PATCH error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Mark PR as duplicate',
  methods: { PATCH: { summary: 'Mark a bounty PR as duplicate of another' } },
}
