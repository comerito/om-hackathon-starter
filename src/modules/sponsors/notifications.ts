export const notificationTypes = [
  { id: 'sponsors.voting_open', label: 'Voting Is Open', channels: ['in_app'] as const, priority: 'normal' as const },
  { id: 'sponsors.voting_closing', label: 'Voting Closing Soon', channels: ['in_app'] as const, priority: 'high' as const },
  { id: 'sponsors.prize_awarded', label: 'Prize Awarded', channels: ['in_app', 'email'] as const, priority: 'high' as const },
]
