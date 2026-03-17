import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': {
    widgetId: 'teams.injection.portal-nav',
    priority: 20,
  },
}

export default injectionTable
