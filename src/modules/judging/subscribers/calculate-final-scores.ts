import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ProjectScore } from '../data/entities'
import { Project } from '../../projects/data/entities'
import { Team } from '../../teams/data/entities'

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  persistent: true,
  id: 'judging:calculate-final-scores',
}

export default async function handler(
  payload: { competitionId: string; oldStage: string; newStage: string; tenantId: string; organizationId: string },
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  // Only act when entering FINISHED stage
  if (payload.newStage !== 'finished') return

  const em = ctx.resolve('em') as EntityManager

  // Find all published/scored projects
  const projects = await em.find(Project, {
    competitionId: payload.competitionId,
    status: { $ne: 'draft' },
    deletedAt: null,
    tenantId: payload.tenantId,
  } as FilterQuery<Project>)

  // Get all submitted scores
  const projectIds = projects.map(p => p.id)
  const scores = projectIds.length
    ? await em.find(ProjectScore, {
        projectId: { $in: projectIds },
        isSubmitted: true,
      } as FilterQuery<ProjectScore>)
    : []

  // Compute average score per project
  const scoreMap = new Map<string, number[]>()
  for (const s of scores) {
    if (s.totalScore == null) continue
    const arr = scoreMap.get(s.projectId) ?? []
    arr.push(s.totalScore)
    scoreMap.set(s.projectId, arr)
  }

  // Get teams for disqualification check
  const teamIds = [...new Set(projects.map(p => p.teamId))]
  const teams = teamIds.length ? await em.find(Team, { id: { $in: teamIds } } as FilterQuery<Team>) : []
  const disqualifiedTeamIds = new Set(teams.filter(t => t.status === 'disqualified').map(t => t.id))

  // Compute final scores and assign per-track rankings
  const trackProjects = new Map<string, Array<{ project: Project; avgScore: number }>>()

  for (const project of projects) {
    const projectScores = scoreMap.get(project.id) ?? []
    const avgScore = projectScores.length > 0
      ? projectScores.reduce((a, b) => a + b, 0) / projectScores.length
      : 0

    project.finalScore = Math.round(avgScore * 100) / 100

    if (!disqualifiedTeamIds.has(project.teamId)) {
      const trackList = trackProjects.get(project.trackId) ?? []
      trackList.push({ project, avgScore })
      trackProjects.set(project.trackId, trackList)
    }
  }

  // Assign ranks per track
  for (const [_trackId, entries] of trackProjects) {
    entries.sort((a, b) => b.avgScore - a.avgScore)
    for (let i = 0; i < entries.length; i++) {
      const p = entries[i].project
      if (p.manualRankOverride == null) {
        p.rank = i + 1
      }
    }
  }

  await em.persistAndFlush(projects)

  console.log(`[judging:calculate-final-scores] Computed final scores for ${projects.length} projects in competition ${payload.competitionId}`)

  // Emit results published event
  try {
    const eventBus = ctx.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
    await eventBus.emit('judging.results.published', {
      competitionId: payload.competitionId,
      projectCount: projects.length,
      tenantId: payload.tenantId,
      organizationId: payload.organizationId,
    })
  } catch (e) {
    console.error('[judging:calculate-final-scores] Event emit error:', e)
  }
}
