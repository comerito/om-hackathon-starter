import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'

export const metadata = {
  event: 'teams.member.joined',
  persistent: true,
  id: 'competitions:notify-member-joined',
}

type Payload = {
  teamId: string
  customerUserId: string
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: Payload,
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  const em = ctx.resolve('em') as EntityManager
  const notificationService = resolveNotificationService(ctx)
  const knex = (em as any).getConnection().getKnex()

  // Get team name and new member name
  const teamRow = await knex('teams_team').where('id', payload.teamId).select('name').first()
  const memberRow = await knex('customer_users').where('id', payload.customerUserId).select('display_name').first()
  const teamName = teamRow?.name ?? 'your team'
  const memberName = memberRow?.display_name ?? 'A new member'

  // Notify all existing team members (except the one who just joined)
  const members = await knex('teams_team_member')
    .where('team_id', payload.teamId)
    .whereNull('deleted_at')
    .whereNot('customer_user_id', payload.customerUserId)
    .select('customer_user_id')

  if (members.length === 0) return

  const recipientUserIds = members.map((m: any) => m.customer_user_id)

  await notificationService.createBatch(
    {
      recipientUserIds,
      type: 'teams.member.joined_team',
      title: `${memberName} joined ${teamName}`,
      titleKey: 'competitions.notifications.memberJoined.title',
      titleVariables: { name: memberName, team: teamName },
      body: `${memberName} has joined your team.`,
      icon: 'users',
      severity: 'success',
      sourceModule: 'teams',
      sourceEntityType: 'teams:team',
      sourceEntityId: payload.teamId,
    },
    { tenantId: payload.tenantId, organizationId: payload.organizationId },
  )
}
