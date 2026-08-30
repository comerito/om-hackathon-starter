export const metadata = {
  requireAuth: true,
  requireFeatures: ['sponsors.prizes.manage'],
  pageTitle: 'Add Prize',
  pageTitleKey: 'sponsors.prizes.create.title',
  // Create route with no sibling list at /backend/prizes, so it surfaced as a
  // standalone "Add Prize" nav entry. Reached from the Sponsors & Prizes page.
  navHidden: true,
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  breadcrumb: [
    { label: 'Sponsors & Prizes', labelKey: 'sponsors.list.title', href: '/backend/sponsors' },
    { label: 'Add Prize', labelKey: 'sponsors.prizes.create.title' },
  ],
}
