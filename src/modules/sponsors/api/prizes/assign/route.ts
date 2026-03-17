import { z } from 'zod'
import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const assignSchema = z.object({
  prizeId: z.string().uuid(),
  projectId: z.string().uuid(),
  teamId: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['sponsors.prizes.assign'] },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = assignSchema.parse(body)

    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    // Get auth context
    const auth = container.resolve('auth') as { tenantId: string; orgId: string; userId: string }

    // Update the prize with the winning project and team
    const updated = await knex('sponsors_prize')
      .where({
        id: parsed.prizeId,
        tenant_id: auth.tenantId,
        organization_id: auth.orgId,
      })
      .update({
        winning_project_id: parsed.projectId,
        winning_team_id: parsed.teamId,
        awarded_at: new Date(),
        awarded_by: auth.userId,
        updated_at: new Date(),
      })

    if (updated === 0) {
      return Response.json({ error: 'Prize not found' }, { status: 404 })
    }

    // Emit prize awarded event
    try {
      const eventBus = container.resolve('eventBus') as {
        emit?: (event: string, payload: unknown) => Promise<void>
        emitEvent?: (event: string, payload: unknown) => Promise<void>
      }
      const eventPayload = {
        prizeId: parsed.prizeId,
        projectId: parsed.projectId,
        teamId: parsed.teamId,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      }
      if (typeof eventBus.emit === 'function') {
        await eventBus.emit('sponsors.prize.awarded', eventPayload)
      } else if (typeof eventBus.emitEvent === 'function') {
        await eventBus.emitEvent('sponsors.prize.awarded', eventPayload)
      }
    } catch {
      // non-critical
    }

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  POST: {
    tags: ['Sponsors'],
    summary: 'Assign a prize to a project/team',
    description: 'Assigns a prize to a winning project and team.',
    requestBody: {
      content: {
        'application/json': {
          schema: assignSchema,
        },
      },
    },
    responses: {
      '200': { description: 'Prize assigned successfully' },
      '400': { description: 'Validation error' },
      '404': { description: 'Prize not found' },
    },
  },
}
