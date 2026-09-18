import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { ProjectGallerySubmission } from '../../../data/entities'
import { resolveGalleryAdminContext, runGalleryMutationGuards } from '../../../lib/gallery/adminContext'
import { buildGalleryProject } from '../../../lib/gallery/build'
import { resolveGalleryGithubConfig } from '../../../lib/gallery/github'
import { applyGalleryInput, galleryInputSchema, resolveGallerySiteUrl, serializeGallerySubmission } from '../../../lib/gallery/submission'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['projects.view'] },
  PUT: { requireAuth: true, requireFeatures: ['projects.edit'] },
}

const updateSchema = galleryInputSchema.omit({ consent_accepted: true }).extend({ project_id: z.string().uuid() })

/** Gallery state of one project plus a preview of the exact file that would be committed. */
export async function GET(req: Request) {
  try {
    const projectId = z.string().uuid().safeParse(new URL(req.url).searchParams.get('project_id'))
    if (!projectId.success) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

    const ctx = await resolveGalleryAdminContext(req, projectId.data)
    if ('response' in ctx) return ctx.response

    const build = await buildGalleryProject(ctx.em, ctx.project, ctx.submission)
    const config = resolveGalleryGithubConfig()

    return NextResponse.json({
      gallery: { ...serializeGallerySubmission(ctx.submission), slug: ctx.submission?.slug ?? null, pr_number: ctx.submission?.prNumber ?? null },
      project_status: ctx.project.status,
      configured: Boolean(config),
      repo: config?.repo ?? null,
      site_url: resolveGallerySiteUrl(),
      preview: {
        slug: build.slug,
        errors: build.errors,
        markdown_path: build.render?.markdownPath ?? null,
        markdown: build.render?.markdown ?? null,
        assets: (build.render?.assets ?? []).map((asset) => ({
          path: asset.path,
          attachment_id: asset.attachmentId,
          file_name: build.attachmentsById.get(asset.attachmentId)?.fileName ?? null,
        })),
      },
    })
  } catch (error) {
    console.error('[projects/admin/gallery] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Organizer copy polish. Consent is the team's to give, so it cannot be set from here. */
export async function PUT(req: Request) {
  try {
    const requested = updateSchema.parse(await req.json())
    const ctx = await resolveGalleryAdminContext(req, requested.project_id)
    if ('response' in ctx) return ctx.response

    const guard = await runGalleryMutationGuards(req, ctx, { ...requested })
    if (!guard.ok) return guard.response
    const parsed = guard.modifiedPayload ? updateSchema.parse({ ...requested, ...guard.modifiedPayload }) : requested

    const submission = ctx.submission ?? ctx.em.create(ProjectGallerySubmission, {
      projectId: ctx.project.id,
      tenantId: ctx.project.tenantId,
      organizationId: ctx.project.organizationId,
    } as ProjectGallerySubmission)
    applyGalleryInput(submission, parsed, {})
    submission.updatedAt = new Date()
    ctx.em.persist(submission)
    await ctx.em.flush()

    await guard.runAfterSuccess()
    return NextResponse.json({ ok: true, gallery: serializeGallerySubmission(submission) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[projects/admin/gallery] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Projects',
  summary: 'Project gallery publication',
  methods: {
    GET: { summary: 'Gallery state and markdown preview for one project' },
    PUT: { summary: 'Edit the gallery fields of one project' },
  },
}
