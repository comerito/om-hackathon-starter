import React from 'react'

// lucide:folder-open
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'M4 20h14a2 2 0 0 0 1.94-1.515L22 10H6.5a2 2 0 0 0-1.94 1.515L2 20Z' }),
  React.createElement('path', { d: 'M2 20V6a2 2 0 0 1 2-2h4l2 2h5a2 2 0 0 1 2 2v2' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['teams.view'],
  pageTitle: 'Resources',
  pageTitleKey: 'teams.resources.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 16,
  icon,
  breadcrumb: [{ label: 'Resources', labelKey: 'teams.resources.title' }],
}
