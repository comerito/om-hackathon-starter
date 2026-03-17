import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { z } from 'zod'
import { Project } from '../../../data/entities'
import { unflagProjectSchema } from '../../../data/validators'
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

    if (!tenantId || !organizationId) {
      return Response.json({ error: 'Tenant context is required' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = unflagProjectSchema.parse(body)

    const em = container.resolve('em') as EntityManager

    const project = await em.findOne(Project, {
      id: parsed.projectId,
      tenantId,
      organizationId,
    } as FilterQuery<Project>)

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 })
    }

    project.flaggedForReuse = false
    project.flaggedBy = null
    project.flaggedAt = null
    project.flaggedReason = null
    await em.flush()

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
    summary: 'Remove flag from a project',
    description: 'Clears the code reuse flag from a project. Requires projects.flag feature.',
    requestBody: {
      content: {
        'application/json': {
          schema: unflagProjectSchema,
        },
      },
    },
    responses: {
      200: {
        description: 'Flag removed successfully',
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
