import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionParticipation } from '../data/entities'

export const metadata = {
  event: 'competitions.announcement.created',
  persistent: true,
  id: 'competitions:notify-announcement',
}

type Payload = {
  id: string
  title: string
  competitionId: string
  tenantId: string
  organizationId: string
}

export default async function handler(
  payload: Payload,
  ctx: { resolve: <T = unknown>(name: string) => T },
) {
  const em = ctx.resolve('em') as EntityManager
  const notificationService = ctx.resolve('notificationService') as any

  // Find all participants in this competition
  const participations = await em.find(CompetitionParticipation, {
    competitionId: payload.competitionId,
    tenantId: payload.tenantId,
    deletedAt: null,
  } as FilterQuery<CompetitionParticipation>)

  if (participations.length === 0) return

  const recipientUserIds = participations.map(p => p.customerUserId)

  await notificationService.createBatch(
    {
      recipientUserIds,
      type: 'competitions.announcement.published',
      title: `New announcement: ${payload.title}`,
      titleKey: 'competitions.notifications.announcement.title',
      titleVariables: { title: payload.title },
      body: payload.title,
      icon: 'megaphone',
      severity: 'info',
      sourceModule: 'competitions',
      sourceEntityType: 'competitions:announcement',
      sourceEntityId: payload.id,
    },
    { tenantId: payload.tenantId, organizationId: payload.organizationId },
  )
}
