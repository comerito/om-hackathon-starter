import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CompetitionParticipation } from '../../../data/entities'
import type { FilterQuery } from '@mikro-orm/postgresql'
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
    const competitionId = url.searchParams.get('competition_id')
    const query = url.searchParams.get('q') ?? ''

    if (!competitionId) {
      return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })
    }
    if (query.length < 2) {
      return NextResponse.json({ items: [] })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Search customer_users by email or display_name, filtered to competition participants
    const participations = await em.find(CompetitionParticipation, {
      competitionId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)

    const participantUserIds = participations.map(p => p.customerUserId)
    if (participantUserIds.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // NOTE: `participantUserIds` is guaranteed non-empty here (empty list returns early above),
    // so the `IN (?)` expansion can never render an empty `IN ()` list.
    // The email/display_name OR group MUST stay parenthesised so it does not escape the AND.
    const searchPattern = `%${query}%`
    const rows = await em.getConnection().execute<Array<{ id: string; display_name: string | null; email: string | null }>>(
      `SELECT id, display_name, email FROM customer_users
       WHERE id IN (?)
         AND (email ILIKE ? OR display_name ILIKE ?)
       LIMIT 10`,
      [participantUserIds, searchPattern, searchPattern],
    )

    const items = rows.map((row: any) => ({
      id: row.id,
      displayName: row.display_name || row.email?.split('@')[0] || 'Unknown',
      email: row.email || '',
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[portal/search-participants] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Search participants',
  methods: { GET: { summary: 'Search competition participants by email or name' } },
}
