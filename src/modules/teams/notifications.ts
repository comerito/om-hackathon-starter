export const notificationTypes = [
  { id: 'teams.invitation_received', label: 'Team Invitation', channels: ['in_app'] as const, priority: 'normal' as const },
  { id: 'teams.join_request_received', label: 'Join Request', channels: ['in_app'] as const, priority: 'normal' as const },
  { id: 'teams.invitation_response', label: 'Invitation Response', channels: ['in_app'] as const, priority: 'normal' as const },
  { id: 'teams.track_selected', label: 'Track Selected', channels: ['in_app'] as const, priority: 'normal' as const },
  { id: 'teams.member_change', label: 'Team Roster Change', channels: ['in_app'] as const, priority: 'normal' as const },
]
