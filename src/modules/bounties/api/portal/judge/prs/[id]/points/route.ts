import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { z } from 'zod'
import { BountyPullRequest, BountyActivityType, BountyActivityLog } from '../../../../../../data/entities'
import { verifyBountyJudge } from '../../../../../../lib/portalJudgeAuth'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const adjustPointsSchema = z.object({
  total_points: z.number().int().min(0),
  reason: z.string().min(1),
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
    const parsed = adjustPointsSchema.parse(body)

    const pr = await em.findOne(BountyPullRequest, {
      id,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (!pr) return NextResponse.json({ error: 'PR not found' }, { status: 404 })

    const previousPoints = pr.totalPoints
    pr.totalPoints = parsed.total_points

    const activity = em.create(BountyActivityLog, {
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      type: BountyActivityType.POINTS_ADJUSTED,
      pullRequestId: pr.id,
      actorUserId: auth.sub,
      message: `PR #${pr.githubPrNumber} points adjusted: ${previousPoints} -> ${parsed.total_points} — ${parsed.reason}`,
      metadata: { previousPoints, newPoints: parsed.total_points, reason: parsed.reason },
      createdAt: new Date(),
    })

    em.persist([pr, activity])
    await em.flush()

    await eventBus.emit('bounties.pull_request.points_adjusted', {
      pullRequestId: pr.id,
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      totalPoints: pr.totalPoints,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[bounties/portal/judge/points] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'Adjust PR points (portal judge)',
  methods: { PATCH: { summary: 'Manually adjust points for a bounty PR (portal judge)' } },
}
