import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'addons',
  title: 'Addons',
  version: '0.1.0',
  description: 'Competition-scoped addon assignments and persisted sandbox simulations.',
}

export { features } from './acl'
