import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { z } from 'zod'
import { verifyBountyJudge } from '../../../../lib/portalJudgeAuth'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const querySchema = z.object({
  competitionId: z.string().uuid(),
})

export const metadata = {
  GET: {
    requireCustomerAuth: true,
    requireCustomerFeatures: ['portal.bounties.judge'],
  },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const url = new URL(req.url)
    const parsed = querySchema.parse({
      competitionId: url.searchParams.get('competitionId') ?? undefined,
    })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const configService = container.resolve('moduleConfigService') as ModuleConfigService

    const judgeInfo = await verifyBountyJudge(em, auth, configService, parsed.competitionId)

    return NextResponse.json({
      canAccess: Boolean(judgeInfo),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[bounties/portal/judge/access] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'Check portal bounty judge access',
  methods: { GET: { summary: 'Check whether the current portal user can access the bounty judge panel for a competition' } },
}
