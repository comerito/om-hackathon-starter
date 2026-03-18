import React from 'react'
import { LayoutDashboard } from 'lucide-react'

export const metadata = {
  navHidden: false,
  icon: React.createElement(LayoutDashboard, { className: 'size-4' }),
  requireAuth: true,
  requireFeatures: ['competitions.view'],
  pageTitle: 'Command Center',
  pageTitleKey: 'competitions.commandCenter.page.title',
  pageGroup: 'HackOn',
  pageGroupKey: 'hackon.nav.group',
  pageOrder: 50,
}
