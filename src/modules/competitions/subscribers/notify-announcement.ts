import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { Announcement, CompetitionParticipation } from '../data/entities'

export const metadata = {
  event: 'competitions.announcement.created',
  persistent: true,
  id: 'competitions:notify-announcement',
}

type Payload = {
  id: string
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: Payload,
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  console.log('[competitions:notify-announcement] Invoked with:', JSON.stringify(payload))

  try {
    const em = ctx.resolve('em') as EntityManager

    // Load the announcement to get title + competitionId
    const announcement = await em.findOne(Announcement, {
      id: payload.id,
      tenantId: payload.tenantId,
    } as FilterQuery<Announcement>)
    if (!announcement) {
      console.log('[competitions:notify-announcement] Announcement not found for id:', payload.id)
      return
    }

    // Find all participants in this competition
    const participations = await em.find(CompetitionParticipation, {
      competitionId: announcement.competitionId,
      tenantId: payload.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)

    console.log('[competitions:notify-announcement] Found', participations.length, 'participants for competition', announcement.competitionId)

    if (participations.length === 0) return

    const recipientUserIds = participations.map(p => p.customerUserId)

    const notificationService = resolveNotificationService(ctx)
    await notificationService.createBatch(
      {
        recipientUserIds,
        type: 'competitions.announcement.published',
        title: `New announcement: ${announcement.title}`,
        titleKey: 'competitions.notifications.announcement.title',
        titleVariables: { title: announcement.title },
        body: announcement.content?.slice(0, 200) ?? announcement.title,
        icon: 'megaphone',
        severity: announcement.priority === 'urgent' ? 'error' as const : 'info' as const,
        sourceModule: 'competitions',
        sourceEntityType: 'competitions:announcement',
        sourceEntityId: payload.id,
      },
      { tenantId: payload.tenantId, organizationId: payload.organizationId },
    )

    console.log('[competitions:notify-announcement] Notifications created for', recipientUserIds.length, 'users')
  } catch (err) {
    console.error('[competitions:notify-announcement] Error:', err)
  }
}
