import React from 'react'
import { ShieldAlert } from 'lucide-react'

export const metadata = {
  icon: React.createElement(ShieldAlert, { className: 'size-4' }),
  requireAuth: true,
  requireFeatures: ['incidents.view'],
  pageTitle: 'Incidents',
  pageTitleKey: 'incidents.page.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'hackon.nav.group',
  pageOrder: 800,
}
