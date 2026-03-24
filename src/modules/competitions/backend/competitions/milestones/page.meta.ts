import React from 'react'

// lucide:flag
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' }),
  React.createElement('line', { x1: '4', x2: '4', y1: '22', y2: '15' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.milestones.manage'],
  pageTitle: 'Milestones',
  pageTitleKey: 'competitions.milestones.pageTitle',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 116,
  icon,
  breadcrumb: [
    { label: 'Milestones', labelKey: 'competitions.milestones.pageTitle' },
  ],
}
