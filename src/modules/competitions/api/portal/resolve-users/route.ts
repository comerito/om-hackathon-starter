import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const url = new URL(req.url)
    const ids = url.searchParams.get('ids')?.split(',').filter(Boolean) ?? []
    if (ids.length === 0) {
      return NextResponse.json({ users: {} })
    }

    // Limit to 50 IDs per request
    const limitedIds = ids.slice(0, 50)

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Query customer_users table for display names
    const knex = (em as any).getConnection().getKnex()
    let query = knex('customer_users')
      .select('id', 'display_name', 'email')
      .whereIn('id', limitedIds)
    if (auth.tenantId) {
      query = query.andWhere('tenant_id', auth.tenantId)
    }

    const rows = await query
    const users: Record<string, { displayName: string; email: string }> = {}
    for (const row of rows) {
      users[row.id] = {
        displayName: row.display_name || row.email?.split('@')[0] || 'Unknown',
        email: row.email || '',
      }
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error('[portal/resolve-users] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Resolve user names',
  methods: { GET: { summary: 'Resolve customer user IDs to display names' } },
}
