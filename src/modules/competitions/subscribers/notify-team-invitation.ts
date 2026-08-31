import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'

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
  const conn = em.getConnection()

  // Get team name
  const teamRows = await conn.execute<Array<{ name: string | null }>>(
    `SELECT name FROM teams_team WHERE id = ? LIMIT 1`,
    [payload.teamId],
  )
  const teamRow = teamRows[0]
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
    const ownerRows = await conn.execute<Array<{ customer_user_id: string }>>(
      `SELECT customer_user_id
       FROM teams_team_member
       WHERE team_id = ?
         AND role = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [payload.teamId, 'owner'],
    )
    const ownerRow = ownerRows[0]

    if (ownerRow) {
      // Get requester name
      const requesterRows = await conn.execute<Array<{ display_name: string | null }>>(
        `SELECT display_name FROM customer_users WHERE id = ? LIMIT 1`,
        [payload.inviterId],
      )
      const requesterRow = requesterRows[0]
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
