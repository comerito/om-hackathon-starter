import './commands/incidents'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'incidents',
  title: 'Incidents',
  version: '0.1.0',
  description: 'Code of Conduct incident reporting and resolution.',
}

export { features } from './acl'
