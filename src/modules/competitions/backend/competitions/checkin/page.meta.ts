import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
  React.createElement('path', { d: 'M7 7h.01' }),
  React.createElement('path', { d: 'M17 7h.01' }),
  React.createElement('path', { d: 'M7 17h.01' }),
  React.createElement('path', { d: 'M12 12h.01' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.checkin.manage'],
  pageTitle: 'Check-In',
  pageTitleKey: 'competitions.checkin.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 11,
  icon,
  breadcrumb: [
    { label: 'Check-In', labelKey: 'competitions.checkin.title' },
  ],
}
