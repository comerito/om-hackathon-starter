import './commands/projects'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'projects',
  title: 'Projects',
  version: '0.1.0',
  description: 'Hackathon project submissions — editing, media, originality disclosure, submission flow.',
}

export { features } from './acl'
