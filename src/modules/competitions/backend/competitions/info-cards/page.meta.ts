import React from 'react'

// lucide:layout-grid
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('rect', { x: 3, y: 3, width: 7, height: 7, rx: 1 }),
  React.createElement('rect', { x: 14, y: 3, width: 7, height: 7, rx: 1 }),
  React.createElement('rect', { x: 3, y: 14, width: 7, height: 7, rx: 1 }),
  React.createElement('rect', { x: 14, y: 14, width: 7, height: 7, rx: 1 }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.edit'],
  pageTitle: 'Info Cards',
  pageTitleKey: 'competitions.infoCards.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 15,
  icon,
  breadcrumb: [{ label: 'Info Cards', labelKey: 'competitions.infoCards.title' }],
}
