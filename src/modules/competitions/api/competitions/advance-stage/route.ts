import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { withAtomicFlush } from '@open-mercato/shared/lib/commands/flush'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { Competition, CompetitionStage } from '../../../data/entities'
import { competitionStageSchema } from '../../../data/validators'
import { StageService } from '../../../lib/StageService'
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

const advanceStageSchema = z.object({
  competitionId: z.string().uuid(),
  targetStage: competitionStageSchema,
})

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

const advanceStageResponseSchema = z.object({
  ok: z.literal(true),
  competition: z.object({
    id: z.string().uuid(),
    stage: competitionStageSchema,
    updatedAt: z.string().datetime(),
  }),
})

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = advanceStageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { competitionId, targetStage } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const stageService = new StageService()

  // Load competition
  const competition = await em.findOne(Competition, {
    id: competitionId,
    deletedAt: null,
  } as FilterQuery<Competition>)

  if (!competition) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  }

  const currentStage = competition.stage

  // Validate transition
  if (!stageService.isValidTransition(currentStage, targetStage)) {
    // Special case: TEAM_FORMATION -> HACKING (skipping TRACK_SELECTION)
    if (
      currentStage === CompetitionStage.TEAM_FORMATION &&
      targetStage === CompetitionStage.HACKING &&
      stageService.isSkipTrackSelectionAllowed(competition.stageConfig)
    ) {
      // Allowed — fall through
    } else {
      const nextStages = stageService.getNextStages(currentStage)
      return NextResponse.json(
        {
          error: `Invalid stage transition from ${currentStage} to ${targetStage}`,
          allowedTransitions: nextStages,
        },
        { status: 422 },
      )
    }
  }

  // Perform the stage update atomically
  const oldStage = competition.stage
  await withAtomicFlush(
    em,
    [
      () => {
        competition.stage = targetStage as CompetitionStage
        competition.updatedAt = new Date()
      },
    ],
    { transaction: true },
  )

  // Emit stage_advanced event
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }

    const eventPayload = {
      competitionId: competition.id,
      oldStage,
      newStage: targetStage,
      tenantId: competition.tenantId,
      organizationId: competition.organizationId,
      advancedAt: new Date().toISOString(),
      advancedBy: ctx.auth?.sub ?? null,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('competitions.competition.stage_advanced', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('competitions.competition.stage_advanced', eventPayload)
    }
  } catch (err) {
    console.warn('[competitions] Failed to emit stage_advanced event', {
      competitionId,
      oldStage,
      newStage: targetStage,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({
    ok: true,
    competition: {
      id: competition.id,
      stage: competition.stage,
      updatedAt: competition.updatedAt.toISOString(),
    },
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Advance competition stage',
    description:
      'Validates the stage transition, updates the competition stage, and emits a stage_advanced event. ' +
      'Returns the updated competition with the new stage.',
    tags: [competitionsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: advanceStageSchema,
        },
      },
    },
    responses: {
      200: {
        description: 'Stage advanced successfully',
        content: {
          'application/json': {
            schema: advanceStageResponseSchema,
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
      422: {
        description: 'Invalid stage transition',
        content: {
          'application/json': {
            schema: z.object({
              error: z.string(),
              allowedTransitions: z.array(competitionStageSchema),
            }),
          },
        },
      },
    },
  },
}
