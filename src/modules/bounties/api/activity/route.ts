import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { BountyActivityLog } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const querySchema = z.object({
  competition_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['bounties.view'] },
}

export async function GET(request: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const url = new URL(request.url)
    const parsed = querySchema.parse({
      competition_id: url.searchParams.get('competition_id') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })

    const em = container.resolve('em') as EntityManager
    const activities = await em.find(
      BountyActivityLog,
      {
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      },
      {
        orderBy: { createdAt: 'DESC' },
        limit: parsed.limit,
      }
    )

    return new Response(JSON.stringify({
      items: activities.map(a => ({
        id: a.id,
        type: a.type,
        pull_request_id: a.pullRequestId,
        actor_user_id: a.actorUserId,
        message: a.message,
        metadata: a.metadata,
        created_at: a.createdAt,
      })),
    }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[bounties/activity] GET error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Activity feed',
  methods: { GET: { summary: 'Get bounty activity feed' } },
}
