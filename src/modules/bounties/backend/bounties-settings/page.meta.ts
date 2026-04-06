export const metadata = {
  requireAuth: true,
  requireFeatures: ['bounties.view'],
  pageTitle: 'Bounty Settings',
  pageTitleKey: 'bounties.settings.title',
  breadcrumb: [
    { label: 'Bounty Hunting', labelKey: 'bounties.judge.title', href: '/backend/bounties' },
    { label: 'Settings', labelKey: 'bounties.settings.title' },
  ],
}
