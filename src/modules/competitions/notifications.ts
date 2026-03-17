export const notificationTypes = [
  { id: 'competitions.stage_changed', label: 'Competition Stage Changed', channels: ['in_app'] as const, priority: 'high' as const },
  { id: 'competitions.announcement', label: 'New Announcement', channels: ['in_app'] as const, priority: 'normal' as const },
  { id: 'competitions.checkin_reminder', label: 'Check-In Reminder', channels: ['in_app', 'email'] as const, priority: 'normal' as const },
  { id: 'competitions.deadline_approaching', label: 'Deadline Approaching', channels: ['in_app'] as const, priority: 'high' as const },
  { id: 'competitions.welcome_checkin', label: 'Welcome After Check-In', channels: ['in_app'] as const, priority: 'normal' as const },
]
