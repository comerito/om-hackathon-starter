import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { LeaderboardService } from '../../services/LeaderboardService'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const querySchema = z.object({
  competition_id: z.union([z.string().uuid(), z.literal('current')]),
  organization_id: z.union([z.string().uuid(), z.literal('current')]),
})

export const metadata = {
  GET: { requireAuth: false },
}

export async function GET(request: Request) {
  try {
    const container = await createRequestContainer()
    const url = new URL(request.url)
    const parsed = querySchema.parse({
      competition_id: url.searchParams.get('competition_id'),
      organization_id: url.searchParams.get('organization_id'),
    })

    let organizationId = parsed.organization_id
    let competitionId = parsed.competition_id

    if (organizationId === 'current' || competitionId === 'current') {
      // Try admin auth first, then customer (portal) auth
      const adminAuth = await getAuthFromCookies()
      const customerAuth = !adminAuth?.orgId ? await getCustomerAuthFromRequest(request) : null
      const orgId = adminAuth?.orgId ?? customerAuth?.orgId
      const tenantId = adminAuth?.tenantId ?? customerAuth?.tenantId
      if (!orgId || !tenantId) {
        return new Response(JSON.stringify({ error: 'Cannot resolve current organization — not authenticated' }), { status: 401, headers: { 'content-type': 'application/json' } })
      }
      if (organizationId === 'current') organizationId = orgId
      if (competitionId === 'current') {
        const em = container.resolve('em') as EntityManager
        const row = await em.getConnection().execute(
          `SELECT id FROM competitions_competition
           WHERE organization_id = ? AND tenant_id = ? AND stage != 'archived' AND deleted_at IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [orgId, tenantId]
        )
        if (!row.length) {
          return new Response(JSON.stringify({ teams: [], lastUpdated: new Date().toISOString() }), { headers: { 'content-type': 'application/json' } })
        }
        competitionId = row[0].id
      }
    }

    const em = container.resolve('em') as EntityManager
    const leaderboardService = new LeaderboardService()
    const data = await leaderboardService.getLeaderboard(em, competitionId, organizationId)

    return new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[bounties/leaderboard] GET error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Bounty leaderboard',
  methods: { GET: { summary: 'Get bounty hunting leaderboard' } },
}
