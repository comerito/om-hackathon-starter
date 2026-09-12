import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': [
    {
      widgetId: 'competitions.portal-nav',
      priority: 10,
    },
  ],
  'backend:topbar:actions': [
    {
      widgetId: 'competitions.backend-competition-scope',
      priority: 10,
    },
  ],
}

export default injectionTable
