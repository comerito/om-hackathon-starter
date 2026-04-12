import { NextResponse } from 'next/server'
import { createQueue } from '@open-mercato/queue'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { BountyPullRequest, BountyPRStatus, BountyActivityType, BountyActivityLog } from '../../../../../../data/entities'
import { verifyBountyJudge } from '../../../../../../lib/portalJudgeAuth'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { invalidateBountyPrCache } from '../../../../../../lib/cache'

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

    if (pr.status !== BountyPRStatus.DETECTED) {
      return NextResponse.json({ error: 'AI check can only be rerun for PRs in Detected state' }, { status: 409 })
    }

    const activity = em.create(BountyActivityLog, {
      tenantId: pr.tenantId,
      organizationId: pr.organizationId,
      type: BountyActivityType.MANUAL_REFRESH,
      pullRequestId: pr.id,
      actorUserId: auth.sub,
      message: `PR #${pr.githubPrNumber} queued for manual AI classification`,
      metadata: { source: 'portal_judge_panel' },
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
    }, 'bounties.portal.pr.rerun-ai')

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[bounties/portal/judge/rerun-ai] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'Queue manual AI classification for a detected bounty PR (portal judge)',
  methods: { PATCH: { summary: 'Rerun AI classification for a detected bounty PR as a portal judge' } },
}
