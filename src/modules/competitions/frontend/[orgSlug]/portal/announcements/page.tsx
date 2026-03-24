"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import { PortalPageTitle, PortalBadge } from '@/components/portal'

type Announcement = {
  id: string; title: string; content: string; priority: string
  pinned: boolean; published_at: string; category?: string
  action_url?: string | null; action_label?: string | null
}

const categoryVariants: Record<string, 'primary' | 'warning' | 'success' | 'danger' | 'muted'> = {
  general: 'muted',
  logistics: 'primary',
  technical: 'success',
  judging: 'warning',
  sponsor: 'danger',
}

const priorityStyles: Record<string, string> = {
  info: 'border-l-4 border-l-blue-400',
  warning: 'border-l-4 border-l-yellow-400 bg-yellow-50/50',
  urgent: 'border-l-4 border-l-red-500 bg-red-50/50',
}

function AnnouncementsContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()
  const [refreshKey, setRefreshKey] = React.useState(0)

  usePortalAppEvent('competitions.announcement.created', () => {
    setRefreshKey((k) => k + 1)
  })

  const { data, isLoading } = useQuery({
    queryKey: ['portal-announcements', selectedId, refreshKey],
    queryFn: async () => {
      if (!selectedId) return { items: [] as Announcement[] }
      const { ok, result } = await apiCall<{ items: Announcement[] }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=announcements`,
      )
      if (!ok || !result) throw new Error('Failed to load')
      return result
    },
    enabled: !!selectedId,
  })

  const items = data?.items ?? []

  if (!selectedId) {
    return <PortalEmptyState title={t('competitions.portal.announcements.noCompetition', 'Select a competition')} description={t('competitions.portal.announcements.noCompetitionDesc', 'Choose a competition to view announcements.')} />
  }

  if (isLoading) {
    return <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
  }

  if (items.length === 0) {
    return <PortalEmptyState title={t('competitions.portal.announcements.empty', 'No announcements yet')} description={t('competitions.portal.announcements.emptyDesc', 'Check back soon for updates from the organizers.')} />
  }

  const pinned = items.filter((a) => a.pinned)
  const regular = items.filter((a) => !a.pinned)

  return (
    <div className="space-y-3">
      {pinned.map((a) => (
        <PortalCard key={a.id} className={priorityStyles[a.priority] ?? ''}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium bg-primary/10 text-primary rounded px-1.5 py-0.5">{t('competitions.portal.announcements.pinned', 'Pinned')}</span>
              {a.category && a.category !== 'general' && (
                <PortalBadge variant={categoryVariants[a.category] ?? 'muted'}>{a.category}</PortalBadge>
              )}
              <span className="text-xs text-muted-foreground">{new Date(a.published_at).toLocaleDateString()}</span>
            </div>
            <h3 className="font-medium">{a.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.content}</p>
            {a.action_url && (
              <a href={a.action_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm font-medium text-primary hover:underline">
                {a.action_label || 'Learn more'}
              </a>
            )}
          </div>
        </PortalCard>
      ))}
      {regular.map((a) => (
        <PortalCard key={a.id} className={priorityStyles[a.priority] ?? ''}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">{new Date(a.published_at).toLocaleDateString()}</span>
              {a.category && a.category !== 'general' && (
                <PortalBadge variant={categoryVariants[a.category] ?? 'muted'}>{a.category}</PortalBadge>
              )}
              {a.priority === 'urgent' && <span className="text-xs font-medium bg-red-100 text-red-700 rounded px-1.5 py-0.5">{t('competitions.portal.announcements.urgent', 'Urgent')}</span>}
            </div>
            <h3 className="font-medium">{a.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.content}</p>
            {a.action_url && (
              <a href={a.action_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm font-medium text-primary hover:underline">
                {a.action_label || 'Learn more'}
              </a>
            )}
          </div>
        </PortalCard>
      ))}
    </div>
  )
}

export default function AnnouncementsPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <PortalPageTitle label={t('competitions.portal.announcements.label', 'News & Updates')} title={t('competitions.portal.announcements.title', 'Announcements')} />
      <AnnouncementsContent />
    </PortalCompetitionLayout>
  )
}
