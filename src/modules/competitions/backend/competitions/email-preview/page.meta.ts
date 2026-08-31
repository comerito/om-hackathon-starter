export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.participants.manage'],
  // NOTE: the framework reads `pageTitle` / `navHidden`. This file previously used
  // `title` / `hideFromNav`, neither of which is a recognised key — so the page was
  // NOT hidden and surfaced as a stray top-level nav item.
  pageTitle: 'Email Preview',
  pageTitleKey: 'competitions.emailPreview.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Participants', labelKey: 'competitions.participants.title', href: '/backend/competitions/participants' },
    { label: 'Email Preview', labelKey: 'competitions.emailPreview.title' },
  ],
}
