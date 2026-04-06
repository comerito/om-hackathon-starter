export const metadata = {
  requireAuth: true,
  requireFeatures: ['bounties.view'],
  pageTitle: 'Bounty Leaderboard',
  pageTitleKey: 'bounties.leaderboard.title',
  breadcrumb: [
    { label: 'Bounty Hunting', labelKey: 'bounties.judge.title', href: '/backend/bounties' },
    { label: 'Leaderboard', labelKey: 'bounties.leaderboard.title' },
  ],
}
