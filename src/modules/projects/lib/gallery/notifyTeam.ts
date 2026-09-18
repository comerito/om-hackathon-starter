import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { resolveNotificationService } from '@open-mercato/core/modules/notifications/lib/notificationService'
import { TeamMember, TeamRole } from '../../../teams/data/entities'

export type GalleryEventPayload = {
  projectId: string
  teamId: string
  tenantId: string
  organizationId: string
  liveUrl?: string | null
  reason?: string | null
}

type SubscriberContext = { resolve: <T = unknown>(name: string) => T }

/** Tell the team owners what happened to their gallery request. */
export async function notifyTeamAboutGallery(
  payload: GalleryEventPayload,
  ctx: SubscriberContext,
  outcome: 'published' | 'rejected',
): Promise<void> {
  const em = ctx.resolve('em') as EntityManager
  const owners = await em.find(TeamMember, {
    teamId: payload.teamId,
    role: TeamRole.OWNER,
    deletedAt: null,
    tenantId: payload.tenantId,
  } as FilterQuery<TeamMember>)
  const recipientUserIds = owners.map((owner) => owner.customerUserId)
  if (recipientUserIds.length === 0) return

  const published = outcome === 'published'
  await resolveNotificationService(ctx).createBatch(
    {
      recipientUserIds,
      type: published ? 'projects.gallery_published' : 'projects.gallery_rejected',
      title: published ? 'Your project is live in the Open Mercato Project Gallery' : 'Your project was not added to the gallery',
      titleKey: published ? 'projects.notifications.galleryPublished.title' : 'projects.notifications.galleryRejected.title',
      body: published ? `See it at ${payload.liveUrl ?? ''}` : payload.reason ?? '',
      bodyKey: published ? 'projects.notifications.galleryPublished.body' : 'projects.notifications.galleryRejected.body',
      bodyVariables: published ? { url: payload.liveUrl ?? '' } : { reason: payload.reason ?? '' },
      icon: published ? 'globe' : 'x-circle',
      severity: published ? 'success' : 'warning',
      sourceModule: 'projects',
      sourceEntityType: 'projects:project',
      sourceEntityId: payload.projectId,
      groupKey: `gallery-${outcome}-${payload.projectId}`,
    },
    { tenantId: payload.tenantId, organizationId: payload.organizationId },
  )
}
