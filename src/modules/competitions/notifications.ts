import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'competitions.announcement.published',
    module: 'competitions',
    titleKey: 'competitions.notifications.announcement.title',
    bodyKey: 'competitions.notifications.announcement.body',
    icon: 'megaphone',
    severity: 'info',
    actions: [
      { id: 'view', labelKey: 'common.view', variant: 'outline', href: '/{orgSlug}/portal/announcements' },
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
    primaryActionId: 'view',
  },
  {
    type: 'competitions.stage.advanced',
    module: 'competitions',
    titleKey: 'competitions.notifications.stageAdvanced.title',
    bodyKey: 'competitions.notifications.stageAdvanced.body',
    icon: 'zap',
    severity: 'warning',
    actions: [
      { id: 'view', labelKey: 'common.view', variant: 'outline', href: '/{orgSlug}/portal/dashboard' },
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
    primaryActionId: 'view',
  },
  {
    type: 'teams.invitation.received',
    module: 'competitions',
    titleKey: 'competitions.notifications.teamInvitation.title',
    bodyKey: 'competitions.notifications.teamInvitation.body',
    icon: 'user-plus',
    severity: 'info',
    actions: [
      { id: 'view', labelKey: 'common.view', variant: 'outline', href: '/{orgSlug}/portal/team' },
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
    primaryActionId: 'view',
  },
  {
    type: 'teams.join_request.received',
    module: 'competitions',
    titleKey: 'competitions.notifications.joinRequest.title',
    bodyKey: 'competitions.notifications.joinRequest.body',
    icon: 'user-plus',
    severity: 'info',
    actions: [
      { id: 'view', labelKey: 'common.view', variant: 'outline', href: '/{orgSlug}/portal/team' },
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
    primaryActionId: 'view',
  },
  {
    type: 'teams.member.joined_team',
    module: 'competitions',
    titleKey: 'competitions.notifications.memberJoined.title',
    bodyKey: 'competitions.notifications.memberJoined.body',
    icon: 'users',
    severity: 'success',
    actions: [
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
  },
]

export default notificationTypes
