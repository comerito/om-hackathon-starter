import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Project, ProjectStatus } from '../data/entities'
import { Team, TeamStatus } from '../../teams/data/entities'

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  persistent: true,
  id: 'projects:create-draft-projects',
}

export default async function handler(
  payload: { competitionId: string; oldStage: string; newStage: string; tenantId: string; organizationId: string },
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  // Only act when entering HACKING stage
  if (payload.newStage !== 'hacking') return

  const em = ctx.resolve('em') as EntityManager

  // Find all active teams in the competition that have a track assigned
  const teams = await em.find(Team, {
    competitionId: payload.competitionId,
    status: TeamStatus.ACTIVE,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    deletedAt: null,
  } as FilterQuery<Team>)

  let created = 0
  for (const team of teams) {
    if (!team.trackId) {
      console.log(`[projects:create-draft-projects] Team ${team.id} (${team.name}) has no track — skipping project creation`)
      continue
    }

    // Check if project already exists for this team (idempotency)
    const existing = await em.findOne(Project, {
      teamId: team.id,
      competitionId: payload.competitionId,
      deletedAt: null,
    } as FilterQuery<Project>)

    if (existing) {
      console.log(`[projects:create-draft-projects] Project already exists for team ${team.id} — skipping`)
      continue
    }

    const now = new Date()
    const project = em.create(Project, {
      teamId: team.id,
      competitionId: payload.competitionId,
      trackId: team.trackId,
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
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
    })
    em.persist(project)
    created++
  }

  if (created > 0) {
    await em.flush()
    console.log(`[projects:create-draft-projects] Created ${created} draft projects for competition ${payload.competitionId}`)
  } else {
    console.log(`[projects:create-draft-projects] No new projects needed for competition ${payload.competitionId}`)
  }
}
