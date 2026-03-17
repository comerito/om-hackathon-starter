import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { z } from 'zod'
import { Project, ProjectStatus } from '../../../data/entities'
import { submitProjectSchema } from '../../../data/validators'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['portal.projects.submit'] },
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
    const parsed = submitProjectSchema.parse(body)

    const em = container.resolve('em') as EntityManager
    const knex = em.getKnex()

    // Load the project
    const project = await em.findOne(Project, {
      id: parsed.projectId,
      tenantId,
      organizationId,
    } as FilterQuery<Project>)

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 })
    }

    // Only DRAFT projects can be submitted
    if (project.status !== ProjectStatus.DRAFT) {
      return Response.json({ error: 'Only draft projects can be submitted' }, { status: 400 })
    }

    // Validate required fields for submission
    const errors: string[] = []
    if (!project.title || project.title.trim().length === 0) errors.push('Title is required')
    if (!project.description || project.description.trim().length === 0) errors.push('Description is required')
    if (project.usesPreexistingCode && (!project.preexistingCodeDescription || project.preexistingCodeDescription.trim().length === 0)) {
      errors.push('Pre-existing code description is required when using pre-existing code')
    }

    if (errors.length > 0) {
      return Response.json({ error: 'Missing required fields', details: errors }, { status: 400 })
    }

    // Check deadline (unless admin)
    const isAdmin = Array.isArray(auth?.features)
      ? (auth.features as string[]).some((f) => f === 'projects.*' || f === 'projects.manage')
      : false

    if (!isAdmin) {
      const [competition] = await knex('competitions_competition')
        .where({ id: project.competitionId })
        .select('project_submission_deadline')

      if (competition?.project_submission_deadline) {
        const deadline = new Date(competition.project_submission_deadline)
        if (new Date() > deadline) {
          return Response.json({ error: 'Submission deadline has passed' }, { status: 400 })
        }
      }
    }

    // Submit the project
    project.status = ProjectStatus.PUBLISHED
    project.submittedAt = new Date()
    await em.flush()

    // Emit submitted event
    try {
      const { emitProjectsEvent } = await import('../../../events')
      await emitProjectsEvent('projects.project.submitted', {
        id: project.id,
        teamId: project.teamId,
        competitionId: project.competitionId,
        trackId: project.trackId,
        tenantId,
        organizationId,
      })
    } catch {
      // non-critical
    }

    return Response.json({ ok: true, submittedAt: project.submittedAt.toISOString() })
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
    summary: 'Submit a project',
    description: 'Transitions a DRAFT project to PUBLISHED status and records the submission time. Validates required fields and checks the submission deadline.',
    requestBody: {
      content: {
        'application/json': {
          schema: submitProjectSchema,
        },
      },
    },
    responses: {
      200: {
        description: 'Project submitted successfully',
        content: {
          'application/json': {
            schema: z.object({
              ok: z.literal(true),
              submittedAt: z.string().datetime(),
            }),
          },
        },
      },
      400: { description: 'Validation error or deadline passed' },
      404: { description: 'Project not found' },
    },
  },
}
