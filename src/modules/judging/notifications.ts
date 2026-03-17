export const notificationTypes = [
  { id: 'judging.on_deck', label: 'Your Team Is On Deck', channels: ['in_app'] as const, priority: 'urgent' as const },
  { id: 'judging.scoring_reminder', label: 'Complete Your Scoring', channels: ['in_app', 'email'] as const, priority: 'high' as const },
  { id: 'judging.results_published', label: 'Results Published', channels: ['in_app', 'email'] as const, priority: 'high' as const },
]
