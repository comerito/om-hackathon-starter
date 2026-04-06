import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { BountyActivityType, BountyActivityLog } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const pollSchema = z.object({
  competition_id: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['bounties.judge'] },
}

export async function POST(request: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const body = await request.json()
    const parsed = pollSchema.parse(body)
    const em = container.resolve('em') as EntityManager
    const queue = container.resolve('queueService') as { add: (queue: string, data: Record<string, unknown>) => Promise<void> }

    // Log the manual refresh
    const activity = em.create(BountyActivityLog, {
      tenantId: auth.tenantId,
      organizationId: auth.orgId!,
      type: BountyActivityType.MANUAL_REFRESH,
      actorUserId: auth.userId ?? auth.sub ?? null,
      message: 'Manual GitHub refresh triggered',
      createdAt: new Date(),
    })
    em.persist(activity)
    await em.flush()

    // Dispatch poll worker
    await queue.add('bounties-queue', {
      workerId: 'poll-github',
      data: {
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        competitionId: parsed.competition_id,
      },
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[bounties/poll] POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Manual poll trigger',
  methods: { POST: { summary: 'Trigger on-demand GitHub poll' } },
}
