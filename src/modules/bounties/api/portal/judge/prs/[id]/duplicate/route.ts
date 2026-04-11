import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { z } from 'zod'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../../../../../../data/entities'
import { verifyBountyJudge } from '../../../../../../lib/portalJudgeAuth'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { invalidateBountyPrCache } from '../../../../../../lib/cache'

const markDuplicateSchema = z.object({
  duplicate_of_id: z.string().uuid(),
  reason: z.string().optional(),
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
    const parsed = markDuplicateSchema.parse(body)

    const pr = await em.findOne(BountyPullRequest, {
      id,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (!pr) return NextResponse.json({ error: 'PR not found' }, { status: 404 })

    const originalPR = await em.findOne(BountyPullRequest, {
      id: parsed.duplicate_of_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (!originalPR) return NextResponse.json({ error: 'Duplicate target PR not found' }, { status: 404 })

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
      actorUserId: auth.sub,
      message: `PR #${pr.githubPrNumber} marked as duplicate of PR #${originalPR.githubPrNumber}${parsed.reason ? `: ${parsed.reason}` : ''}`,
      metadata: { duplicateOfId: parsed.duplicate_of_id, reason: parsed.reason },
      createdAt: new Date(),
    })

    em.persist([pr, activity])
    await em.flush()
    await invalidateBountyPrCache(container, {
      id: pr.id,
      organizationId: pr.organizationId,
      tenantId: pr.tenantId,
    }, 'bounties.portal.pr.duplicate')

    await eventBus.emit('bounties.pull_request.duplicate_detected', {
      pullRequestId: pr.id,
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[bounties/portal/judge/duplicate] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'Mark PR as duplicate (portal judge)',
  methods: { PATCH: { summary: 'Mark a bounty PR as duplicate (portal judge)' } },
}
