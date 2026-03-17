export const notificationTypes = [
  { id: 'projects.submitted', label: 'Project Submitted', channels: ['in_app'] as const, priority: 'normal' as const },
  { id: 'projects.auto_published', label: 'Project Auto-Published', channels: ['in_app'] as const, priority: 'high' as const },
  { id: 'projects.flagged', label: 'Project Flagged for Reuse', channels: ['in_app'] as const, priority: 'high' as const },
]
