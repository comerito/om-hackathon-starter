"use client"
import * as React from 'react'
import { CompetitionProvider } from './CompetitionContext'
import { CompetitionSelector } from './CompetitionSelector'
import { AcceptTermsGate } from './AcceptTermsGate'

export function PortalCompetitionLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompetitionProvider>
      <CompetitionSelector />
      <AcceptTermsGate>
        {children}
      </AcceptTermsGate>
    </CompetitionProvider>
  )
}
