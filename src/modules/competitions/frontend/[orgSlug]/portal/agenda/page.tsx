"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PortalCompetitionLayout } from '../../../../components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../components/CompetitionContext'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  MapPin, Zap, HelpCircle, Wifi, Award, Mic, Wrench, Coffee,
  UtensilsCrossed, Clock, Clapperboard, Sparkles, type LucideIcon,
} from 'lucide-react'
import { PortalPageTitle, PortalBadge, ProgressBar } from '@/components/portal'

type AgendaItem = {
  id: string; title: string; description: string | null; type: string
  starts_at: string; ends_at: string; location: string | null; speaker_name: string | null
  speaker_bio: string | null; speaker_photo_url: string | null; is_mandatory: boolean
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  ceremony: Award, talk: Mic, workshop: Wrench, break: Coffee,
  meal: UtensilsCrossed, deadline: Clock, demo_session: Clapperboard, custom: Sparkles,
}

const TYPE_BADGE_VARIANTS: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  ceremony: 'primary', talk: 'success', workshop: 'info',
  break: 'muted', meal: 'warning', deadline: 'danger',
  demo_session: 'warning', custom: 'primary',
}

const DOT_COLORS: Record<string, string> = {
  happening: 'bg-portal-primary',
  past: 'bg-gray-300',
  future: 'bg-gray-200',
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase()
}

function getDayKey(dateStr: string): string {
  return new Date(dateStr).toISOString().split('T')[0]
}

function getDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([], { weekday: 'long' })
}

function isHappeningNow(startsAt: string, endsAt: string): boolean {
  const now = Date.now()
  return now >= new Date(startsAt).getTime() && now <= new Date(endsAt).getTime()
}

function getTimeStatus(startsAt: string, endsAt: string): 'happening' | 'past' | 'future' {
  const now = Date.now()
  if (now >= new Date(startsAt).getTime() && now <= new Date(endsAt).getTime()) return 'happening'
  if (now > new Date(endsAt).getTime()) return 'past'
  return 'future'
}

/* ---------- Timeline Event Card ---------- */

function TimelineEventCard({ item }: { item: AgendaItem }) {
  const status = getTimeStatus(item.starts_at, item.ends_at)
  const happening = status === 'happening'
  const typeLabel = item.type.replace(/_/g, ' ')

  return (
    <div className="flex gap-4">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center pt-1">
        <div
          className={cn(
            'size-8 rounded-full flex items-center justify-center text-sm shrink-0',
            happening ? 'bg-portal-primary text-white shadow-md shadow-portal-primary/30' : 'bg-gray-100 text-gray-400',
          )}
        >
          {(() => {
            const Icon = happening ? Zap : (TYPE_ICONS[item.type] ?? Sparkles)
            return <Icon className="size-4" />
          })()}
        </div>
        <div className="flex-1 w-px bg-gray-100 mt-2" />
      </div>

      {/* Event content */}
      <div className={cn('flex-1 rounded-xl border bg-white p-3 sm:p-5 mb-4', happening && 'border-portal-primary/20 shadow-sm')}>
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-sm font-semibold', happening ? 'text-portal-primary' : 'text-portal-secondary')}>
            {formatTime(item.starts_at)} — {formatTime(item.ends_at)}
          </span>
          {happening && (
            <PortalBadge variant="primary">Happening Now</PortalBadge>
          )}
        </div>

        <h3 className="text-base font-bold text-foreground leading-snug">{item.title}</h3>

        {item.description && (
          <p className="mt-2 text-sm text-portal-secondary leading-relaxed">{item.description}</p>
        )}

        <div className="mt-3 flex items-center gap-4">
          {item.location && (
            <span className="flex items-center gap-1 text-xs text-portal-secondary">
              <MapPin className="size-3" />
              {item.location}
            </span>
          )}
          <PortalBadge variant={TYPE_BADGE_VARIANTS[item.type] ?? 'muted'}>
            {typeLabel}
          </PortalBadge>
        </div>
      </div>
    </div>
  )
}

/* ---------- Agenda Content ---------- */

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

  const days = React.useMemo(() => {
    const map = new Map<string, AgendaItem[]>()
    for (const item of items) {
      const key = getDayKey(item.starts_at)
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    for (const [, dayItems] of map) {
      dayItems.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  React.useEffect(() => {
    if (days.length > 0 && !selectedDay) setSelectedDay(days[0][0])
  }, [days, selectedDay])

  if (!selectedId) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-portal-secondary">
        Select a competition to view its agenda.
      </div>
    )
  }

  if (isLoading) {
    return <div className="py-12 text-center text-portal-secondary">Loading...</div>
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-portal-secondary">
        No agenda items yet. The schedule will be published soon.
      </div>
    )
  }

  const activeDayItems = days.find(([key]) => key === selectedDay)?.[1] ?? []

  // Count completed sessions for progress
  const mainSessions = activeDayItems.filter(i => i.type !== 'break' && i.type !== 'meal')
  const completedSessions = mainSessions.filter(i => getTimeStatus(i.starts_at, i.ends_at) === 'past').length

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* Left: Timeline */}
      <div>
        {/* Day tabs */}
        {days.length > 1 && (
          <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 overflow-x-auto mb-6">
            <div className="flex gap-1 flex-nowrap">
              {days.map(([key]) => {
                const label = getDayLabel(key)
                const isActive = key === selectedDay
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDay(key)}
                    className={cn(
                      'shrink-0 px-6 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-portal-primary text-white shadow-sm'
                        : 'text-portal-secondary hover:bg-gray-100'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Timeline events */}
        <div>
          {activeDayItems.map((item) => (
            <TimelineEventCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Right: Sidebar widgets */}
      <div className="space-y-4">
        {/* Session completion */}
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">
            {selectedDay ? getDayLabel(selectedDay) : 'Day'} Completion
          </h4>
          <ProgressBar
            value={mainSessions.length > 0 ? (completedSessions / mainSessions.length) * 100 : 0}
            label={`${completedSessions} of ${mainSessions.length} main sessions completed`}
            size="md"
          />
        </div>

        {/* Featured curator — derived from first agenda item with a speaker */}
        {(() => {
          const featured = activeDayItems.find(i => i.speaker_name)
          if (!featured) return null
          return (
            <div className="rounded-xl overflow-hidden">
              <div
                className="relative h-48 bg-cover bg-center"
                style={featured.speaker_photo_url
                  ? { backgroundImage: `url(${featured.speaker_photo_url})` }
                  : { background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)' }}
              >
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">Featured Curator</p>
                  <p className="text-sm font-bold text-white">{featured.speaker_name}</p>
                  <p className="text-xs text-white/70">{featured.speaker_bio || featured.title}</p>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Info cards */}
        <div className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-8 rounded-full bg-portal-primary/10 flex items-center justify-center">
              <HelpCircle className="size-4 text-portal-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Need help?</p>
              <p className="text-[11px] text-portal-secondary">Curators are available in the Slack #help channel 24/7.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-portal-primary/10 flex items-center justify-center">
              <Wifi className="size-4 text-portal-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Wi-Fi Network</p>
              <p className="text-[11px] text-portal-secondary">SSID: HACKFEST_24<br />Pass: hackathon_2024</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Page component ---------- */

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
      <PortalPageTitle label="Event Timeline" title="The Agenda" />
      <AgendaContent />
    </PortalCompetitionLayout>
  )
}
