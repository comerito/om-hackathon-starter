import './commands/competitions'
import './commands/participations'
import './commands/agenda'
import './commands/announcements'
import './commands/milestones'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'competitions',
  title: 'Competitions',
  version: '0.1.0',
  description: 'Hackathon competition management — lifecycle, participants, agenda, announcements.',
}

export { features } from './acl'
