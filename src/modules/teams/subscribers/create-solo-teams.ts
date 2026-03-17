/**
 * Create solo teams subscriber.
 *
 * When the competition stage advances to HACKING, this subscriber checks for
 * participants who are not on any team. If the competition allows solo participants,
 * it creates one-person teams for them so they can still submit projects.
 */

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  sync: false,
  priority: 100, // Run after lock-membership (priority 50)
  id: 'teams:create-solo-teams-on-hacking',
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

    // Check competition config for allowSoloParticipants
    const [competition] = await knex('competitions_competition')
      .where({ id: payload.competitionId })
      .select('min_team_size', 'stage_config')

    if (!competition) return

    // Allow solo if minTeamSize is 1 or stageConfig has allowSoloParticipants
    const stageConfig = typeof competition.stage_config === 'object' ? competition.stage_config : {}
    const allowSolo = competition.min_team_size <= 1 || (stageConfig as Record<string, unknown>).allowSoloParticipants === true

    if (!allowSolo) {
      console.info('[teams] Solo teams not allowed for this competition, skipping', {
        competitionId: payload.competitionId,
      })
      return
    }

    // Find participants not on any team
    const unmatchedParticipants = await knex('competitions_participation')
      .where({
        competition_id: payload.competitionId,
        role: 'participant',
      })
      .whereNotIn(
        'customer_user_id',
        knex('teams_team_member')
          .where({
            competition_id: payload.competitionId,
            deleted_at: null,
          })
          .select('customer_user_id'),
      )
      .select('customer_user_id')

    if (unmatchedParticipants.length === 0) {
      console.info('[teams] No unmatched participants for solo teams', {
        competitionId: payload.competitionId,
      })
      return
    }

    let created = 0
    for (const row of unmatchedParticipants) {
      const userId = row.customer_user_id as string

      // Get user info for team name
      const [userRow] = await knex('customer_users')
        .where({ id: userId })
        .select('first_name', 'last_name', 'email')
        .catch(() => [null])

      const teamName = userRow
        ? `${userRow.first_name ?? ''} ${userRow.last_name ?? ''}`.trim() || `Solo ${userId.slice(0, 8)}`
        : `Solo ${userId.slice(0, 8)}`

      // Create team + member in a single transaction
      const teamId = knex.raw('gen_random_uuid()')
      await knex.transaction(async (trx) => {
        const [team] = await trx('teams_team')
          .insert({
            competition_id: payload.competitionId,
            name: teamName,
            status: 'ACTIVE',
            is_active: true,
            tenant_id: payload.tenantId,
            organization_id: payload.organizationId,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('id')

        await trx('teams_team_member').insert({
          team_id: team.id,
          customer_user_id: userId,
          competition_id: payload.competitionId,
          role: 'OWNER',
          joined_at: new Date(),
          tenant_id: payload.tenantId,
          organization_id: payload.organizationId,
        })
      })

      created++
    }

    console.info('[teams] Created solo teams for unmatched participants', {
      competitionId: payload.competitionId,
      count: created,
    })
  } catch (err) {
    console.warn('[teams] Failed to create solo teams', {
      competitionId: payload.competitionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
