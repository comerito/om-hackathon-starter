import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': {
    widgetId: 'projects.injection.portal-nav',
    priority: 30,
  },
}

export default injectionTable
