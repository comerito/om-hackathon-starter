import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': {
    widgetId: 'judging.injection.portal-nav',
    priority: 40,
  },
}

export default injectionTable
export { injectionTable }
