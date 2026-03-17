import { z } from 'zod'
import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const retractSchema = z.object({
  competitionId: z.string().uuid(),
  projectId: z.string().uuid(),
})

export const metadata = {
  POST: { requireCustomerAuth: true },
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = retractSchema.parse(body)

    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const customerAuth = container.resolve('customerAuth') as { userId: string; tenantId: string; orgId: string }

    const { VotingService } = await import('../../../lib/VotingService')
    const votingService = new VotingService(em)

    const retracted = await votingService.retractVote(
      parsed.competitionId,
      customerAuth.userId,
      parsed.projectId,
    )

    if (!retracted) {
      return Response.json({ error: 'Vote not found' }, { status: 404 })
    }

    // Emit vote retracted event
    try {
      const eventBus = container.resolve('eventBus') as {
        emit?: (event: string, payload: unknown) => Promise<void>
        emitEvent?: (event: string, payload: unknown) => Promise<void>
      }
      const eventPayload = {
        competitionId: parsed.competitionId,
        voterId: customerAuth.userId,
        projectId: parsed.projectId,
        tenantId: customerAuth.tenantId,
        organizationId: customerAuth.orgId,
      }
      if (typeof eventBus.emit === 'function') {
        await eventBus.emit('sponsors.vote.retracted', eventPayload)
      } else if (typeof eventBus.emitEvent === 'function') {
        await eventBus.emitEvent('sponsors.vote.retracted', eventPayload)
      }
    } catch {
      // non-critical
    }

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 400 })
  }
}

export const openApi: OpenApiRouteDoc = {
  POST: {
    tags: ['Sponsors'],
    summary: 'Retract a vote',
    description: 'Retracts a previously cast vote (if allowVoteChange is enabled).',
    requestBody: {
      content: {
        'application/json': {
          schema: retractSchema,
        },
      },
    },
    responses: {
      '200': { description: 'Vote retracted successfully' },
      '400': { description: 'Cannot retract vote' },
      '404': { description: 'Vote not found' },
    },
  },
}
