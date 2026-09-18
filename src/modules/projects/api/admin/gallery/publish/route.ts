import { promises as fs } from 'fs'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveAttachmentAbsolutePath } from '@open-mercato/core/modules/attachments/lib/storage'
import { Competition } from '../../../../../competitions/data/entities'
import { GalleryStatus, ProjectStatus } from '../../../../data/entities'
import { emitGalleryEvent, resolveGalleryAdminContext, runGalleryMutationGuards } from '../../../../lib/gallery/adminContext'
import { buildGalleryProject } from '../../../../lib/gallery/build'
import {
  GalleryGithubError,
  createGalleryGithubClient,
  galleryBranchName,
  resolveGalleryGithubConfig,
  type GalleryCommitFile,
} from '../../../../lib/gallery/github'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['projects.gallery_publish'] },
}

const publishSchema = z.object({ project_id: z.string().uuid() })

/** Open (or update) the pull request that adds this project to the gallery repository. */
export async function POST(req: Request) {
  try {
    const requested = publishSchema.parse(await req.json())
    const ctx = await resolveGalleryAdminContext(req, requested.project_id)
    if ('response' in ctx) return ctx.response
    const { em, project, submission } = ctx

    const config = resolveGalleryGithubConfig()
    if (!config) {
      return NextResponse.json({ error: 'Gallery publishing is not configured (GALLERY_GITHUB_TOKEN is missing)' }, { status: 503 })
    }
    if (project.status === ProjectStatus.DRAFT) {
      return NextResponse.json({ error: 'The project has not been submitted yet' }, { status: 409 })
    }
    if (!submission?.publishToGallery) {
      return NextResponse.json({ error: 'The team did not opt in to the gallery' }, { status: 409 })
    }
    if (submission.status === GalleryStatus.PUBLISHED) {
      return NextResponse.json({ error: 'The project is already live in the gallery' }, { status: 409 })
    }

    const guard = await runGalleryMutationGuards(req, ctx, { ...requested, action: 'gallery_publish' })
    if (!guard.ok) return guard.response

    // ── Read phase: everything is resolved before the sidecar is mutated ──
    const github = createGalleryGithubClient(config)
    const build = await buildGalleryProject(em, project, submission, { isSlugTaken: (slug) => github.projectFileExists(slug) })
    if (build.errors.length > 0 || !build.render) {
      return NextResponse.json({ error: 'The project is not ready for the gallery', details: build.errors }, { status: 409 })
    }

    const competition = await em.findOne(Competition, { id: project.competitionId, tenantId: project.tenantId } as FilterQuery<Competition>)

    const files: GalleryCommitFile[] = [{ path: build.render.markdownPath, content: build.render.markdown }]
    for (const asset of build.render.assets) {
      const attachment = build.attachmentsById.get(asset.attachmentId)
      if (!attachment) return NextResponse.json({ error: 'A gallery screenshot file is missing' }, { status: 409 })
      const absolutePath = resolveAttachmentAbsolutePath(attachment.partitionCode, attachment.storagePath, attachment.storageDriver)
      try {
        files.push({ path: asset.path, content: await fs.readFile(absolutePath) })
      } catch {
        return NextResponse.json({ error: `Screenshot "${attachment.fileName}" is not available in storage` }, { status: 409 })
      }
    }

    // ── GitHub: one commit, then open the PR or refresh the one still open ──
    const branch = galleryBranchName(competition?.slug ?? 'hackathon', build.slug)
    const title = `Add ${project.title} (${build.competitionName})`
    const body = [
      submission.summary ?? '',
      '',
      `- **Team:** ${build.teamName}`,
      `- **Event:** ${build.competitionName}${build.trackName ? `, track: ${build.trackName}` : ''}`,
      `- **Hackathon project id:** \`${project.id}\``,
      '',
      'Submitted by the team through the hackathon portal with publication consent.',
      '',
      '### Maintainer checklist',
      '- [ ] Copy reads well and follows the gallery voice (no long dashes, ~400 words max)',
      '- [ ] Poster and screenshots look good at card and full size',
      '- [ ] Video plays from the project page',
      '- [ ] `npm run build` passes',
    ].join('\n')

    await github.commitToBranch(branch, `Add ${build.slug} from ${build.competitionName}`, files)

    let pr: { number: number; url: string } | null = null
    if (submission.prNumber) {
      const existing = await github.getPullRequest(submission.prNumber)
      if (existing.state === 'open') {
        await github.updatePullRequest(submission.prNumber, { title, body })
        pr = { number: submission.prNumber, url: existing.url }
      }
    }
    if (!pr) pr = await github.openPullRequest({ branch, title, body })

    // ── Write phase ──
    submission.slug = build.slug
    submission.prNumber = pr.number
    submission.prUrl = pr.url
    submission.status = GalleryStatus.PR_OPEN
    submission.rejectedReason = null
    submission.updatedAt = new Date()
    em.persist(submission)
    await em.flush()

    await guard.runAfterSuccess()
    await emitGalleryEvent(ctx, 'projects.project.gallery_pr_opened', { prUrl: pr.url, slug: build.slug })

    return NextResponse.json({ ok: true, pr_url: pr.url, pr_number: pr.number, slug: build.slug, status: submission.status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    if (error instanceof GalleryGithubError) {
      console.error('[projects/admin/gallery/publish] GitHub error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error('[projects/admin/gallery/publish] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Projects',
  summary: 'Publish a project to the gallery',
  methods: { POST: { summary: 'Open or update the gallery pull request for one project' } },
}
