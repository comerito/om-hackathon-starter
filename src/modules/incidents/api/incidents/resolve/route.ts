import { z } from 'zod'
import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveIncidentSchema } from '../../../data/validators'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['incidents.resolve'] },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = resolveIncidentSchema.parse(body)

    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    // Get auth context
    const auth = container.resolve('auth') as { tenantId: string; orgId: string; userId: string }

    const now = new Date()

    // Update the incident report
    const updated = await knex('incidents_report')
      .where({
        id: parsed.id,
        tenant_id: auth.tenantId,
        organization_id: auth.orgId,
      })
      .update({
        status: parsed.status,
        resolution_description: parsed.resolutionDescription,
        resolved_by: auth.userId,
        resolved_at: now,
        updated_at: now,
      })

    if (updated === 0) {
      return Response.json({ error: 'Incident not found' }, { status: 404 })
    }

    // Emit resolved event
    try {
      const eventBus = container.resolve('eventBus') as {
        emit?: (event: string, payload: unknown) => Promise<void>
        emitEvent?: (event: string, payload: unknown) => Promise<void>
      }
      const eventPayload = {
        id: parsed.id,
        status: parsed.status,
        resolvedBy: auth.userId,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      }
      if (typeof eventBus.emit === 'function') {
        await eventBus.emit('incidents.report.resolved', eventPayload)
      } else if (typeof eventBus.emitEvent === 'function') {
        await eventBus.emitEvent('incidents.report.resolved', eventPayload)
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
    tags: ['Incidents'],
    summary: 'Resolve an incident report',
    description: 'Sets the incident status to resolved or dismissed, records the resolution description and resolver.',
    requestBody: {
      content: {
        'application/json': {
          schema: resolveIncidentSchema,
        },
      },
    },
    responses: {
      '200': { description: 'Incident resolved successfully' },
      '400': { description: 'Validation error' },
      '404': { description: 'Incident not found' },
    },
  },
}
