import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { GalleryStatus } from '../../../../data/entities'
import { emitGalleryEvent, resolveGalleryAdminContext, runGalleryMutationGuards } from '../../../../lib/gallery/adminContext'
import { GalleryGithubError, createGalleryGithubClient, resolveGalleryGithubConfig } from '../../../../lib/gallery/github'
import { resolveGallerySiteUrl } from '../../../../lib/gallery/submission'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['projects.gallery_publish'] },
}

const refreshSchema = z.object({ project_id: z.string().uuid() })

/** Re-read the pull request: merged means live, closed without merge means not accepted. */
export async function POST(req: Request) {
  try {
    const requested = refreshSchema.parse(await req.json())
    const ctx = await resolveGalleryAdminContext(req, requested.project_id)
    if ('response' in ctx) return ctx.response
    const { em, submission } = ctx

    const config = resolveGalleryGithubConfig()
    if (!config) {
      return NextResponse.json({ error: 'Gallery publishing is not configured (GALLERY_GITHUB_TOKEN is missing)' }, { status: 503 })
    }
    if (!submission?.prNumber) {
      return NextResponse.json({ error: 'No gallery pull request has been opened for this project' }, { status: 409 })
    }

    const guard = await runGalleryMutationGuards(req, ctx, { ...requested, action: 'gallery_refresh' })
    if (!guard.ok) return guard.response

    const pr = await createGalleryGithubClient(config).getPullRequest(submission.prNumber)
    const previousStatus = submission.status

    if (pr.merged) {
      submission.status = GalleryStatus.PUBLISHED
      submission.liveUrl = `${resolveGallerySiteUrl()}/projects/${submission.slug}`
      submission.publishedAt = submission.publishedAt ?? new Date()
    } else if (pr.state === 'closed') {
      submission.status = GalleryStatus.REJECTED
      submission.rejectedReason = submission.rejectedReason ?? 'The gallery pull request was closed without being merged'
    } else {
      submission.status = GalleryStatus.PR_OPEN
    }
    submission.updatedAt = new Date()
    em.persist(submission)
    await em.flush()

    await guard.runAfterSuccess()
    if (submission.status !== previousStatus) {
      if (submission.status === GalleryStatus.PUBLISHED) {
        await emitGalleryEvent(ctx, 'projects.project.gallery_published', { liveUrl: submission.liveUrl })
      } else if (submission.status === GalleryStatus.REJECTED) {
        await emitGalleryEvent(ctx, 'projects.project.gallery_rejected', { reason: submission.rejectedReason })
      }
    }

    return NextResponse.json({ ok: true, status: submission.status, live_url: submission.liveUrl ?? null })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    if (error instanceof GalleryGithubError) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error('[projects/admin/gallery/refresh] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Projects',
  summary: 'Refresh gallery publication status',
  methods: { POST: { summary: 'Sync the gallery status of one project from its pull request' } },
}
