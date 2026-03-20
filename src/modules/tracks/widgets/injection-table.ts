import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'menu:portal:sidebar:main': [
    {
      widgetId: 'tracks.portal-tracks',
      priority: 50,
    },
  ],
}

export default injectionTable
