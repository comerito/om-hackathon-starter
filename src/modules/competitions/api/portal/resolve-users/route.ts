import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { rawAll } from '@/lib/db'

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
    // NOTE: `limitedIds` is guaranteed non-empty here (empty `ids` returns early above), so the
    // `IN (?)` expansion can never render an empty `IN ()` list.
    const conditions: string[] = ['id IN (?)']
    const values: unknown[] = [limitedIds]
    if (auth.tenantId) {
      conditions.push('tenant_id = ?')
      values.push(auth.tenantId)
    }

    const rows = await rawAll<{ id: string; display_name: string | null; email: string | null }>(em,
      `SELECT id, display_name, email FROM customer_users WHERE ${conditions.join(' AND ')}`,
      values,
    )
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
