import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { z } from 'zod'
import { BountyPullRequest, BountyActivityType, BountyActivityLog, BOUNTY_POINTS } from '../../../../../../data/entities'
import type { BountyCategory, BountyClassification } from '../../../../../../data/entities'
import { bountyCategoryValues } from '../../../../../../data/validators'
import { verifyBountyJudge } from '../../../../../../lib/portalJudgeAuth'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { invalidateBountyPrCache } from '../../../../../../lib/cache'

const overrideSchema = z.object({
  classifications: z.array(z.object({
    category: z.enum(bountyCategoryValues),
    reasoning: z.string().min(1),
  })).min(1),
})

export const metadata = {
  PATCH: { requireCustomerAuth: true },
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getCustomerAuthFromRequest(request)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const configService = container.resolve('moduleConfigService') as ModuleConfigService
    const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }

    const judgeInfo = await verifyBountyJudge(em, auth, configService)
    if (!judgeInfo) return NextResponse.json({ error: 'Not a bounty judge' }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const parsed = overrideSchema.parse(body)

    const pr = await em.findOne(BountyPullRequest, {
      id,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (!pr) return NextResponse.json({ error: 'PR not found' }, { status: 404 })

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
      actorUserId: auth.sub,
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
    }, 'bounties.portal.pr.classify')

    await eventBus.emit('bounties.pull_request.points_adjusted', {
      pullRequestId: pr.id,
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      totalPoints: pr.totalPoints,
    })

    return NextResponse.json({ ok: true, totalPoints: pr.totalPoints })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[bounties/portal/judge/classify] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'Override PR classification (portal judge)',
  methods: { PATCH: { summary: 'Override LLM classification for a bounty PR (portal judge)' } },
}
