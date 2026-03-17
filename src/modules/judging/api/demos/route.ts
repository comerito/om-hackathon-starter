import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { listDemoSchema, generateQueueSchema, demoSessionListItemSchema } from '../../data/validators'
import { DemoTimerService } from '../../lib/DemoTimerService'
import { judgingTag, errorSchema, okSchema } from '../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  GET: { requireAuth: true },
  POST: { requireAuth: true, requireFeatures: ['judging.demos.manage'] },
}

// ---------------------------------------------------------------------------
// GET — List demo sessions
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  _ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const parsed = listDemoSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const q = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const knex = em.getKnex()

  let query = knex('judging_demo_session as d')
    .select(
      'd.id', 'd.competition_id', 'd.team_id', 'd.project_id', 'd.track_id',
      'd.presentation_order', 'd.scheduled_start',
      'd.presentation_duration_minutes', 'd.qa_duration_minutes',
      'd.status', 'd.actual_start', 'd.actual_end', 'd.round',
      'd.created_at', 'd.updated_at',
    )

  if (q.competitionId) query = query.where('d.competition_id', q.competitionId)
  if (q.round) query = query.where('d.round', q.round)
  if (q.status) query = query.where('d.status', q.status)

  const sortField = q.sortField === 'presentation_order' ? 'd.presentation_order' : `d.${q.sortField}`
  query = query.orderBy(sortField, q.sortDir)

  const offset = (q.page - 1) * q.pageSize
  const countQuery = query.clone().clearSelect().clearOrder().count('* as total').first()
  const [countResult, items] = await Promise.all([
    countQuery,
    query.limit(q.pageSize).offset(offset),
  ])

  const total = Number((countResult as Record<string, unknown>)?.total ?? 0)

  return NextResponse.json({
    items: items.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      competitionId: String(row.competition_id),
      teamId: String(row.team_id),
      projectId: String(row.project_id),
      trackId: String(row.track_id),
      presentationOrder: Number(row.presentation_order),
      scheduledStart: row.scheduled_start ? new Date(row.scheduled_start as string).toISOString() : null,
      presentationDurationMinutes: Number(row.presentation_duration_minutes),
      qaDurationMinutes: Number(row.qa_duration_minutes),
      status: String(row.status),
      actualStart: row.actual_start ? new Date(row.actual_start as string).toISOString() : null,
      actualEnd: row.actual_end ? new Date(row.actual_end as string).toISOString() : null,
      round: String(row.round),
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.ceil(total / q.pageSize),
  })
}

// ---------------------------------------------------------------------------
// POST — Generate demo queue
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = generateQueueSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { competitionId, round } = parsed.data
  const tenantId = ctx.auth?.tenantId
  const organizationId = (ctx as unknown as { selectedOrganizationId?: string }).selectedOrganizationId ?? ctx.auth?.orgId
  if (!tenantId || !organizationId) {
    return NextResponse.json({ error: 'Tenant and organization required' }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const demoTimerService = new DemoTimerService(em)

  const result = await demoTimerService.generateQueue(competitionId, round, tenantId, organizationId)

  // Emit queue updated event
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }
    const eventPayload = {
      competitionId,
      round,
      created: result.created,
      tenantId,
      organizationId,
    }
    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('judging.demo.queue_updated', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('judging.demo.queue_updated', eventPayload)
    }
  } catch (err) {
    console.warn('[judging] Failed to emit demo.queue_updated event', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  GET: {
    summary: 'List demo sessions',
    description: 'Returns demo sessions for a competition, optionally filtered by round and status.',
    tags: [judgingTag],
    responses: {
      200: {
        description: 'Paginated list of demo sessions',
        content: { 'application/json': { schema: z.object({ items: z.array(demoSessionListItemSchema) }).passthrough() } },
      },
    },
  },
  POST: {
    summary: 'Generate demo queue',
    description: 'Creates demo sessions from published projects for a given competition and round.',
    tags: [judgingTag],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: generateQueueSchema } },
    },
    responses: {
      200: { description: 'Queue generated', content: { 'application/json': { schema: okSchema } } },
      400: { description: 'Invalid request', content: { 'application/json': { schema: errorSchema } } },
    },
  },
}
