import React from 'react'
import { Award } from 'lucide-react'

export const metadata = {
  icon: React.createElement(Award, { className: 'size-4' }),
  requireAuth: true,
  requireFeatures: ['sponsors.view'],
  pageGroup: 'HackOn',
  order: 700,
}
