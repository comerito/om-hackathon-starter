import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { Competition } from '../../../data/entities'
import { competitionsTag, okSchema, errorSchema } from '../../openapi'

// ---------------------------------------------------------------------------
// Metadata — auth & feature gates
// ---------------------------------------------------------------------------

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['competitions.stages.manage'] },
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const rerunSideEffectsSchema = z.object({
  competitionId: z.string().uuid(),
})

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = rerunSideEffectsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { competitionId } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  // Load competition
  const competition = await em.findOne(Competition, {
    id: competitionId,
    deletedAt: null,
  } as FilterQuery<Competition>)

  if (!competition) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  }

  const currentStage = competition.stage

  // Re-emit the stage_advanced event for the current stage
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }

    const eventPayload = {
      competitionId: competition.id,
      oldStage: currentStage,
      newStage: currentStage,
      tenantId: competition.tenantId,
      organizationId: competition.organizationId,
      advancedAt: new Date().toISOString(),
      advancedBy: ctx.auth?.sub ?? null,
      isRerun: true,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('competitions.competition.stage_advanced', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('competitions.competition.stage_advanced', eventPayload)
    }
  } catch (err) {
    console.warn('[competitions] Failed to re-emit stage_advanced event', {
      competitionId,
      stage: currentStage,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: 'Failed to re-emit stage_advanced event' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Re-run side effects for current stage',
    description:
      'Re-emits the stage_advanced event for the competition\'s current stage. ' +
      'Useful for retrying failed side effects or triggering subscribers that were added after the stage was advanced.',
    tags: [competitionsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: rerunSideEffectsSchema,
        },
      },
    },
    responses: {
      200: {
        description: 'Side effects re-triggered successfully',
        content: {
          'application/json': {
            schema: okSchema,
          },
        },
      },
      400: {
        description: 'Invalid request body',
        content: { 'application/json': { schema: errorSchema } },
      },
      404: {
        description: 'Competition not found',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}
