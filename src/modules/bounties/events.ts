import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'bounties.pull_request.detected', label: 'PR Detected', entity: 'pull_request', category: 'lifecycle' },
  { id: 'bounties.pull_request.classified', label: 'PR Classified', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true },
  { id: 'bounties.pull_request.approved', label: 'PR Approved', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'bounties.pull_request.rejected', label: 'PR Rejected', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true },
  { id: 'bounties.pull_request.duplicate_detected', label: 'Duplicate Detected', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true },
  { id: 'bounties.pull_request.points_adjusted', label: 'Points Adjusted', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'bounties.pull_request.split_detected', label: 'Split Detected', entity: 'pull_request', category: 'lifecycle', clientBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'bounties',
  events,
})

export const emitBountiesEvent = eventsConfig.emit
export type BountiesEventId = (typeof events)[number]['id']
export default eventsConfig
