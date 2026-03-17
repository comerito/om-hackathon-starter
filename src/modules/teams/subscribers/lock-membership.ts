/**
 * Lock membership subscriber.
 *
 * When the competition stage advances to HACKING, this subscriber can be used
 * to enforce team membership lockdown. The stage check is done in the team API
 * routes (invitations, join/leave) by querying the competition stage, but this
 * subscriber provides a hook point for any additional lockdown side effects
 * such as cancelling all remaining pending invitations.
 */

export const metadata = {
  event: 'competitions.competition.stage_advanced',
  sync: false,
  priority: 50,
  id: 'teams:lock-membership-on-hacking',
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

  // When entering HACKING stage, cancel all pending invitations for this competition
  // This is done via raw SQL since we may not have a full ORM context in subscribers
  try {
    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    await knex('teams_invitation')
      .where({
        competition_id: payload.competitionId,
        status: 'PENDING',
      })
      .update({
        status: 'EXPIRED',
        responded_at: new Date().toISOString(),
      })

    console.info('[teams] Locked membership: cancelled all pending invitations for competition', {
      competitionId: payload.competitionId,
    })
  } catch (err) {
    console.warn('[teams] Failed to lock membership on stage advance', {
      competitionId: payload.competitionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
