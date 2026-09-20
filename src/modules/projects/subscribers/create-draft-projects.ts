import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { ensureDraftProjects } from '../lib/draftProjects'
import { Team, TeamStatus, TeamTrack } from '../../teams/data/entities'

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

  // Find all active teams in the competition
  const teams = await em.find(Team, {
    competitionId: payload.competitionId,
    status: TeamStatus.ACTIVE,
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    deletedAt: null,
  } as FilterQuery<Team>)

  let created = 0
  for (const team of teams) {
    // Get all track assignments from junction table
    const teamTracks = await em.find(TeamTrack, {
      teamId: team.id,
      competitionId: payload.competitionId,
    } as FilterQuery<TeamTrack>)

    if (teamTracks.length === 0) {
      // Fall back to deprecated trackId for backward compat
      if (!team.trackId) {
        console.log(`[projects:create-draft-projects] Team ${team.id} (${team.name}) has no tracks — skipping project creation`)
        continue
      }
      // Create single project from legacy trackId
      teamTracks.push({ trackId: team.trackId } as TeamTrack)
    }

    const drafts = await ensureDraftProjects(em, team, teamTracks.map((tt) => tt.trackId))
    created += drafts.length
  }

  if (created > 0) {
    await em.flush()
    console.log(`[projects:create-draft-projects] Created ${created} draft projects for competition ${payload.competitionId}`)
  } else {
    console.log(`[projects:create-draft-projects] No new projects needed for competition ${payload.competitionId}`)
  }
}
