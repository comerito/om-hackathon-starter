import type { EntityManager } from '@mikro-orm/postgresql'

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
  const notificationService = ctx.resolve('notificationService') as any
  const knex = (em as any).getConnection().getKnex()

  // Get team name
  const teamRow = await knex('teams_team').where('id', payload.teamId).select('name').first()
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
    const ownerRow = await knex('teams_team_member')
      .where('team_id', payload.teamId)
      .where('role', 'owner')
      .whereNull('deleted_at')
      .select('customer_user_id')
      .first()

    if (ownerRow) {
      // Get requester name
      const requesterRow = await knex('customer_users').where('id', payload.inviterId).select('display_name').first()
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
