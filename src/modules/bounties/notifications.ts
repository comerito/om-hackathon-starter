import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'bounties.pr_approved',
    module: 'bounties',
    titleKey: 'bounties.notifications.prApproved.title',
    bodyKey: 'bounties.notifications.prApproved.body',
    icon: 'check-circle',
    severity: 'success',
    actions: [
      { id: 'view', labelKey: 'common.view', variant: 'outline', href: '/backend/bounties' },
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
  },
  {
    type: 'bounties.pr_rejected',
    module: 'bounties',
    titleKey: 'bounties.notifications.prRejected.title',
    bodyKey: 'bounties.notifications.prRejected.body',
    icon: 'x-circle',
    severity: 'warning',
    actions: [
      { id: 'view', labelKey: 'common.view', variant: 'outline', href: '/backend/bounties' },
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
  },
  {
    type: 'bounties.pr_detected',
    module: 'bounties',
    titleKey: 'bounties.notifications.prDetected.title',
    bodyKey: 'bounties.notifications.prDetected.body',
    icon: 'git-pull-request',
    severity: 'info',
    actions: [
      { id: 'review', labelKey: 'bounties.notifications.actions.review', variant: 'outline', href: '/backend/bounties' },
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
  },
]

export default notificationTypes
