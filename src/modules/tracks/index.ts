import './commands/tracks'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'tracks',
  title: 'Tracks',
  version: '0.1.0',
  description: 'Hackathon track management — categorise competitions into themed tracks.',
}

export { features } from './acl'
