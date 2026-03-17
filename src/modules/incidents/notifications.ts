export const notificationTypes = [
  { id: 'incidents.high_severity', label: 'High Severity Incident', channels: ['in_app', 'email'] as const, priority: 'urgent' as const },
  { id: 'incidents.resolved', label: 'Incident Resolved', channels: ['in_app'] as const, priority: 'normal' as const },
]
