import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': [
    { widgetId: 'sponsors.portal-nav', priority: 90 },
  ],
}

export default injectionTable
