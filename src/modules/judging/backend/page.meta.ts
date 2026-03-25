import React from 'react'

// lucide:gavel
const gavelIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'm14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8' }),
  React.createElement('path', { d: 'm16 16 6-6' }),
  React.createElement('path', { d: 'm8 8 6-6' }),
  React.createElement('path', { d: 'm9 7 8 8' }),
  React.createElement('path', { d: 'm21 11-8-8' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['judging.view'],
  pageTitle: 'Demos & Judging',
  pageTitleKey: 'judging.list.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 5,
  icon: gavelIcon,
  breadcrumb: [
    { label: 'Demos & Judging', labelKey: 'judging.list.title' },
  ],
}
