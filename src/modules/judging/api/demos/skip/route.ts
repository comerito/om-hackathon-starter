import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { skipDemoSchema } from '../../../data/validators'
import { DemoTimerService } from '../../../lib/DemoTimerService'
import { judgingTag, errorSchema, okSchema } from '../../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['judging.demos.manage'] },
}

// ---------------------------------------------------------------------------
// POST — Skip demo
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = skipDemoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { demoId } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const demoTimerService = new DemoTimerService(em)

  let demo: Awaited<ReturnType<typeof demoTimerService.skipDemo>>
  try {
    demo = await demoTimerService.skipDemo(demoId)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to skip demo' },
      { status: 422 },
    )
  }

  const serverTime = new Date().toISOString()

  // Emit status changed event
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }
    const eventPayload = {
      demoId: demo.id,
      competitionId: demo.competition_id,
      teamId: demo.team_id,
      projectId: demo.project_id,
      previousStatus: 'unknown',
      newStatus: 'SKIPPED',
      serverTime,
      tenantId: demo.tenant_id,
      organizationId: demo.organization_id,
    }
    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('judging.demo.status_changed', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('judging.demo.status_changed', eventPayload)
    }
  } catch (err) {
    console.warn('[judging] Failed to emit demo.status_changed event', {
      demoId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({
    ok: true,
    demo: {
      id: demo.id,
      status: demo.status,
    },
    serverTime,
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Skip a demo session',
    description: 'Marks a demo session as SKIPPED.',
    tags: [judgingTag],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: skipDemoSchema } },
    },
    responses: {
      200: { description: 'Demo skipped', content: { 'application/json': { schema: okSchema } } },
      400: { description: 'Invalid request', content: { 'application/json': { schema: errorSchema } } },
      422: { description: 'Cannot skip demo', content: { 'application/json': { schema: errorSchema } } },
    },
  },
}
