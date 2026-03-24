import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Project, ProjectStatus } from '../../../data/entities'
import { TeamMember } from '../../../../teams/data/entities'
import { Competition } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const submitSchema = z.object({
  project_id: z.string().uuid(),
})

export const metadata = {
  POST: { requireCustomerAuth: true },
}

export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = submitSchema.parse(body)

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Find the project
    const project = await em.findOne(Project, {
      id: parsed.project_id,
      deletedAt: null,
    } as FilterQuery<Project>)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify user is team OWNER
    const membership = await em.findOne(TeamMember, {
      customerUserId: auth.sub,
      teamId: project.teamId,
      deletedAt: null,
    } as FilterQuery<TeamMember>)

    if (!membership || membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only the team owner can submit the project' }, { status: 403 })
    }

    // Only allow submitting DRAFT projects
    if (project.status !== ProjectStatus.DRAFT) {
      return NextResponse.json({ error: 'Project has already been submitted' }, { status: 409 })
    }

    // Check deadline
    const competition = await em.findOne(Competition, {
      id: project.competitionId,
      deletedAt: null,
    } as FilterQuery<Competition>)

    if (competition?.projectSubmissionDeadline) {
      const now = new Date()
      if (now > competition.projectSubmissionDeadline) {
        return NextResponse.json({
          error: 'Submission deadline has passed. Contact an organizer for an extension.',
        }, { status: 409 })
      }
    }

    // Validate required fields
    const errors: string[] = []
    if (!project.title || project.title.trim().length === 0) errors.push('Title is required')
    if (!project.description || project.description.trim().length === 0) errors.push('Description is required')
    if (project.usesPreexistingCode && (!project.preexistingCodeDescription || project.preexistingCodeDescription.trim().length === 0)) {
      errors.push('Pre-existing code description is required when declaring code reuse')
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 })
    }

    // Submit: DRAFT → PUBLISHED
    project.status = ProjectStatus.PUBLISHED
    project.submittedAt = new Date()
    project.updatedAt = new Date()
    await em.persistAndFlush(project)

    // Emit submitted event
    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('projects.project.submitted', {
        projectId: project.id,
        teamId: project.teamId,
        competitionId: project.competitionId,
        trackId: project.trackId,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      })
    } catch (e) {
      console.error('[portal/submit-project] Event emit error:', e)
    }

    return NextResponse.json({ ok: true, status: project.status, submitted_at: project.submittedAt.toISOString() })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/submit-project] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Submit project',
  methods: { POST: { summary: 'Submit project (DRAFT → PUBLISHED)' } },
}
