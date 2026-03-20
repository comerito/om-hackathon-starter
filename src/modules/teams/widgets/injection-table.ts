import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': [
    {
      widgetId: 'teams.portal-my-team',
      priority: 60,
    },
    {
      widgetId: 'teams.portal-browse-teams',
      priority: 70,
    },
  ],
}

export default injectionTable
