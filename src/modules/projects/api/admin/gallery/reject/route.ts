import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { GalleryStatus } from '../../../../data/entities'
import { emitGalleryEvent, resolveGalleryAdminContext, runGalleryMutationGuards } from '../../../../lib/gallery/adminContext'
import { createGalleryGithubClient, resolveGalleryGithubConfig } from '../../../../lib/gallery/github'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['projects.gallery_publish'] },
}

const rejectSchema = z.object({ project_id: z.string().uuid(), reason: z.string().trim().min(1).max(1000) })

/** Decline a gallery request; closes the pull request when one is still open. */
export async function POST(req: Request) {
  try {
    const requested = rejectSchema.parse(await req.json())
    const ctx = await resolveGalleryAdminContext(req, requested.project_id)
    if ('response' in ctx) return ctx.response
    const { em, submission } = ctx

    if (!submission?.publishToGallery) {
      return NextResponse.json({ error: 'The team did not opt in to the gallery' }, { status: 409 })
    }
    if (submission.status === GalleryStatus.PUBLISHED) {
      return NextResponse.json({ error: 'The project is already live; remove it in the gallery repository instead' }, { status: 409 })
    }

    const guard = await runGalleryMutationGuards(req, ctx, { ...requested, action: 'gallery_reject' })
    if (!guard.ok) return guard.response

    // Best effort: the local decision stands even when GitHub is unreachable.
    let prCloseFailed = false
    const config = resolveGalleryGithubConfig()
    if (config && submission.prNumber && submission.status === GalleryStatus.PR_OPEN) {
      try {
        await createGalleryGithubClient(config).closePullRequest(submission.prNumber)
      } catch (e) {
        prCloseFailed = true
        console.error('[projects/admin/gallery/reject] Could not close the pull request:', e)
      }
    }

    submission.status = GalleryStatus.REJECTED
    submission.rejectedReason = requested.reason
    submission.updatedAt = new Date()
    em.persist(submission)
    await em.flush()

    await guard.runAfterSuccess()
    await emitGalleryEvent(ctx, 'projects.project.gallery_rejected', { reason: requested.reason })

    return NextResponse.json({ ok: true, status: submission.status, pr_close_failed: prCloseFailed })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[projects/admin/gallery/reject] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Projects',
  summary: 'Reject a gallery publication request',
  methods: { POST: { summary: 'Mark a gallery request as not accepted' } },
}
