import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { selectFinalistsSchema } from '../../data/validators'
import { judgingTag, errorSchema, okSchema } from '../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['judging.finalists.manage'] },
}

// ---------------------------------------------------------------------------
// POST — Select finalists
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = selectFinalistsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { competitionId, projectIds } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const knex = em.getKnex()

  // Get team IDs for the selected projects
  const projects = await knex('projects_project')
    .where('competition_id', competitionId)
    .whereIn('id', projectIds)
    .select('id', 'team_id')

  if (projects.length === 0) {
    return NextResponse.json({ error: 'No matching projects found' }, { status: 404 })
  }

  const teamIds = projects.map((p: { team_id: string }) => p.team_id)

  // Reset all teams' finalist status for this competition
  await knex('teams_team')
    .where('competition_id', competitionId)
    .update({ is_finalist: false })

  // Mark selected teams as finalists
  await knex('teams_team')
    .whereIn('id', teamIds)
    .update({ is_finalist: true })

  // Emit event
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }
    const eventPayload = {
      competitionId,
      projectIds,
      teamIds,
      count: projectIds.length,
      tenantId: ctx.auth?.tenantId,
      organizationId: (ctx as unknown as { selectedOrganizationId?: string }).selectedOrganizationId ?? ctx.auth?.orgId,
      selectedBy: ctx.auth?.sub ?? null,
    }
    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('judging.finalists.selected', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('judging.finalists.selected', eventPayload)
    }
  } catch (err) {
    console.warn('[judging] Failed to emit finalists.selected event', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({
    ok: true,
    finalistCount: projectIds.length,
    teamIds,
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Select finalists',
    description: 'Marks selected projects/teams as finalists for the final round.',
    tags: [judgingTag],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: selectFinalistsSchema } },
    },
    responses: {
      200: { description: 'Finalists selected', content: { 'application/json': { schema: okSchema } } },
      400: { description: 'Invalid request', content: { 'application/json': { schema: errorSchema } } },
      404: { description: 'No matching projects', content: { 'application/json': { schema: errorSchema } } },
    },
  },
}
