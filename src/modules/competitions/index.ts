import './commands/competitions'
import './commands/participations'
import './commands/agenda'
import './commands/announcements'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'competitions',
  title: 'Competitions',
  version: '0.1.0',
  description: 'Hackathon competition management — stages, schedule, participants, announcements',
}
