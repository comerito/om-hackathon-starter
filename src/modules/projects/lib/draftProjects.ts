/**
 * Draft projects are created per (team, track). Two paths need them:
 *
 *  - the `hacking` stage transition (`subscribers/create-draft-projects`), for every team;
 *  - an organizer assigning tracks to a team that was formed AFTER that transition
 *    (`teams/api/admin/assign-tracks`) — the transition already happened, so nothing
 *    else would ever create the team's project.
 *
 * Both go through here so the project they create is identical.
 */

import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Project, ProjectStatus } from '../data/entities'

export type DraftProjectTeam = {
  id: string
  name: string
  competitionId: string
  tenantId: string
  organizationId: string
}

/** Track ids that still need a project, in the given order, without duplicates. Pure. */
export function missingDraftProjectTrackIds(
  desiredTrackIds: readonly string[],
  existingProjectTrackIds: readonly string[],
): string[] {
  const covered = new Set(existingProjectTrackIds)
  const missing: string[] = []
  for (const trackId of desiredTrackIds) {
    if (!trackId || covered.has(trackId)) continue
    covered.add(trackId)
    missing.push(trackId)
  }
  return missing
}

/**
 * Persist (without flushing) a draft project for every track of `team` that has none.
 * Idempotent. Reads first, then creates — the caller owns the flush and MUST NOT run
 * another find before it (MikroORM 7 drops pending scalar updates otherwise).
 */
export async function ensureDraftProjects(
  em: EntityManager,
  team: DraftProjectTeam,
  trackIds: readonly string[],
): Promise<Project[]> {
  if (trackIds.length === 0) return []

  // Soft-deleted rows are included on purpose: (team, track, competition) is unique in the
  // database, so a deleted project for the same track has to be revived, not re-inserted.
  const existing = await em.find(Project, {
    teamId: team.id,
    competitionId: team.competitionId,
    trackId: { $in: [...trackIds] },
    tenantId: team.tenantId,
  } as FilterQuery<Project>)

  const created: Project[] = []
  for (const project of existing) {
    if (project.deletedAt == null || !trackIds.includes(project.trackId)) continue
    project.deletedAt = null
    project.status = ProjectStatus.DRAFT
    project.updatedAt = new Date()
    em.persist(project)
    created.push(project)
  }
  for (const trackId of missingDraftProjectTrackIds(trackIds, existing.map((project) => project.trackId))) {
    const now = new Date()
    const project = em.create(Project, {
      teamId: team.id,
      competitionId: team.competitionId,
      trackId,
      title: `${team.name}'s Project`,
      status: ProjectStatus.DRAFT,
      techStack: [],
      screenshotIds: [],
      attachmentIds: [],
      usesPreexistingCode: false,
      flaggedForReuse: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      tenantId: team.tenantId,
      organizationId: team.organizationId,
    })
    em.persist(project)
    created.push(project)
  }
  return created
}

/** A draft nobody has worked on yet: safe to remove together with its track. */
export function isUntouchedDraft(project: Pick<Project, 'status' | 'description' | 'problemStatement' | 'solution' | 'tagline' | 'demoUrl' | 'repoUrl' | 'videoUrl' | 'presentationUrl' | 'screenshotIds' | 'attachmentIds' | 'techStack'>): boolean {
  if (project.status !== ProjectStatus.DRAFT) return false
  const texts = [project.description, project.problemStatement, project.solution, project.tagline, project.demoUrl, project.repoUrl, project.videoUrl, project.presentationUrl]
  if (texts.some((value) => typeof value === 'string' && value.trim().length > 0)) return false
  return (project.screenshotIds ?? []).length === 0 && (project.attachmentIds ?? []).length === 0 && (project.techStack ?? []).length === 0
}
