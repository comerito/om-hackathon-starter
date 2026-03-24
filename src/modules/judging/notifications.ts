import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'judging.on_deck',
    module: 'judging',
    titleKey: 'judging.notifications.onDeck.title',
    bodyKey: 'judging.notifications.onDeck.body',
    icon: 'alert-triangle',
    severity: 'warning',
    actions: [
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
  },
  {
    type: 'judging.scoring_reminder',
    module: 'judging',
    titleKey: 'judging.notifications.scoringReminder.title',
    bodyKey: 'judging.notifications.scoringReminder.body',
    icon: 'clipboard-check',
    severity: 'info',
    actions: [
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
  },
  {
    type: 'judging.results_published',
    module: 'judging',
    titleKey: 'judging.notifications.resultsPublished.title',
    bodyKey: 'judging.notifications.resultsPublished.body',
    icon: 'trophy',
    severity: 'info',
    actions: [
      { id: 'view', labelKey: 'common.view', variant: 'outline', href: '/portal/results' },
      { id: 'dismiss', labelKey: 'notifications.actions.dismiss', variant: 'ghost' },
    ],
    primaryActionId: 'view',
  },
]

export default notificationTypes
