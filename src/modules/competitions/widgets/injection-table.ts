import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': {
    widgetId: 'competitions.injection.portal-nav',
    priority: 10,
  },
  'menu:portal:sidebar:account': {
    widgetId: 'competitions.injection.portal-account-nav',
    priority: 10,
  },
}

export default injectionTable
