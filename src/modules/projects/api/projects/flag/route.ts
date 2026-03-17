import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { z } from 'zod'
import { Project } from '../../../data/entities'
import { flagProjectSchema } from '../../../data/validators'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['projects.flag'] },
}

export async function POST(req: NextRequest, ctx: Record<string, unknown>): Promise<Response> {
  try {
    const container = ctx.container as import('awilix').AwilixContainer
    const auth = ctx.auth as Record<string, unknown> | undefined
    const tenantId = auth?.tenantId as string | undefined
    const organizationId = (ctx.selectedOrganizationId ?? auth?.orgId) as string | undefined
    const userId = auth?.userId as string | undefined

    if (!tenantId || !organizationId) {
      return Response.json({ error: 'Tenant context is required' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = flagProjectSchema.parse(body)

    const em = container.resolve('em') as EntityManager

    const project = await em.findOne(Project, {
      id: parsed.projectId,
      tenantId,
      organizationId,
    } as FilterQuery<Project>)

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 })
    }

    project.flaggedForReuse = true
    project.flaggedBy = userId ?? null
    project.flaggedAt = new Date()
    project.flaggedReason = parsed.reason
    await em.flush()

    // Emit flagged event
    try {
      const { emitProjectsEvent } = await import('../../../events')
      await emitProjectsEvent('projects.project.flagged', {
        id: project.id,
        teamId: project.teamId,
        competitionId: project.competitionId,
        reason: parsed.reason,
        flaggedBy: userId,
        tenantId,
        organizationId,
      })
    } catch {
      // non-critical
    }

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'Validation error', details: err.errors }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  POST: {
    tags: ['Projects'],
    summary: 'Flag a project for code reuse',
    description: 'Marks a project as flagged for suspected code reuse. Requires projects.flag feature.',
    requestBody: {
      content: {
        'application/json': {
          schema: flagProjectSchema,
        },
      },
    },
    responses: {
      200: {
        description: 'Project flagged successfully',
        content: {
          'application/json': {
            schema: z.object({ ok: z.literal(true) }),
          },
        },
      },
      400: { description: 'Validation error' },
      404: { description: 'Project not found' },
    },
  },
}
