import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'projects.submitted',
    module: 'projects',
    titleKey: 'projects.notifications.submitted.title',
    bodyKey: 'projects.notifications.submitted.body',
    icon: 'check-circle',
    severity: 'info',
    actions: [
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
  },
  {
    type: 'projects.auto_published',
    module: 'projects',
    titleKey: 'projects.notifications.autoPublished.title',
    bodyKey: 'projects.notifications.autoPublished.body',
    icon: 'upload',
    severity: 'warning',
    actions: [
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
  },
  {
    type: 'projects.flagged',
    module: 'projects',
    titleKey: 'projects.notifications.flagged.title',
    bodyKey: 'projects.notifications.flagged.body',
    icon: 'flag',
    severity: 'warning',
    actions: [
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
  },
]

export default notificationTypes
