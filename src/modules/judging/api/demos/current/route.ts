import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { DemoTimerService } from '../../../lib/DemoTimerService'
import { judgingTag, errorSchema } from '../../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  GET: { requireAuth: true },
}

// ---------------------------------------------------------------------------
// GET — Current active demo
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  _ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const url = new URL(req.url)
  const competitionId = url.searchParams.get('competitionId')
  if (!competitionId) {
    return NextResponse.json({ error: 'competitionId is required' }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const demoTimerService = new DemoTimerService(em)
  const knex = em.getKnex()

  const current = await demoTimerService.getCurrentDemo(competitionId)

  if (!current) {
    return NextResponse.json({ current: null, serverTime: new Date().toISOString() })
  }

  // Enrich with team name and project title
  const [team, project] = await Promise.all([
    knex('teams_team').where('id', current.team_id).select('name').first(),
    knex('projects_project').where('id', current.project_id).select('title').first(),
  ])

  // Also get the next queued demo (on-deck info)
  const nextQueued = await demoTimerService.getNextQueued(competitionId)

  let onDeck: Record<string, unknown> | null = null
  if (nextQueued) {
    const [onDeckTeam, onDeckProject] = await Promise.all([
      knex('teams_team').where('id', nextQueued.team_id).select('name').first(),
      knex('projects_project').where('id', nextQueued.project_id).select('title').first(),
    ])
    onDeck = {
      id: nextQueued.id,
      teamId: nextQueued.team_id,
      teamName: onDeckTeam?.name ?? null,
      projectId: nextQueued.project_id,
      projectTitle: onDeckProject?.title ?? null,
      presentationOrder: nextQueued.presentation_order,
    }
  }

  return NextResponse.json({
    current: {
      id: current.id,
      competitionId: current.competition_id,
      teamId: current.team_id,
      teamName: team?.name ?? null,
      projectId: current.project_id,
      projectTitle: project?.title ?? null,
      trackId: current.track_id,
      presentationOrder: current.presentation_order,
      presentationDurationMinutes: current.presentation_duration_minutes,
      qaDurationMinutes: current.qa_duration_minutes,
      status: current.status,
      actualStart: current.actual_start,
      round: current.round,
    },
    onDeck,
    serverTime: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  GET: {
    summary: 'Get current active demo',
    description: 'Returns the currently presenting or on-deck demo session with enriched team/project info.',
    tags: [judgingTag],
    responses: {
      200: { description: 'Current demo session data' },
      400: { description: 'Missing competitionId', content: { 'application/json': { schema: errorSchema } } },
    },
  },
}
