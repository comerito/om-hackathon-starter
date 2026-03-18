import React from 'react'
import { LayoutDashboard } from 'lucide-react'

export const metadata = {
  navHidden: false,
  icon: React.createElement(LayoutDashboard, { className: 'size-4' }),
  requireAuth: true,
  requireFeatures: ['competitions.view'],
  pageGroup: 'HackOn',
  order: 50,
}
