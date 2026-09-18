/**
 * The submission requirements a project has to satisfy before it counts as a
 * real entry.
 *
 * There are two paths that turn a DRAFT project into a PUBLISHED one:
 *
 *  - the participant path — `api/portal/submit-project`, driven by the team owner;
 *  - the organiser path — `subscribers/publish-draft-projects`, driven by the
 *    `demos` stage transition.
 *
 * Both MUST apply the same rules, otherwise ignoring the deadline is cheaper than
 * complying with it. This module is the single definition, kept pure so it can be
 * unit-tested without a database.
 */

import {
  GALLERY_MAX_IMAGE_BYTES,
  GALLERY_MAX_SCREENSHOTS,
  GALLERY_MIN_SCREENSHOTS,
  GALLERY_SUMMARY_MAX_LENGTH,
  galleryImageExtension,
} from './gallery/render'
import { parseGalleryVideoUrl } from './gallery/video'

export const README_FILE_NAME = 'readme.md'

/** The subset of `Project` the submission rules actually read. */
export type ProjectSubmissionCandidate = {
  title?: string | null
  description?: string | null
  usesPreexistingCode?: boolean | null
  preexistingCodeDescription?: string | null
  attachmentIds?: string[] | null
  videoUrl?: string | null
  screenshotIds?: string[] | null
}

/** The team's opt-in to the Open Mercato Project Gallery (SPEC-008). */
export type GallerySubmissionCandidate = {
  publishToGallery: boolean
  summary?: string | null
  builtOnOpenMercato?: string | null
  screenshots?: ReadonlyArray<{ attachmentId: string; alt?: string | null }> | null
  posterAttachmentId?: string | null
  consentAccepted: boolean
}

export type GalleryImageInfo = { mimeType: string; fileSize: number }

export type ProjectSubmissionContext = {
  /** File names of the attachments referenced by `attachmentIds`, in any order. */
  attachmentFileNames: readonly string[]
  /** Absent or not opted in: the gallery rules do not apply at all. */
  gallery?: GallerySubmissionCandidate | null
  /** Mime type and size of the screenshots picked for the gallery, by attachment id. */
  galleryImages?: Readonly<Record<string, GalleryImageInfo>>
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0
}

/** True when one of the project's attachments is the mandatory `README.md`. */
export function hasReadmeAttachment(fileNames: readonly string[]): boolean {
  return fileNames.some((name) => typeof name === 'string' && name.trim().toLowerCase() === README_FILE_NAME)
}

/**
 * Reasons an opted-in project cannot go to the gallery. Empty when the team did
 * not opt in — the gallery must never make a plain submission harder.
 */
export function collectGallerySubmissionErrors(
  project: Pick<ProjectSubmissionCandidate, 'videoUrl' | 'screenshotIds'>,
  context: Pick<ProjectSubmissionContext, 'gallery' | 'galleryImages'>,
): string[] {
  const gallery = context.gallery
  if (!gallery?.publishToGallery) return []

  const errors: string[] = []

  if (isBlank(gallery.summary)) errors.push('Gallery summary is required')
  else if (gallery.summary!.trim().length > GALLERY_SUMMARY_MAX_LENGTH) {
    errors.push(`Gallery summary must be at most ${GALLERY_SUMMARY_MAX_LENGTH} characters`)
  }
  if (isBlank(gallery.builtOnOpenMercato)) errors.push('"Built on Open Mercato" description is required for the gallery')
  if (!parseGalleryVideoUrl(project.videoUrl)) errors.push('The gallery needs a YouTube or Loom video link')

  const screenshots = gallery.screenshots ?? []
  if (screenshots.length < GALLERY_MIN_SCREENSHOTS || screenshots.length > GALLERY_MAX_SCREENSHOTS) {
    errors.push(`Pick ${GALLERY_MIN_SCREENSHOTS} to ${GALLERY_MAX_SCREENSHOTS} screenshots for the gallery`)
  }

  const uploaded = new Set(project.screenshotIds ?? [])
  const picked = new Set<string>()
  for (const screenshot of screenshots) {
    if (!uploaded.has(screenshot.attachmentId) || picked.has(screenshot.attachmentId)) {
      errors.push('Gallery screenshots must be distinct uploaded project screenshots')
      break
    }
    picked.add(screenshot.attachmentId)
  }
  if (screenshots.some((screenshot) => isBlank(screenshot.alt))) {
    errors.push('Every gallery screenshot needs a description (alt text)')
  }

  const images = context.galleryImages ?? {}
  for (const screenshot of screenshots) {
    const image = images[screenshot.attachmentId]
    if (!image) continue
    if (!galleryImageExtension(image.mimeType)) {
      errors.push('Gallery screenshots must be PNG, JPG, WebP or SVG')
      break
    }
  }
  if (screenshots.some((screenshot) => (images[screenshot.attachmentId]?.fileSize ?? 0) > GALLERY_MAX_IMAGE_BYTES)) {
    errors.push('Gallery screenshots must be 5 MB or smaller')
  }

  if (!gallery.posterAttachmentId || !picked.has(gallery.posterAttachmentId)) {
    errors.push('Choose one of the gallery screenshots as the poster')
  }
  if (!gallery.consentAccepted) errors.push('Confirm the publication consent for the gallery')

  return errors
}

/**
 * Every reason the project cannot be submitted, as user-facing strings.
 * An empty array means the project satisfies every submission requirement.
 */
export function collectProjectSubmissionErrors(
  project: ProjectSubmissionCandidate,
  context: ProjectSubmissionContext,
): string[] {
  const errors: string[] = []

  if (isBlank(project.title)) errors.push('Title is required')
  if (isBlank(project.description)) errors.push('Description is required')
  if (project.usesPreexistingCode && isBlank(project.preexistingCodeDescription)) {
    errors.push('Pre-existing code description is required when declaring code reuse')
  }

  const attachmentIds = project.attachmentIds ?? []
  if (attachmentIds.length === 0) {
    errors.push('README.md feedback file is required')
  } else if (!hasReadmeAttachment(context.attachmentFileNames)) {
    errors.push('Upload a README.md feedback file before submitting')
  }

  errors.push(...collectGallerySubmissionErrors(project, context))

  return errors
}

/** Convenience predicate over {@link collectProjectSubmissionErrors}. */
export function isProjectReadyForSubmission(
  project: ProjectSubmissionCandidate,
  context: ProjectSubmissionContext,
): boolean {
  return collectProjectSubmissionErrors(project, context).length === 0
}

export type SubmissionReadinessPartition<T> = {
  /** Drafts that may be auto-published — they meet every submission requirement. */
  ready: T[]
  /** Drafts that must stay DRAFT, each with the reasons to report. */
  incomplete: Array<{ project: T; reasons: string[] }>
}

/**
 * Split a batch of drafts into the ones the `demos` transition may publish and the
 * ones it must leave alone. Pure: the caller resolves attachment names up front so
 * this never has to touch the EntityManager mid-flush.
 */
export function partitionBySubmissionReadiness<T extends ProjectSubmissionCandidate>(
  projects: readonly T[],
  attachmentFileNamesFor: (project: T) => readonly string[],
  galleryContextFor?: (project: T) => Pick<ProjectSubmissionContext, 'gallery' | 'galleryImages'>,
): SubmissionReadinessPartition<T> {
  const partition: SubmissionReadinessPartition<T> = { ready: [], incomplete: [] }

  for (const project of projects) {
    const reasons = collectProjectSubmissionErrors(project, {
      attachmentFileNames: attachmentFileNamesFor(project),
      ...galleryContextFor?.(project),
    })
    if (reasons.length === 0) partition.ready.push(project)
    else partition.incomplete.push({ project, reasons })
  }

  return partition
}
