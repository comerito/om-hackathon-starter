import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { BountyPullRequest, BountyActivityType, BountyActivityLog, BOUNTY_POINTS } from '../../../../data/entities'
import type { BountyCategory, BountyClassification } from '../../../../data/entities'
import { bountyCategoryValues } from '../../../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { invalidateBountyPrCache } from '../../../../lib/cache'

const overrideSchema = z.object({
  classifications: z.array(z.object({
    category: z.enum(bountyCategoryValues),
    reasoning: z.string().min(1),
  })).min(1),
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
    const parsed = overrideSchema.parse(body)
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

    const overrideClassifications: BountyClassification[] = parsed.classifications.map(c => ({
      category: c.category as BountyCategory,
      points: BOUNTY_POINTS[c.category as BountyCategory],
      reasoning: c.reasoning,
    }))

    pr.pointsOverride = overrideClassifications
    pr.totalPoints = overrideClassifications.reduce((sum, c) => sum + c.points, 0)

    const activity = em.create(BountyActivityLog, {
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      type: BountyActivityType.CLASSIFICATION_OVERRIDDEN,
      pullRequestId: pr.id,
      actorUserId: auth.userId ?? auth.sub ?? null,
      message: `PR #${pr.githubPrNumber} classification overridden: ${overrideClassifications.map(c => c.category).join(', ')} — ${pr.totalPoints} pts`,
      metadata: { previous: pr.classifications, override: overrideClassifications },
      createdAt: new Date(),
    })

    em.persist([pr, activity])
    await em.flush()
    await invalidateBountyPrCache(container, {
      id: pr.id,
      organizationId: pr.organizationId,
      tenantId: pr.tenantId,
    }, 'bounties.pr.classify')

    await eventBus.emit('bounties.pull_request.points_adjusted', {
      pullRequestId: pr.id,
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      totalPoints: pr.totalPoints,
    })

    return new Response(JSON.stringify({ ok: true, totalPoints: pr.totalPoints }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[bounties/classify] PATCH error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Override PR classification',
  methods: { PATCH: { summary: 'Override LLM classification for a bounty PR' } },
}
