"use client"

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type ActivityItem = {
  id: string
  type: string
  pull_request_id: string | null
  actor_user_id: string | null
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const typeIcons: Record<string, string> = {
  pr_detected: '🔍',
  pr_classified: '🏷️',
  pr_approved: '✅',
  pr_rejected: '❌',
  pr_duplicate: '🔁',
  points_adjusted: '📊',
  points_revoked: '⚠️',
  classification_overridden: '✏️',
  manual_refresh: '🔄',
  pr_split_detected: '✂️',
  pr_split_ungrouped: '🔓',
}

export default function BountyActivityFeed({ competitionId = null }: { competitionId?: string | null }) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()

  const { data, isLoading } = useQuery({
    queryKey: ['bounty-activity', competitionId, scopeVersion],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '20' })
      if (competitionId) params.set('competition_id', competitionId)
      const res = await apiCall(`/api/bounties/activity?${params.toString()}`)
      return res as unknown as { items: ActivityItem[] }
    },
    refetchInterval: 5000,
  })

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold mb-3">{t('bounties.activity.title', 'Activity Feed')}</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
      ) : (
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {(data?.items ?? []).map(item => (
            <div key={item.id} className="flex items-start gap-2 text-sm py-1">
              <span className="flex-shrink-0">{typeIcons[item.type] ?? '📋'}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0 w-16">
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-sm">{item.message}</span>
            </div>
          ))}
          {(data?.items ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t('bounties.activity.empty', 'No activity yet')}</p>
          )}
        </div>
      )}
    </div>
  )
}
