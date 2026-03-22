import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'sponsors.sponsor.created', label: 'Sponsor Created', entity: 'sponsor', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.sponsor.updated', label: 'Sponsor Updated', entity: 'sponsor', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.sponsor.deleted', label: 'Sponsor Deleted', entity: 'sponsor', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.prize.created', label: 'Prize Created', entity: 'prize', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.prize.updated', label: 'Prize Updated', entity: 'prize', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.prize.deleted', label: 'Prize Deleted', entity: 'prize', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.prize.awarded', label: 'Prize Awarded', entity: 'prize', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'sponsors.vote.cast', label: 'Vote Cast', entity: 'vote', category: 'crud', clientBroadcast: true },
  { id: 'sponsors.vote.retracted', label: 'Vote Retracted', entity: 'vote', category: 'crud', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'sponsors', events })
export const emitSponsorsEvent = eventsConfig.emit
export type SponsorsEventId = (typeof events)[number]['id']
export default eventsConfig
