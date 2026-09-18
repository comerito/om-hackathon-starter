/**
 * Server-side glue between the `ProjectGallerySubmission` sidecar and the pure
 * gallery rules. Reads only — callers own the writes and the flush.
 */

import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { z } from 'zod'
import { GalleryStatus, ProjectGallerySubmission } from '../../data/entities'
import type { GalleryImageInfo, GallerySubmissionCandidate } from '../submission-validation'
import { GALLERY_MAX_SCREENSHOTS, GALLERY_SUMMARY_MAX_LENGTH } from './render'

export const DEFAULT_GALLERY_SITE_URL = 'https://projects.openmercato.com'

export function resolveGallerySiteUrl(): string {
  return (process.env.GALLERY_SITE_URL || DEFAULT_GALLERY_SITE_URL).replace(/\/+$/, '')
}

/** The `gallery` object portal and backoffice clients send. Lenient: a draft may be half-filled. */
export const galleryInputSchema = z.object({
  publish_to_gallery: z.boolean().optional(),
  summary: z.string().max(GALLERY_SUMMARY_MAX_LENGTH).nullable().optional(),
  built_on_open_mercato: z.string().max(5000).nullable().optional(),
  screenshots: z
    .array(z.object({ attachment_id: z.string().uuid(), alt: z.string().max(300) }))
    .max(GALLERY_MAX_SCREENSHOTS)
    .optional(),
  poster_attachment_id: z.string().uuid().nullable().optional(),
  show_team_members: z.boolean().optional(),
  consent_accepted: z.boolean().optional(),
})
export type GalleryInput = z.infer<typeof galleryInputSchema>

export async function findGallerySubmissions(
  em: EntityManager,
  projectIds: readonly string[],
  scope: { tenantId: string; organizationId?: string | null },
): Promise<Map<string, ProjectGallerySubmission>> {
  const byProjectId = new Map<string, ProjectGallerySubmission>()
  if (projectIds.length === 0) return byProjectId

  const where: Record<string, unknown> = {
    projectId: { $in: [...projectIds] },
    tenantId: scope.tenantId,
    deletedAt: null,
  }
  if (scope.organizationId) where.organizationId = scope.organizationId

  const rows = await em.find(ProjectGallerySubmission, where as FilterQuery<ProjectGallerySubmission>)
  for (const row of rows) byProjectId.set(row.projectId, row)
  return byProjectId
}

/** Apply a client payload onto the sidecar. Never touches publication state except the opt-in itself. */
export function applyGalleryInput(
  submission: ProjectGallerySubmission,
  input: GalleryInput,
  actor: { customerUserId?: string | null },
): void {
  if (input.publish_to_gallery !== undefined) submission.publishToGallery = input.publish_to_gallery
  if (input.summary !== undefined) submission.summary = input.summary?.trim() || null
  if (input.built_on_open_mercato !== undefined) submission.builtOnOpenMercato = input.built_on_open_mercato?.trim() || null
  if (input.screenshots !== undefined) {
    submission.screenshots = input.screenshots.map((s) => ({ attachment_id: s.attachment_id, alt: s.alt.trim() }))
  }
  if (input.poster_attachment_id !== undefined) submission.posterAttachmentId = input.poster_attachment_id
  if (input.show_team_members !== undefined) submission.showTeamMembers = input.show_team_members
  if (input.consent_accepted !== undefined) {
    if (!input.consent_accepted) {
      submission.consentAcceptedAt = null
      submission.consentAcceptedBy = null
    } else if (!submission.consentAcceptedAt) {
      submission.consentAcceptedAt = new Date()
      submission.consentAcceptedBy = actor.customerUserId ?? null
    }
  }
}

export function toGalleryCandidate(submission: ProjectGallerySubmission | null | undefined): GallerySubmissionCandidate | null {
  if (!submission) return null
  return {
    publishToGallery: submission.publishToGallery,
    summary: submission.summary ?? null,
    builtOnOpenMercato: submission.builtOnOpenMercato ?? null,
    screenshots: (submission.screenshots ?? []).map((s) => ({ attachmentId: s.attachment_id, alt: s.alt })),
    posterAttachmentId: submission.posterAttachmentId ?? null,
    consentAccepted: Boolean(submission.consentAcceptedAt),
  }
}

/** Mime type and size of every screenshot the given sidecars picked, keyed by attachment id. */
export async function loadGalleryImages(
  em: EntityManager,
  submissions: Iterable<ProjectGallerySubmission | null | undefined>,
): Promise<Record<string, GalleryImageInfo>> {
  const ids = new Set<string>()
  for (const submission of submissions) {
    if (!submission?.publishToGallery) continue
    for (const screenshot of submission.screenshots ?? []) ids.add(screenshot.attachment_id)
  }
  if (ids.size === 0) return {}

  const attachments = await em.find(Attachment, { id: { $in: [...ids] } } as FilterQuery<Attachment>)
  const images: Record<string, GalleryImageInfo> = {}
  for (const attachment of attachments) {
    images[attachment.id] = { mimeType: attachment.mimeType, fileSize: attachment.fileSize }
  }
  return images
}

export function serializeGallerySubmission(submission: ProjectGallerySubmission | null | undefined) {
  return {
    publish_to_gallery: submission?.publishToGallery ?? false,
    summary: submission?.summary ?? null,
    built_on_open_mercato: submission?.builtOnOpenMercato ?? null,
    screenshots: submission?.screenshots ?? [],
    poster_attachment_id: submission?.posterAttachmentId ?? null,
    show_team_members: submission?.showTeamMembers ?? false,
    consent_accepted: Boolean(submission?.consentAcceptedAt),
    status: submission?.status ?? GalleryStatus.NOT_REQUESTED,
    pr_url: submission?.prUrl ?? null,
    live_url: submission?.liveUrl ?? null,
    rejected_reason: submission?.rejectedReason ?? null,
  }
}
