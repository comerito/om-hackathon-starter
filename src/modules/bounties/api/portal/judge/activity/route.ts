import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { z } from 'zod'
import { BountyActivityLog } from '../../../../data/entities'
import { verifyBountyJudge } from '../../../../lib/portalJudgeAuth'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const configService = container.resolve('moduleConfigService') as ModuleConfigService

    const judgeInfo = await verifyBountyJudge(em, auth, configService)
    if (!judgeInfo) return NextResponse.json({ error: 'Not a bounty judge' }, { status: 403 })

    const url = new URL(req.url)
    const parsed = querySchema.parse({
      limit: url.searchParams.get('limit') ?? undefined,
    })

    const activities = await em.find(
      BountyActivityLog,
      { tenantId: auth.tenantId, organizationId: auth.orgId },
      { orderBy: { createdAt: 'DESC' }, limit: parsed.limit },
    )

    return NextResponse.json({
      items: activities.map(a => ({
        id: a.id,
        type: a.type,
        pull_request_id: a.pullRequestId,
        actor_user_id: a.actorUserId,
        message: a.message,
        metadata: a.metadata,
        created_at: a.createdAt,
      })),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[bounties/portal/judge/activity] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'Bounty activity feed for portal judge',
  methods: { GET: { summary: 'Get bounty activity feed (portal judge)' } },
}
