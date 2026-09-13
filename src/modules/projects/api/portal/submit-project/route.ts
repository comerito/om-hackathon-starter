import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Project, ProjectStatus } from '../../../data/entities'
import { TeamMember } from '../../../../teams/data/entities'
import { Competition } from '../../../../competitions/data/entities'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { collectProjectSubmissionErrors } from '../../../lib/submission-validation'
import { meetsMinimumTeamSize } from '../../../../teams/lib/team-size'
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

    // Validate required fields — the same rules the `demos` stage transition applies
    // to the drafts it auto-publishes (see lib/submission-validation.ts).
    const attachmentIds = project.attachmentIds ?? []
    const attachments = attachmentIds.length > 0
      ? await em.find(Attachment, { id: { $in: attachmentIds } } as FilterQuery<Attachment>)
      : []
    const errors = collectProjectSubmissionErrors(project, {
      attachmentFileNames: attachments.map((attachment) => attachment.fileName),
    })

    // The competition's minimum team size is a submission requirement too: an
    // undersized team must not be able to enter. Checked here rather than inside
    // the shared rule module because it is a property of the team, not the project.
    if (competition) {
      const memberCount = await em.count(TeamMember, {
        teamId: project.teamId,
        deletedAt: null,
      } as FilterQuery<TeamMember>)
      const teamSize = meetsMinimumTeamSize(competition, { memberCount })
      if (!teamSize.allowed) errors.push(teamSize.reason)
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 422 })
    }

    // Submit: DRAFT → PUBLISHED
    project.status = ProjectStatus.PUBLISHED
    project.submittedAt = new Date()
    project.updatedAt = new Date()
    em.persist(project)
    await em.flush()

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
