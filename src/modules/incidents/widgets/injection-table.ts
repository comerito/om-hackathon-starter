import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': [
    { widgetId: 'incidents.portal-nav', priority: 95 },
  ],
}

export default injectionTable
