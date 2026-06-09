import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'

// Inline raw-SQL helper. Subscribers are bundled by a generator pass that does
// not resolve app-local imports, so we cannot import from src/lib/db here.
async function rawFirstSql<T = Record<string, unknown>>(em: EntityManager, sql: string, params: unknown[]): Promise<T | null> {
  const rows = (await em.getConnection().execute(sql, params, 'all')) as unknown as T[]
  return rows[0] ?? null
}

export const metadata = {
  event: 'teams.invitation.created',
  persistent: true,
  id: 'competitions:notify-team-invitation',
}

type Payload = {
  id: string
  teamId: string
  inviteeId: string
  inviterId: string
  type: string // 'invite' or 'join_request'
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: Payload,
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  const em = ctx.resolve('em') as EntityManager
  const notificationService = resolveNotificationService(ctx)

  // Get team name
  const teamRow = await rawFirstSql<{ name: string }>(em, `SELECT name FROM teams_team WHERE id = ? LIMIT 1`, [payload.teamId])
  const teamName = teamRow?.name ?? 'a team'

  if (payload.type === 'invite') {
    // Notify the invitee that they've been invited
    await notificationService.create(
      {
        recipientUserId: payload.inviteeId,
        type: 'teams.invitation.received',
        title: `You've been invited to join ${teamName}`,
        titleKey: 'competitions.notifications.teamInvitation.title',
        titleVariables: { team: teamName },
        body: `Team "${teamName}" has invited you to join. Check your team page to respond.`,
        icon: 'user-plus',
        severity: 'info',
        sourceModule: 'teams',
        sourceEntityType: 'teams:invitation',
        sourceEntityId: payload.id,
      },
      { tenantId: payload.tenantId, organizationId: payload.organizationId },
    )
  } else if (payload.type === 'join_request') {
    // Notify the team owner that someone wants to join
    // Find the team owner
    const ownerRow = await rawFirstSql<{ customer_user_id: string }>(
      em,
      `SELECT customer_user_id FROM teams_team_member WHERE team_id = ? AND role = 'owner' AND deleted_at IS NULL LIMIT 1`,
      [payload.teamId],
    )

    if (ownerRow) {
      // Get requester name
      const requesterRow = await rawFirstSql<{ display_name: string }>(em, `SELECT display_name FROM customer_users WHERE id = ? LIMIT 1`, [payload.inviterId])
      const requesterName = requesterRow?.display_name ?? 'Someone'

      await notificationService.create(
        {
          recipientUserId: ownerRow.customer_user_id,
          type: 'teams.join_request.received',
          title: `${requesterName} wants to join ${teamName}`,
          titleKey: 'competitions.notifications.joinRequest.title',
          titleVariables: { name: requesterName, team: teamName },
          body: `Review their request on your team page.`,
          icon: 'user-plus',
          severity: 'info',
          sourceModule: 'teams',
          sourceEntityType: 'teams:invitation',
          sourceEntityId: payload.id,
        },
        { tenantId: payload.tenantId, organizationId: payload.organizationId },
      )
    }
  }
}
