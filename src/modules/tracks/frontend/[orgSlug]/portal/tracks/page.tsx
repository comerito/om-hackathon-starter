"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'

type Track = {
  id: string; name: string; description: string | null; color: string
  icon_url: string | null; max_teams: number | null; order: number
}

const LUCIDE_PATHS: Record<string, React.ReactNode> = {
  cpu: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" /></>,
  brain: <><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M12 5v13" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></>,
  palette: <><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" /><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" /><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" /><circle cx="6.5" cy="12" r="0.5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" /></>,
  shield: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></>,
  rocket: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>,
  heart: <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></>,
  zap: <><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" /></>,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  smartphone: <><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></>,
  cloud: <><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></>,
  lock: <><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></>,
  'gamepad-2': <><line x1="6" x2="10" y1="11" y2="11" /><line x1="8" x2="8" y1="9" y2="13" /><line x1="15" x2="15.01" y1="12" y2="12" /><line x1="18" x2="18.01" y1="10" y2="10" /><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" /></>,
  leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
  lightbulb: <><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></>,
  microscope: <><path d="M6 18h8" /><path d="M3 22h18" /><path d="M14 22a7 7 0 1 0 0-14h-1" /><path d="M9 14h2" /><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" /><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" /></>,
  wifi: <><path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" /><path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" /></>,
}

function TrackIcon({ color, iconUrl }: { color: string; iconUrl: string | null }) {
  const iconName = iconUrl?.startsWith('lucide:') ? iconUrl.replace('lucide:', '') : null
  const paths = iconName ? LUCIDE_PATHS[iconName] : null

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}>
      {paths ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {paths}
        </svg>
      ) : (
        <div className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
      )}
    </div>
  )
}

function TracksContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()

  const { data, isLoading } = useQuery({
    queryKey: ['portal-tracks', selectedId],
    queryFn: () => {
      if (!selectedId) return { items: [] as Track[], total: 0, page: 1, pageSize: 50, totalPages: 0 }
      return fetchCrudList<Track>('tracks/tracks', { pageSize: '50', sortField: 'sort_order', sortDir: 'asc', competition_id: selectedId })
    },
    enabled: !!selectedId,
  })

  if (!selectedId) {
    return <PortalEmptyState title={t('tracks.portal.noCompetition', 'Select a competition')} description={t('tracks.portal.noCompetitionDesc', 'Choose a competition to view its tracks.')} />
  }

  const tracks = data?.items ?? []

  if (isLoading) {
    return <PortalCard><div className="p-6 text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</div></PortalCard>
  }

  if (tracks.length === 0) {
    return <PortalEmptyState title={t('tracks.portal.empty', 'No tracks available')} description={t('tracks.portal.emptyDesc', 'Tracks will be published by the organizers soon.')} />
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tracks.map((track, idx) => (
        <div key={track.id} className="group relative flex flex-col rounded-xl border bg-card transition-all hover:shadow-lg hover:border-border/80">
          {/* Header with track number */}
          <div className="px-6 pt-5 pb-0">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {t('tracks.portal.trackNumber', 'Track')} {String(idx + 1).padStart(2, '0')}
              </span>
              {track.max_teams && (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {track.max_teams} {t('tracks.portal.teams', 'teams max')}
                </span>
              )}
            </div>

            {/* Icon */}
            <div className="mb-4">
              <TrackIcon color={track.color} iconUrl={track.icon_url} />
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold leading-tight mb-2">{track.name}</h3>

            {/* Description */}
            {track.description && (
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{track.description}</p>
            )}
          </div>

          {/* Footer with category badge */}
          <div className="mt-auto px-6 pb-5 pt-2">
            <span
              className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{
                borderColor: track.color,
                color: track.color,
              }}
            >
              {track.name}
            </span>
          </div>

          {/* Left color accent bar */}
          <div
            className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: track.color }}
          />
        </div>
      ))}
    </div>
  )
}

export default function TracksPortalPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <CompetitionProvider>
      <CompetitionSelector />
      <div className="flex flex-col gap-6">
        <PortalPageHeader title={t('tracks.portal.title', 'Tracks')} label={t('tracks.portal.label', 'Competition Categories')} />
        <TracksContent />
      </div>
    </CompetitionProvider>
  )
}
