import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { competitionStageSchema } from '../../../data/validators'
import { StageService } from '../../../lib/StageService'
import { competitionsTag, errorSchema } from '../../openapi'

// ---------------------------------------------------------------------------
// Metadata — auth & feature gates
// ---------------------------------------------------------------------------

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['competitions.stages.manage'] },
}

// ---------------------------------------------------------------------------
// Query schema
// ---------------------------------------------------------------------------

const stagePreviewQuerySchema = z.object({
  competitionId: z.string().uuid(),
  targetStage: competitionStageSchema,
})

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

const stagePreviewResponseSchema = z.object({
  currentStage: competitionStageSchema,
  targetStage: competitionStageSchema,
  sideEffects: z.array(z.string()),
  warnings: z.array(z.string()),
  counts: z.object({
    totalParticipants: z.number(),
    checkedInParticipants: z.number(),
    teamsFormed: z.number(),
    teamsWithoutTrack: z.number(),
    teamsBelowMinSize: z.number(),
    unmatchedParticipants: z.number(),
    projectsDraft: z.number(),
    projectsPublished: z.number(),
    judgesWithIncompleteScores: z.number(),
  }),
})

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  _ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const url = new URL(req.url)
  const rawQuery = {
    competitionId: url.searchParams.get('competitionId') ?? undefined,
    targetStage: url.searchParams.get('targetStage') ?? undefined,
  }

  const parsed = stagePreviewQuerySchema.safeParse(rawQuery)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { competitionId, targetStage } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const stageService = new StageService()

  try {
    const preview = await stageService.getStagePreview(competitionId, targetStage, em)
    return NextResponse.json(preview)
  } catch (err) {
    if (err instanceof Error && err.message === 'Competition not found') {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  GET: {
    summary: 'Preview stage advance side effects',
    description:
      'Returns a preview of what will happen when advancing a competition to the target stage, ' +
      'including side effects, warnings, and relevant counts (participants, teams, projects, judges).',
    tags: [competitionsTag],
    parameters: [
      {
        name: 'competitionId',
        in: 'query',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'The competition to preview the stage advance for.',
      },
      {
        name: 'targetStage',
        in: 'query',
        required: true,
        schema: { type: 'string', enum: Object.values(competitionStageSchema.enum) },
        description: 'The target stage to preview.',
      },
    ],
    responses: {
      200: {
        description: 'Stage preview with side effects, warnings, and counts',
        content: {
          'application/json': {
            schema: stagePreviewResponseSchema,
          },
        },
      },
      400: {
        description: 'Invalid query parameters',
        content: { 'application/json': { schema: errorSchema } },
      },
      404: {
        description: 'Competition not found',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}
