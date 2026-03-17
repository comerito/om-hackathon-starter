import { z } from 'zod'
import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const unassignSchema = z.object({
  prizeId: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['sponsors.prizes.assign'] },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = unassignSchema.parse(body)

    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    const auth = container.resolve('auth') as { tenantId: string; orgId: string }

    const updated = await knex('sponsors_prize')
      .where({
        id: parsed.prizeId,
        tenant_id: auth.tenantId,
        organization_id: auth.orgId,
      })
      .update({
        winning_project_id: null,
        winning_team_id: null,
        awarded_at: null,
        awarded_by: null,
        updated_at: new Date(),
      })

    if (updated === 0) {
      return Response.json({ error: 'Prize not found' }, { status: 404 })
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
    summary: 'Unassign a prize',
    description: 'Removes the winning project/team assignment from a prize.',
    requestBody: {
      content: {
        'application/json': {
          schema: unassignSchema,
        },
      },
    },
    responses: {
      '200': { description: 'Prize unassigned successfully' },
      '400': { description: 'Validation error' },
      '404': { description: 'Prize not found' },
    },
  },
}
