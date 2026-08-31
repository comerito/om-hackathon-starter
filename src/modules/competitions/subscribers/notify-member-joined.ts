import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
// Relative, not `@/lib/db`: subscribers are bundled by esbuild, which does not read
// the tsconfig `@/*` path alias, and the app fails to boot with an unresolved import.
import { rawAll } from '../../../lib/db'

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

  // Get team name and new member name
  const teamRows = await rawAll<{ name: string | null }>(em,
    `SELECT name FROM teams_team WHERE id = ? LIMIT 1`,
    [payload.teamId],
  )
  const teamRow = teamRows[0]
  const memberRows = await rawAll<{ display_name: string | null }>(em,
    `SELECT display_name FROM customer_users WHERE id = ? LIMIT 1`,
    [payload.customerUserId],
  )
  const memberRow = memberRows[0]
  const teamName = teamRow?.name ?? 'your team'
  const memberName = memberRow?.display_name ?? 'A new member'

  // Notify all existing team members (except the one who just joined)
  const members = await rawAll<{ customer_user_id: string }>(em,
    `SELECT customer_user_id
     FROM teams_team_member
     WHERE team_id = ?
       AND deleted_at IS NULL
       AND customer_user_id != ?`,
    [payload.teamId, payload.customerUserId],
  )

  if (members.length === 0) return

  const recipientUserIds = members.map((m) => m.customer_user_id)

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
