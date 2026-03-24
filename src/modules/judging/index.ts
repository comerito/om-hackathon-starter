import './commands/panels'
import './commands/criteria'
import './commands/demos'
import './commands/scores'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'judging',
  title: 'Demos & Judging',
  version: '0.1.0',
  description: 'Judge panels, scoring criteria, demo queue, presentation timer, and leaderboard.',
}

export { features } from './acl'
