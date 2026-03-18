'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Announcement {
  id: string
  competition_id: string
  author_id: string
  title: string
  content: string
  priority: 'info' | 'warning' | 'urgent'
  target_roles: string[]
  target_track_ids: string[]
  pinned: boolean
  published_at: string
  created_at: string
}

interface Competition {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<string, string> = {
  info: 'border-l-4 border-l-muted-foreground/30',
  warning: 'border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20',
  urgent: 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
}

const PRIORITY_LABELS: Record<string, string> = {
  info: 'Info',
  warning: 'Warning',
  urgent: 'Urgent',
}

const PRIORITY_BADGE_STYLES: Record<string, string> = {
  info: 'bg-muted text-muted-foreground',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalAnnouncementsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp: Competition | null = compRes?.data?.[0] ?? null
      if (!comp) {
        setAnnouncements([])
        return
      }

      const annRes = await apiCall(`/api/competitions/announcements?competitionId=${comp.id}&pageSize=100&sortField=published_at&sortDir=desc`)
      setAnnouncements(annRes?.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Refresh on new announcements
  usePortalAppEvent('competitions.announcement.created', () => { fetchData() })

  // Separate pinned from unpinned
  const { pinnedItems, unpinnedItems } = useMemo(() => {
    const pinned: Announcement[] = []
    const unpinned: Announcement[] = []
    for (const a of announcements) {
      if (a.pinned) {
        pinned.push(a)
      } else {
        unpinned.push(a)
      }
    }
    return { pinnedItems: pinned, unpinnedItems: unpinned }
  }, [announcements])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (announcements.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('competitions.portal.announcements.title', 'Announcements')} />
        <PortalEmptyState
          title={t('competitions.portal.announcements.empty', 'No announcements yet')}
          description="Check back later for updates from the organizers."
        />
      </div>
    )
  }

  const renderAnnouncement = (a: Announcement) => (
    <PortalCard
      key={a.id}
      className={PRIORITY_STYLES[a.priority] ?? PRIORITY_STYLES.info}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {a.pinned && (
                <span className="text-xs text-muted-foreground" title="Pinned">
                  &#128204;
                </span>
              )}
              <h3 className="font-semibold">{a.title}</h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(a.published_at)}
            </span>
          </div>
          {a.priority !== 'info' && (
            <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_BADGE_STYLES[a.priority]}`}>
              {PRIORITY_LABELS[a.priority]}
            </span>
          )}
        </div>

        <p className="whitespace-pre-wrap text-sm text-foreground/80">{a.content}</p>
      </div>
    </PortalCard>
  )

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('competitions.portal.announcements.title', 'Announcements')} />

      {/* Pinned items at top */}
      {pinnedItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {t('competitions.portal.announcements.pinned', 'Pinned')}
          </h2>
          {pinnedItems.map(renderAnnouncement)}
        </div>
      )}

      {/* Regular items */}
      {unpinnedItems.length > 0 && (
        <div className="flex flex-col gap-3">
          {pinnedItems.length > 0 && (
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t('competitions.portal.announcements.recent', 'Recent')}
            </h2>
          )}
          {unpinnedItems.map(renderAnnouncement)}
        </div>
      )}
    </div>
  )
}
