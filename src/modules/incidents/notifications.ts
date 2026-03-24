import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'incidents.high_severity', module: 'incidents',
    titleKey: 'incidents.notifications.highSeverity.title',
    bodyKey: 'incidents.notifications.highSeverity.body',
    icon: 'alert-triangle', severity: 'error',
    actions: [
      { id: 'view', labelKey: 'common.view', variant: 'outline', href: '/backend/incidents' },
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
    primaryActionId: 'view',
  },
  {
    type: 'incidents.resolved', module: 'incidents',
    titleKey: 'incidents.notifications.resolved.title',
    bodyKey: 'incidents.notifications.resolved.body',
    icon: 'check-circle', severity: 'info',
    actions: [{ id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' }],
  },
]

export default notificationTypes
