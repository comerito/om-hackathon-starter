import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'teams.team.created', label: 'Team Created', entity: 'team', category: 'crud', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.updated', label: 'Team Updated', entity: 'team', category: 'crud', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.deleted', label: 'Team Deleted', entity: 'team', category: 'crud', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.track_selected', label: 'Team Track Selected', entity: 'team', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.tracks_updated', label: 'Team Tracks Updated', entity: 'team', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.disqualified', label: 'Team Disqualified', entity: 'team', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.team.withdrawn', label: 'Team Withdrawn', entity: 'team', category: 'lifecycle', clientBroadcast: true, portalBroadcast: true },
  { id: 'teams.member.joined', label: 'Member Joined', entity: 'member', category: 'lifecycle', portalBroadcast: true },
  { id: 'teams.member.left', label: 'Member Left', entity: 'member', category: 'lifecycle', portalBroadcast: true },
  { id: 'teams.invitation.created', label: 'Invitation Created', entity: 'invitation', category: 'crud', portalBroadcast: true },
  { id: 'teams.invitation.accepted', label: 'Invitation Accepted', entity: 'invitation', category: 'lifecycle', portalBroadcast: true },
  { id: 'teams.invitation.declined', label: 'Invitation Declined', entity: 'invitation', category: 'lifecycle', portalBroadcast: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'teams',
  events,
})

export const emitTeamsEvent = eventsConfig.emit
export type TeamsEventId = (typeof events)[number]['id']
export default eventsConfig
