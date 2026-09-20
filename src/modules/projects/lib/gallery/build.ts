/**
 * Assembles everything `renderGalleryProject` needs from the database. Reads only.
 */

import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { Competition } from '../../../competitions/data/entities'
import { Team, TeamMember } from '../../../teams/data/entities'
import { Track } from '../../../tracks/data/entities'
import type { Project, ProjectGallerySubmission } from '../../data/entities'
import { collectGallerySubmissionErrors } from '../submission-validation'
import { pickGallerySlug, renderGalleryProject, type GalleryRenderResult } from './render'
import { toGalleryCandidate } from './submission'
import { parseGalleryVideoUrl } from './video'

export type GalleryBuild = {
  slug: string
  /** Everything that stops this project from being published; empty when it is ready. */
  errors: string[]
  render: GalleryRenderResult | null
  attachmentsById: Map<string, Attachment>
  teamName: string
  trackName: string | null
  competitionName: string
}

export async function buildGalleryProject(
  em: EntityManager,
  project: Project,
  submission: ProjectGallerySubmission | null,
  options: { isSlugTaken?: (slug: string) => boolean | Promise<boolean> } = {},
): Promise<GalleryBuild> {
  const scope = { tenantId: project.tenantId, organizationId: project.organizationId }

  const [team, competition, track] = await Promise.all([
    em.findOne(Team, { id: project.teamId, ...scope } as FilterQuery<Team>),
    em.findOne(Competition, { id: project.competitionId, ...scope } as FilterQuery<Competition>),
    em.findOne(Track, { id: project.trackId, ...scope } as FilterQuery<Track>),
  ])
  const teamName = team?.name ?? 'Team'
  const competitionName = competition?.name ?? 'Open Mercato hackathon'

  const pickedIds = (submission?.screenshots ?? []).map((s) => s.attachment_id)
  const attachmentIds = [...new Set(pickedIds)]
  const attachments = attachmentIds.length > 0
    ? await em.find(Attachment, { id: { $in: attachmentIds }, ...scope } as FilterQuery<Attachment>)
    : []
  const attachmentsById = new Map(attachments.map((attachment) => [attachment.id, attachment]))

  const galleryImages = Object.fromEntries(
    pickedIds
      .map((id) => attachmentsById.get(id))
      .filter((a): a is Attachment => Boolean(a))
      .map((a) => [a.id, { mimeType: a.mimeType, fileSize: a.fileSize }]),
  )

  const errors: string[] = []
  if (!submission?.publishToGallery) errors.push('The team did not opt in to the gallery')
  if (!project.description?.trim()) errors.push('Description is required')
  errors.push(...collectGallerySubmissionErrors(project, { gallery: toGalleryCandidate(submission), galleryImages }))
  if (pickedIds.some((id) => !attachmentsById.has(id))) errors.push('A gallery screenshot file is missing')

  // The slug is frozen once stored: the public URL must stay stable.
  let slug = submission?.slug ?? ''
  if (!slug) {
    const taken = new Set<string>()
    const candidates = [project.title, `${project.title} ${teamName}`, `${project.title} ${teamName} ${competition?.slug ?? ''}`]
    if (options.isSlugTaken) {
      for (const candidate of candidates) {
        const probe = pickGallerySlug(candidate, [], () => false)
        if (await options.isSlugTaken(probe)) taken.add(probe)
      }
    }
    slug = pickGallerySlug(project.title, [teamName, competition?.slug ?? ''], (s) => taken.has(s))
  }

  const video = parseGalleryVideoUrl(project.videoUrl)
  if (errors.length > 0 || !submission || !video) {
    return { slug, errors, render: null, attachmentsById, teamName, trackName: track?.name ?? null, competitionName }
  }

  let teamMembers: string[] = []
  if (submission.showTeamMembers) {
    const members = await em.find(TeamMember, { teamId: project.teamId, deletedAt: null, ...scope } as FilterQuery<TeamMember>)
    const userIds = members.map((member) => member.customerUserId)
    if (userIds.length > 0) {
      // display_name is encryptable on customer_users: a raw select would publish ciphertext
      // once a tenant has encryption seeded.
      const users = await findWithDecryption(
        em,
        CustomerUser,
        { id: { $in: userIds }, tenantId: project.tenantId } as FilterQuery<CustomerUser>,
        undefined,
        scope,
      )
      // Display names only — never fall back to an e-mail address on a public page.
      teamMembers = users.map((user) => user.displayName?.trim() ?? '').filter(Boolean)
    }
  }

  const render = renderGalleryProject({
    slug,
    title: project.title,
    summary: submission.summary ?? '',
    video,
    projectUrl: project.demoUrl,
    repoUrl: project.repoUrl,
    teamName,
    competitionName,
    teamMembers,
    screenshots: submission.screenshots.map((s) => ({
      attachmentId: s.attachment_id,
      alt: s.alt,
      mimeType: attachmentsById.get(s.attachment_id)?.mimeType ?? '',
    })),
    posterAttachmentId: submission.posterAttachmentId ?? '',
    date: project.submittedAt ?? new Date(),
    tags: [...(project.techStack ?? []), track?.name ?? '', competitionName],
    description: project.description ?? '',
    solution: project.solution,
    problemStatement: project.problemStatement,
    builtOnOpenMercato: submission.builtOnOpenMercato ?? '',
  })

  return { slug, errors, render, attachmentsById, teamName, trackName: track?.name ?? null, competitionName }
}
