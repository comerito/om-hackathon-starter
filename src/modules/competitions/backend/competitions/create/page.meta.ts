import React from 'react'

// lucide:plus-circle
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
  React.createElement('path', { d: 'M8 12h8' }),
  React.createElement('path', { d: 'M12 8v8' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.create'],
  pageTitle: 'Create Competition',
  pageTitleKey: 'competitions.create.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 102,
  icon,
  breadcrumb: [
    { label: 'Competitions', labelKey: 'competitions.list.title', href: '/backend/competitions' },
    { label: 'Create', labelKey: 'competitions.create.title' },
  ],
}
