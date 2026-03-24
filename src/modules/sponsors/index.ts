import './commands/sponsors'
import './commands/prizes'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'sponsors',
  title: 'Sponsors & Prizes',
  version: '0.1.0',
  description: 'Partner management, prizes, People\'s Choice voting.',
}

export { features } from './acl'
