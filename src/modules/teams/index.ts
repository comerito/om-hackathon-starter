import './commands/teams'
import './commands/members'
import './commands/invitations'
import './commands/resources'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'teams',
  title: 'Teams',
  version: '0.1.0',
  description: 'Hackathon team management — formation, membership, invitations.',
}

export { features } from './acl'
