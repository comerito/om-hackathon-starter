import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': [
    {
      widgetId: 'competitions.portal-dashboard',
      priority: 10,
    },
    {
      widgetId: 'competitions.portal-competition',
      priority: 20,
    },
    {
      widgetId: 'competitions.portal-agenda',
      priority: 30,
    },
    {
      widgetId: 'competitions.portal-announcements',
      priority: 40,
    },
  ],
}

export default injectionTable
