"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'

type Announcement = {
  id: string; title: string; content: string; priority: string
  pinned: boolean; published_at: string
}

const priorityStyles: Record<string, string> = {
  info: 'border-l-4 border-l-blue-400',
  warning: 'border-l-4 border-l-yellow-400 bg-yellow-50/50',
  urgent: 'border-l-4 border-l-red-500 bg-red-50/50',
}

export default function AnnouncementsPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()
  const [refreshKey, setRefreshKey] = React.useState(0)

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  usePortalAppEvent('competitions.announcement.created', () => {
    setRefreshKey((k) => k + 1)
  })

  const { data, isLoading } = useQuery({
    queryKey: ['portal-announcements', refreshKey],
    queryFn: () => fetchCrudList<Announcement>('competitions/announcements', { pageSize: '50', sortField: 'created_at', sortDir: 'desc' }),
    enabled: !!auth.user,
  })

  if (auth.loading || !auth.user) return null
  const items = data?.items ?? []
  const pinned = items.filter((a) => a.pinned)
  const regular = items.filter((a) => !a.pinned)

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('competitions.portal.announcements.title', 'Announcements')} label={t('competitions.portal.announcements.label', 'News & Updates')} />

      {isLoading ? (
        <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
      ) : items.length === 0 ? (
        <PortalEmptyState title={t('competitions.portal.announcements.empty', 'No announcements yet')} description={t('competitions.portal.announcements.emptyDesc', 'Check back soon for updates from the organizers.')} />
      ) : (
        <div className="space-y-3">
          {pinned.map((a) => (
            <PortalCard key={a.id} className={priorityStyles[a.priority] ?? ''}>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium bg-primary/10 text-primary rounded px-1.5 py-0.5">{t('competitions.portal.announcements.pinned', 'Pinned')}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.published_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-medium">{a.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.content}</p>
              </div>
            </PortalCard>
          ))}
          {regular.map((a) => (
            <PortalCard key={a.id} className={priorityStyles[a.priority] ?? ''}>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">{new Date(a.published_at).toLocaleDateString()}</span>
                  {a.priority === 'urgent' && <span className="text-xs font-medium bg-red-100 text-red-700 rounded px-1.5 py-0.5">{t('competitions.portal.announcements.urgent', 'Urgent')}</span>}
                </div>
                <h3 className="font-medium">{a.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.content}</p>
              </div>
            </PortalCard>
          ))}
        </div>
      )}
    </div>
  )
}
