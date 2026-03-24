import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'judging.panel.created', label: 'Panel Created', entity: 'panel', category: 'crud', clientBroadcast: true },
  { id: 'judging.panel.updated', label: 'Panel Updated', entity: 'panel', category: 'crud', clientBroadcast: true },
  { id: 'judging.panel.deleted', label: 'Panel Deleted', entity: 'panel', category: 'crud', clientBroadcast: true },
  { id: 'judging.criterion.created', label: 'Criterion Created', entity: 'criterion', category: 'crud', clientBroadcast: true },
  { id: 'judging.criterion.updated', label: 'Criterion Updated', entity: 'criterion', category: 'crud', clientBroadcast: true },
  { id: 'judging.criterion.deleted', label: 'Criterion Deleted', entity: 'criterion', category: 'crud', clientBroadcast: true },
  { id: 'judging.score.submitted', label: 'Score Submitted', entity: 'score', category: 'crud', clientBroadcast: true },
  { id: 'judging.score.updated', label: 'Score Updated', entity: 'score', category: 'crud', clientBroadcast: true },
  { id: 'judging.score.deleted', label: 'Score Deleted', entity: 'score', category: 'crud', clientBroadcast: true },
  { id: 'judging.demo.status_changed', label: 'Demo Status Changed', entity: 'demo', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'judging.demo.queue_updated', label: 'Demo Queue Updated', entity: 'demo', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'judging.finalists.selected', label: 'Finalists Selected', entity: 'finalist', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'judging.results.published', label: 'Results Published', entity: 'result', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'judging',
  events,
})

export const emitJudgingEvent = eventsConfig.emit
export type JudgingEventId = (typeof events)[number]['id']
export default eventsConfig
