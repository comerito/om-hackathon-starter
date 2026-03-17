import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'competitions.competition.created', label: 'Competition Created', entity: 'competition', category: 'crud', clientBroadcast: true },
  { id: 'competitions.competition.updated', label: 'Competition Updated', entity: 'competition', category: 'crud', clientBroadcast: true },
  { id: 'competitions.competition.deleted', label: 'Competition Deleted', entity: 'competition', category: 'crud', clientBroadcast: true },
  { id: 'competitions.competition.stage_advanced', label: 'Stage Advanced', entity: 'competition', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'competitions.participation.created', label: 'Participant Registered', entity: 'participation', category: 'crud', clientBroadcast: true },
  { id: 'competitions.participation.updated', label: 'Participation Updated', entity: 'participation', category: 'crud', clientBroadcast: true },
  { id: 'competitions.participation.deleted', label: 'Participation Deleted', entity: 'participation', category: 'crud', clientBroadcast: true },
  { id: 'competitions.participation.checked_in', label: 'Participant Checked In', entity: 'participation', category: 'lifecycle', clientBroadcast: true },
  { id: 'competitions.participation.coc_accepted', label: 'CoC Accepted', entity: 'participation', category: 'lifecycle' },
  { id: 'competitions.announcement.created', label: 'Announcement Published', entity: 'announcement', category: 'crud', clientBroadcast: true, portalBroadcast: true },
  { id: 'competitions.announcement.updated', label: 'Announcement Updated', entity: 'announcement', category: 'crud', clientBroadcast: true },
  { id: 'competitions.announcement.deleted', label: 'Announcement Deleted', entity: 'announcement', category: 'crud', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'competitions', events })
export const emitCompetitionsEvent = eventsConfig.emit
export default eventsConfig
