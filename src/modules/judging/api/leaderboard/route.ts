import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { leaderboardSchema } from '../../data/validators'
import { ScoringService } from '../../lib/ScoringService'
import { judgingTag, errorSchema } from '../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  GET: { requireAuth: true },
}

// ---------------------------------------------------------------------------
// GET — Leaderboard
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const parsed = leaderboardSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { competitionId, trackId, round } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const knex = em.getKnex()

  // Check competition stage for access control
  const competition = await knex('competitions_competition')
    .where('id', competitionId)
    .first()

  if (!competition) {
    return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
  }

  const stage = competition.stage as string
  const isAdmin = ctx.auth?.features?.includes('judging.results.view')
  const isPortalUser = !!ctx.auth?.customerUserId

  // Admin: available during DELIBERATION+
  // Portal: only after FINISHED (403 otherwise)
  if (isPortalUser && !isAdmin) {
    if (!['FINISHED', 'ARCHIVED'].includes(stage)) {
      return NextResponse.json(
        { error: 'Results are not yet available. Please wait for the competition to finish.' },
        { status: 403 },
      )
    }
  } else if (!isAdmin) {
    if (!['DELIBERATION', 'FINISHED', 'ARCHIVED'].includes(stage)) {
      return NextResponse.json(
        { error: 'Leaderboard is not yet available at this stage.' },
        { status: 403 },
      )
    }
  }

  const scoringService = new ScoringService(em)
  const leaderboard = await scoringService.computeLeaderboard(competitionId, trackId, round)

  return NextResponse.json({
    leaderboard,
    competitionId,
    trackId: trackId ?? null,
    round: round ?? null,
    stage,
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  GET: {
    summary: 'Get leaderboard',
    description: 'Returns ranked projects by average score. Admin: available during DELIBERATION+. Portal users: only after FINISHED.',
    tags: [judgingTag],
    responses: {
      200: { description: 'Leaderboard data' },
      400: { description: 'Invalid query', content: { 'application/json': { schema: errorSchema } } },
      403: { description: 'Results not yet available', content: { 'application/json': { schema: errorSchema } } },
      404: { description: 'Competition not found', content: { 'application/json': { schema: errorSchema } } },
    },
  },
}
