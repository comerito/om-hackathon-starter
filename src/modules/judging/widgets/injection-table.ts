import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': [
    {
      widgetId: 'judging.portal-nav',
      priority: 80,
    },
  ],
}

export default injectionTable
