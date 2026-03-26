"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import { PortalPageTitle, PortalBadge, ActionLink } from '@/components/portal'
import { Info, AlertTriangle, AlertCircle, Copy, Pin } from 'lucide-react'

type Announcement = {
  id: string; title: string; content: string; priority: string
  pinned: boolean; published_at: string; category?: string
  action_url?: string | null; action_label?: string | null
}

const priorityIcons: Record<string, { bg: string; fg: string }> = {
  info: { bg: 'bg-blue-50', fg: 'text-blue-500' },
  warning: { bg: 'bg-amber-50', fg: 'text-amber-500' },
  urgent: { bg: 'bg-red-50', fg: 'text-red-500' },
}

const categoryBadgeVariants: Record<string, 'info' | 'warning' | 'danger' | 'primary' | 'success' | 'muted'> = {
  logistics: 'info',
  technical: 'warning',
  general: 'muted',
  schedule: 'primary',
  judging: 'danger',
  sponsor: 'success',
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

function AnnouncementCard({ announcement, showPinned }: { announcement: Announcement; showPinned?: boolean }) {
  const category = announcement.category || 'general'
  const actionUrl = announcement.action_url
  const actionLabel = announcement.action_label
  const isCode = announcement.content.includes('npm ') || announcement.content.includes('yarn ')
  const priority = priorityIcons[announcement.priority] ?? priorityIcons.info
  const PriorityIcon = announcement.priority === 'urgent' ? AlertCircle : announcement.priority === 'warning' ? AlertTriangle : Info

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          {showPinned && announcement.pinned && (
            <span className="flex items-center gap-1 rounded-full bg-portal-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-portal-primary">
              <Pin className="size-2.5" />
              Pinned
            </span>
          )}
          <PortalBadge variant={categoryBadgeVariants[category] ?? 'muted'}>
            {category}
          </PortalBadge>
          <span className="text-[10px] font-medium uppercase tracking-wide text-portal-secondary">
            {formatTimeAgo(announcement.published_at)}
          </span>
        </div>
        <div className={`size-7 sm:size-8 shrink-0 rounded-lg ${priority.bg} flex items-center justify-center`} title={announcement.priority}>
          <PriorityIcon className={`size-3.5 sm:size-4 ${priority.fg}`} />
        </div>
      </div>
      <h4 className="font-semibold text-sm text-foreground mb-1">{announcement.title}</h4>
      {isCode ? (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 font-mono text-xs text-portal-secondary">
          <span className="flex-1 truncate">{announcement.content}</span>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(announcement.content) }}
            className="shrink-0 text-gray-400 hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      ) : (
        <p className="text-xs text-portal-secondary whitespace-pre-wrap">{announcement.content}</p>
      )}
      {actionUrl && actionLabel && (
        <div className="mt-3">
          <ActionLink href={actionUrl}>{actionLabel}</ActionLink>
        </div>
      )}
    </div>
  )
}

function AnnouncementsContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [filter, setFilter] = React.useState<'all' | 'pinned'>('all')

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
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 rounded-xl border border-gray-100 bg-white animate-pulse" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <PortalEmptyState title={t('competitions.portal.announcements.empty', 'No announcements yet')} description={t('competitions.portal.announcements.emptyDesc', 'Check back soon for updates from the organizers.')} />
  }

  const pinnedCount = items.filter(a => a.pinned).length
  const filtered = filter === 'pinned' ? items.filter(a => a.pinned) : items

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      {pinnedCount > 0 && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
              filter === 'all' ? 'bg-portal-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('pinned')}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
              filter === 'pinned' ? 'bg-portal-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pinned ({pinnedCount})
          </button>
        </div>
      )}

      {/* Announcement cards */}
      <div className="space-y-3">
        {filtered.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} showPinned={filter === 'all'} />
        ))}
      </div>
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
