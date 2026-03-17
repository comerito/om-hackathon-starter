import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': {
    widgetId: 'sponsors.injection.portal-nav',
    priority: 50,
  },
}

export default injectionTable
