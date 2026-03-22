"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'

type AgendaItem = {
  id: string; title: string; description: string | null; type: string
  starts_at: string; ends_at: string; location: string | null; speaker_name: string | null
  speaker_bio: string | null; is_mandatory: boolean
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  ceremony: { bg: 'bg-purple-50', text: 'text-purple-700' },
  talk: { bg: 'bg-green-50', text: 'text-green-700' },
  workshop: { bg: 'bg-blue-50', text: 'text-blue-700' },
  break: { bg: 'bg-gray-50', text: 'text-gray-600' },
  meal: { bg: 'bg-orange-50', text: 'text-orange-700' },
  deadline: { bg: 'bg-red-50', text: 'text-red-700' },
  demo_session: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  custom: { bg: 'bg-indigo-50', text: 'text-indigo-700' },
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)}-${formatTime(endsAt)}`
}

function getDayKey(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toISOString().split('T')[0]
}

function getDayLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString([], { weekday: 'long' })
}

function AgendaContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['portal-agenda', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] as AgendaItem[] }
      const { ok, result } = await apiCall<{ items: AgendaItem[] }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=agenda`,
      )
      if (!ok || !result) throw new Error('Failed to load')
      return result
    },
    enabled: !!selectedId,
  })

  const items = data?.items ?? []

  // Group items by day
  const days = React.useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const item of items) {
      const key = getDayKey(item.starts_at)
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    // Sort each day's items by start time
    for (const [, dayItems] of map) {
      dayItems.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  // Auto-select first day
  React.useEffect(() => {
    if (days.length > 0 && !selectedDay) {
      setSelectedDay(days[0][0])
    }
  }, [days, selectedDay])

  if (!selectedId) {
    return <PortalEmptyState title={t('competitions.portal.agenda.noCompetition', 'Select a competition')} description={t('competitions.portal.agenda.noCompetitionDesc', 'Choose a competition to view its agenda.')} />
  }

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">{t('common.loading', 'Loading...')}</div>
  }

  if (items.length === 0) {
    return <PortalEmptyState title={t('competitions.portal.agenda.empty', 'No agenda items yet')} description={t('competitions.portal.agenda.emptyDesc', 'The schedule will be published soon.')} />
  }

  const activeDayItems = days.find(([key]) => key === selectedDay)?.[1] ?? []

  return (
    <div className="space-y-0">
      {/* Day tabs */}
      {days.length > 1 && (
        <div className="flex gap-0 border-b mb-6">
          {days.map(([key]) => {
            const label = getDayLabel(key + 'T00:00:00')
            const isActive = key === selectedDay
            return (
              <button
                key={key}
                onClick={() => setSelectedDay(key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Day header */}
      {selectedDay && (
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {getDayLabel(selectedDay + 'T00:00:00')}
          </span>
        </div>
      )}

      {/* Timeline */}
      <div className="divide-y divide-border">
        {activeDayItems.map((item) => {
          const typeColor = TYPE_COLORS[item.type] ?? TYPE_COLORS.custom
          const typeLabel = item.type.replace(/_/g, ' ').toUpperCase()

          return (
            <div key={item.id} className="flex items-start gap-6 py-5 group">
              {/* Time column */}
              <div className="w-[160px] shrink-0 pt-0.5">
                <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
                  {formatTimeRange(item.starts_at, item.ends_at)}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold leading-snug">
                      {item.title}
                    </h3>
                    {(item.description || item.speaker_name) && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {item.speaker_name && <>{item.speaker_name} — </>}
                        {item.description}
                      </p>
                    )}
                    {item.location && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                        {item.location}
                      </p>
                    )}
                  </div>

                  {/* Type badge */}
                  <span className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${typeColor.bg} ${typeColor.text}`}
                    style={{ borderColor: 'transparent' }}>
                    {typeLabel}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AgendaPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <PortalPageHeader title={t('competitions.portal.agenda.title', 'Agenda')} label={t('competitions.portal.agenda.label', 'Schedule')} />
      <AgendaContent />
    </PortalCompetitionLayout>
  )
}
