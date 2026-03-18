import React from 'react'
import { Trophy } from 'lucide-react'

export const metadata = {
  icon: React.createElement(Trophy, { className: 'size-4' }),
  requireAuth: true,
  requireFeatures: ['competitions.view'],
  pageGroup: 'HackOn',
  order: 100,
}
