import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'sponsors.voting_open', module: 'sponsors',
    titleKey: 'sponsors.notifications.votingOpen.title',
    bodyKey: 'sponsors.notifications.votingOpen.body',
    icon: 'vote', severity: 'info',
    actions: [{ id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' }],
  },
  {
    type: 'sponsors.voting_closing', module: 'sponsors',
    titleKey: 'sponsors.notifications.votingClosing.title',
    bodyKey: 'sponsors.notifications.votingClosing.body',
    icon: 'clock', severity: 'warning',
    actions: [{ id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' }],
  },
  {
    type: 'sponsors.prize_awarded', module: 'sponsors',
    titleKey: 'sponsors.notifications.prizeAwarded.title',
    bodyKey: 'sponsors.notifications.prizeAwarded.body',
    icon: 'award', severity: 'info',
    actions: [{ id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' }],
  },
]

export default notificationTypes
