import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const BOUNTY_TRACK_MAPPINGS_KEY = 'bounty_track_mappings'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const container = await createRequestContainer()
    const configService = container.resolve('moduleConfigService') as ModuleConfigService
    const mappings = await configService.getValue<Record<string, string>>('bounties', BOUNTY_TRACK_MAPPINGS_KEY, { defaultValue: {} })

    return NextResponse.json({ ok: true, mappings: mappings ?? {} })
  } catch (error) {
    console.error('[bounties:portal:config] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'Get bounty track mappings (portal)',
  methods: { GET: { summary: 'Get bounty track mappings for the current tenant (portal)' } },
}
