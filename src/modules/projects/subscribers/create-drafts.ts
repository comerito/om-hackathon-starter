/**
 * Create draft projects subscriber.
 *
 * When the competition stage advances to HACKING, this subscriber creates
 * a DRAFT project for each team in the competition that doesn't already have one.
 */

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  sync: false,
  priority: 200, // Run after teams module subscribers
  id: 'projects:create-drafts-on-hacking',
}

interface StageAdvancedPayload {
  competitionId: string
  oldStage: string
  newStage: string
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: StageAdvancedPayload,
): Promise<void> {
  if (payload.newStage !== 'HACKING') return

  try {
    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    // Get all active teams for this competition
    const teams = await knex('teams_team')
      .where({
        competition_id: payload.competitionId,
        status: 'ACTIVE',
        is_active: true,
      })
      .select('id', 'track_id', 'name')

    if (teams.length === 0) {
      console.info('[projects] No active teams found for draft project creation', {
        competitionId: payload.competitionId,
      })
      return
    }

    // Check which teams already have projects
    const existingProjects = await knex('projects_project')
      .where({ competition_id: payload.competitionId })
      .select('team_id')

    const teamsWithProjects = new Set(existingProjects.map((p: { team_id: string }) => p.team_id))

    let created = 0
    for (const team of teams) {
      if (teamsWithProjects.has(team.id as string)) continue

      await knex('projects_project').insert({
        team_id: team.id,
        competition_id: payload.competitionId,
        track_id: team.track_id ?? payload.competitionId, // fallback if no track selected
        title: `${team.name}'s Project`,
        status: 'DRAFT',
        tech_stack: JSON.stringify([]),
        screenshot_ids: JSON.stringify([]),
        attachment_ids: JSON.stringify([]),
        uses_preexisting_code: false,
        flagged_for_reuse: false,
        is_active: true,
        tenant_id: payload.tenantId,
        organization_id: payload.organizationId,
        created_at: new Date(),
        updated_at: new Date(),
      })

      created++
    }

    console.info('[projects] Created draft projects for teams', {
      competitionId: payload.competitionId,
      count: created,
    })
  } catch (err) {
    console.warn('[projects] Failed to create draft projects', {
      competitionId: payload.competitionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
