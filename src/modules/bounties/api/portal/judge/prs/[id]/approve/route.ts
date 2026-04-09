import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../../../../../../data/entities'
import type { BountyClassification } from '../../../../../../data/entities'
import { verifyBountyJudge } from '../../../../../../lib/portalJudgeAuth'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  PATCH: { requireCustomerAuth: true },
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getCustomerAuthFromRequest(_request)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const configService = container.resolve('moduleConfigService') as ModuleConfigService
    const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }

    const judgeInfo = await verifyBountyJudge(em, auth, configService)
    if (!judgeInfo) return NextResponse.json({ error: 'Not a bounty judge' }, { status: 403 })

    const { id } = await params
    const pr = await em.findOne(BountyPullRequest, {
      id,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (!pr) return NextResponse.json({ error: 'PR not found' }, { status: 404 })

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
      actorUserId: auth.sub,
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

    return NextResponse.json({ ok: true, totalPoints: pr.totalPoints })
  } catch (error) {
    console.error('[bounties/portal/judge/approve] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'Approve bounty PR (portal judge)',
  methods: { PATCH: { summary: 'Approve a bounty PR as a portal judge' } },
}
