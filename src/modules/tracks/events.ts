import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'tracks.track.created', label: 'Track Created', entity: 'track', category: 'crud', clientBroadcast: true },
  { id: 'tracks.track.updated', label: 'Track Updated', entity: 'track', category: 'crud', clientBroadcast: true },
  { id: 'tracks.track.deleted', label: 'Track Deleted', entity: 'track', category: 'crud', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'tracks',
  events,
})

export const emitTracksEvent = eventsConfig.emit
export type TracksEventId = (typeof events)[number]['id']
export default eventsConfig
