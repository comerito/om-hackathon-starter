import React from 'react'

// lucide:calendar-clock
const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5' }),
  React.createElement('path', { d: 'M16 2v4' }),
  React.createElement('path', { d: 'M8 2v4' }),
  React.createElement('path', { d: 'M3 10h5' }),
  React.createElement('circle', { cx: 16, cy: 16, r: 6 }),
  React.createElement('path', { d: 'M16 14v2l1 1' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['competitions.agenda.manage'],
  pageTitle: 'Agenda',
  pageTitleKey: 'competitions.agenda.pageTitle',
  pageGroup: 'HackOn',
  pageGroupKey: 'competitions.nav.group',
  pageOrder: 110,
  icon,
  breadcrumb: [
    { label: 'Agenda', labelKey: 'competitions.agenda.pageTitle' },
  ],
}
