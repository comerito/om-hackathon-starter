"use client"

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { PortalPageTitle } from '@/components/portal'

/**
 * Shown on portal bounty pages when the selected competition has no bounty
 * track assigned — the same condition that hides the Bounty Hunting nav group.
 */
export function BountyUnavailableNotice({ title }: { title: string }) {
  const t = useT()
  return (
    <div className="space-y-6">
      <PortalPageTitle
        label={t('bounties.portal.unavailable.label', 'BOUNTY HUNTING')}
        title={title}
      />
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 sm:p-12 text-center">
        <AlertTriangle className="size-12 text-portal-secondary/30 mx-auto mb-4" />
        <h3 className="text-base font-semibold text-foreground mb-1">
          {t('bounties.portal.unavailable.title', 'Bounty Hunting is not available')}
        </h3>
        <p className="text-sm text-portal-secondary max-w-md mx-auto">
          {t('bounties.portal.unavailable.desc', 'This hackathon has no bounty hunting track configured. Ask an organizer if you expected to find it here.')}
        </p>
      </div>
    </div>
  )
}
