import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Project, ProjectStatus } from '../../../data/entities'
import { TeamMember } from '../../../../teams/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const updateSchema = z.object({
  project_id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  tagline: z.string().max(140).nullable().optional(),
  description: z.string().nullable().optional(),
  problem_statement: z.string().nullable().optional(),
  solution: z.string().nullable().optional(),
  tech_stack: z.array(z.string()).optional(),
  demo_url: z.string().max(1000).nullable().optional(),
  repo_url: z.string().max(1000).nullable().optional(),
  video_url: z.string().max(1000).nullable().optional(),
  presentation_url: z.string().max(1000).nullable().optional(),
  screenshot_ids: z.array(z.string().uuid()).optional(),
  attachment_ids: z.array(z.string().uuid()).optional(),
  uses_preexisting_code: z.boolean().optional(),
  preexisting_code_description: z.string().nullable().optional(),
  built_during_hackathon_description: z.string().nullable().optional(),
})

export const metadata = {
  PUT: { requireCustomerAuth: true },
}

export async function PUT(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = updateSchema.parse(body)

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

    // Verify user is a team member
    const membership = await em.findOne(TeamMember, {
      customerUserId: auth.sub,
      teamId: project.teamId,
      deletedAt: null,
    } as FilterQuery<TeamMember>)

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 })
    }

    // Only allow editing DRAFT projects (unless admin override — handled via backend route)
    if (project.status !== ProjectStatus.DRAFT) {
      return NextResponse.json({ error: 'Project has been submitted and cannot be edited' }, { status: 409 })
    }

    // Apply updates
    if (parsed.title !== undefined) project.title = parsed.title
    if (parsed.tagline !== undefined) project.tagline = parsed.tagline
    if (parsed.description !== undefined) project.description = parsed.description
    if (parsed.problem_statement !== undefined) project.problemStatement = parsed.problem_statement
    if (parsed.solution !== undefined) project.solution = parsed.solution
    if (parsed.tech_stack !== undefined) project.techStack = parsed.tech_stack
    if (parsed.demo_url !== undefined) project.demoUrl = parsed.demo_url || null
    if (parsed.repo_url !== undefined) project.repoUrl = parsed.repo_url || null
    if (parsed.video_url !== undefined) project.videoUrl = parsed.video_url || null
    if (parsed.presentation_url !== undefined) project.presentationUrl = parsed.presentation_url || null
    if (parsed.screenshot_ids !== undefined) project.screenshotIds = parsed.screenshot_ids
    if (parsed.attachment_ids !== undefined) project.attachmentIds = parsed.attachment_ids
    if (parsed.uses_preexisting_code !== undefined) project.usesPreexistingCode = parsed.uses_preexisting_code
    if (parsed.preexisting_code_description !== undefined) project.preexistingCodeDescription = parsed.preexisting_code_description
    if (parsed.built_during_hackathon_description !== undefined) project.builtDuringHackathonDescription = parsed.built_during_hackathon_description

    project.updatedAt = new Date()
    await em.persistAndFlush(project)

    return NextResponse.json({ ok: true, updated_at: project.updatedAt.toISOString() })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/update-project] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Update project',
  methods: { PUT: { summary: 'Update team project (draft only)' } },
}
