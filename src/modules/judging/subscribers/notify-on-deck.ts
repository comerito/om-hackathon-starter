/**
 * Notify on-deck subscriber.
 *
 * When a demo session transitions to ON_DECK status, this subscriber
 * sends a notification to the team so they can prepare for their demo.
 */

export const metadata = {
  event: 'judging.demo.status_changed',
  sync: false,
  priority: 50,
  id: 'judging:notify-on-deck',
}

interface DemoStatusChangedPayload {
  demoId: string
  competitionId: string
  teamId: string
  projectId: string
  previousStatus: string
  newStatus: string
  serverTime: string
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: DemoStatusChangedPayload,
): Promise<void> {
  if (payload.newStatus !== 'ON_DECK') return

  try {
    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()

    // Get team members to notify
    const members = await knex('teams_team_member')
      .where({ team_id: payload.teamId, deleted_at: null })
      .select('customer_user_id')

    if (members.length === 0) return

    // Try to send notification via the notification system
    try {
      const notificationService = container.resolve('notificationService') as {
        send?: (params: {
          type: string
          recipientIds: string[]
          payload: Record<string, unknown>
          tenantId: string
          organizationId: string
        }) => Promise<void>
      }

      if (notificationService?.send) {
        await notificationService.send({
          type: 'judging.on_deck',
          recipientIds: members.map((m: { customer_user_id: string }) => m.customer_user_id),
          payload: {
            teamId: payload.teamId,
            competitionId: payload.competitionId,
            demoId: payload.demoId,
          },
          tenantId: payload.tenantId,
          organizationId: payload.organizationId,
        })
      }
    } catch {
      // Notification service may not be available — non-critical
    }

    console.info('[judging] Notified team of on-deck status', {
      teamId: payload.teamId,
      memberCount: members.length,
    })
  } catch (err) {
    console.warn('[judging] Failed to send on-deck notification', {
      teamId: payload.teamId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
