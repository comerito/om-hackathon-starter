import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'incidents.report.created', label: 'Incident Reported', entity: 'report', category: 'crud', clientBroadcast: true },
  { id: 'incidents.report.updated', label: 'Incident Updated', entity: 'report', category: 'crud', clientBroadcast: true },
  { id: 'incidents.report.resolved', label: 'Incident Resolved', entity: 'report', category: 'lifecycle', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({ moduleId: 'incidents', events })
export const emitIncidentsEvent = eventsConfig.emit
export type IncidentsEventId = (typeof events)[number]['id']
export default eventsConfig
