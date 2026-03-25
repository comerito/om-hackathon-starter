import React from 'react'

const awardIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('circle', { cx: 12, cy: 8, r: 6 }),
  React.createElement('path', { d: 'M15.477 12.89 17 22l-5-3-5 3 1.523-9.11' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['sponsors.view'],
  pageTitle: 'Sponsors & Prizes',
  pageTitleKey: 'sponsors.list.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 6,
  icon: awardIcon,
  breadcrumb: [{ label: 'Sponsors & Prizes', labelKey: 'sponsors.list.title' }],
}
