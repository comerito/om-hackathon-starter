"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import {
  PortalPageTitle,
  SectionLabel,
  GradientCard,
  PortalBadge,
  ActionLink,
  CountdownWidget,
} from '@/components/portal'

type Track = {
  id: string; name: string; description: string | null; color: string
  icon_url: string | null; max_teams: number | null; order: number
}

type TeamsByTrack = Record<string, number>

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

function TrackIcon({ color, iconUrl, size = 'md' }: { color: string; iconUrl: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const iconName = iconUrl?.startsWith('lucide:') ? iconUrl.replace('lucide:', '') : null
  const paths = iconName ? LUCIDE_PATHS[iconName] : null
  const dims = size === 'lg' ? { box: 'h-14 w-14', svg: 28 } : size === 'sm' ? { box: 'h-9 w-9', svg: 18 } : { box: 'h-11 w-11', svg: 24 }

  return (
    <div className={cn('flex items-center justify-center rounded-xl', dims.box)} style={{ backgroundColor: `${color}15` }}>
      {paths ? (
        <svg width={dims.svg} height={dims.svg} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {paths}
        </svg>
      ) : (
        <div className="h-5 w-5 rounded-full" style={{ backgroundColor: color }} />
      )}
    </div>
  )
}

/* ---------- (placeholder avatars removed — using real team counts) ---------- */

/* ---------- Filter pill button ---------- */
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-colors',
        active
          ? 'bg-portal-primary text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
      )}
    >
      {label}
    </button>
  )
}

/* ---------- Main content ---------- */
function TracksContent() {
  const t = useT()
  const { orgSlug } = usePortalContext()
  const { selectedId, selected } = useCompetitionContext()
  const [activeFilter, setActiveFilter] = React.useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['portal-tracks', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] as Track[] }
      const { ok, result } = await apiCall<{ items: Track[] }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=tracks`,
      )
      if (!ok || !result) return { items: [] as Track[] }
      return result
    },
    enabled: !!selectedId,
  })

  // Fetch team counts per track from stats
  const { data: statsData } = useQuery({
    queryKey: ['portal-tracks-stats', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<{
        participant_count: number; track_count: number; team_count: number
      }>(`/api/competitions/portal/competition-stats?competition_id=${selectedId}`)
      return ok && result ? result : null
    },
    enabled: !!selectedId,
  })

  // Fetch teams to count per track
  const { data: teamsData } = useQuery({
    queryKey: ['portal-tracks-teams', selectedId],
    queryFn: async () => {
      if (!selectedId) return { items: [] }
      const { ok, result } = await apiCall<{ items: Array<{ id: string; track_id: string | null; name: string }> }>(
        `/api/competitions/portal/competition-data?competition_id=${selectedId}&type=projects`,
      )
      return ok && result ? result : { items: [] }
    },
    enabled: !!selectedId,
  })

  // Fetch prize pool from sponsors
  const { data: sponsorsData } = useQuery({
    queryKey: ['portal-tracks-sponsors', selectedId],
    queryFn: async () => {
      if (!selectedId) return { sponsors: [], prizes: [] }
      const { ok, result } = await apiCall<{ sponsors: unknown[]; prizes: Array<{ value: string | null }> }>(
        `/api/sponsors/portal/sponsors-view?competition_id=${selectedId}`,
      )
      return ok && result ? result : { sponsors: [], prizes: [] }
    },
    enabled: !!selectedId,
  })

  // Compute team counts per track
  const teamCountByTrack = React.useMemo<TeamsByTrack>(() => {
    const counts: TeamsByTrack = {}
    for (const project of teamsData?.items ?? []) {
      if (project.track_id) {
        counts[project.track_id] = (counts[project.track_id] ?? 0) + 1
      }
    }
    return counts
  }, [teamsData])

  // Compute total prize pool
  const totalPrizePool = React.useMemo(() => {
    return (sponsorsData?.prizes ?? []).reduce((sum, p) => {
      const val = p.value ? parseFloat(p.value.replace(/[^0-9.]/g, '')) : 0
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }, [sponsorsData])

  const totalTeams = statsData?.team_count ?? 0

  if (!selectedId) {
    return <PortalEmptyState title={t('tracks.portal.noCompetition', 'Select a competition')} description={t('tracks.portal.noCompetitionDesc', 'Choose a competition to view its tracks.')} />
  }

  const tracks = data?.items ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PortalPageTitle
          label={t('tracks.portal.hubLabel', 'Competition Hub')}
          title={t('tracks.portal.title', 'Competition Tracks')}
        />
        <div className="rounded-xl border border-gray-100 bg-white p-8">
          <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    )
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PortalPageTitle
          label={t('tracks.portal.hubLabel', 'Competition Hub')}
          title={t('tracks.portal.title', 'Competition Tracks')}
          rightElement={selected?.ends_at ? <CountdownWidget targetDate={selected.ends_at} /> : undefined}
        />
        <PortalEmptyState title={t('tracks.portal.empty', 'No tracks available')} description={t('tracks.portal.emptyDesc', 'Tracks will be published by the organizers soon.')} />
      </div>
    )
  }

  // Use the first track as the "featured active" track
  const featuredTrack = tracks[0]

  // Derive unique category-like names from track names for filter pills
  const filterLabels = ['All Tracks', ...tracks.map(tr => tr.name)]

  // Filtered tracks for the grid
  const filteredTracks = activeFilter === 'all'
    ? tracks
    : tracks.filter(tr => tr.name === activeFilter)

  return (
    <div className="flex flex-col gap-8">
      {/* ---- Page header ---- */}
      <PortalPageTitle
        label={t('tracks.portal.hubLabel', 'Competition Hub')}
        title={t('tracks.portal.title', 'Competition Tracks')}
        rightElement={selected?.ends_at ? <CountdownWidget targetDate={selected.ends_at} /> : undefined}
      />

      {/* ---- Top row: Featured track + Prize pool ---- */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Featured active track card */}
        <div className="lg:col-span-3 flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div>
            <PortalBadge variant="success" className="mb-4">
              {t('tracks.portal.activeTrack', 'Active Track')}
            </PortalBadge>
            <div className="mb-3 flex items-center gap-3">
              <TrackIcon color={featuredTrack.color} iconUrl={featuredTrack.icon_url} size="lg" />
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {featuredTrack.name}
              </h2>
            </div>
            {featuredTrack.description && (
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                {featuredTrack.description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                {teamCountByTrack[featuredTrack.id] ?? 0} / {featuredTrack.max_teams ?? '∞'} {t('tracks.portal.teamsJoined', 'Teams Joined')}
              </span>
            </div>
            <button
              type="button"
              className="rounded-lg bg-portal-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary/90"
            >
              {t('tracks.portal.viewDashboard', 'View Dashboard')}
            </button>
          </div>
        </div>

        {/* Prize pool gradient card */}
        <GradientCard className="lg:col-span-2 flex flex-col justify-between">
          <div>
            <SectionLabel className="mb-2 !text-white/70">{t('tracks.portal.totalPrizePool', 'Total Prize Pool')}</SectionLabel>
            <p className="font-display text-4xl font-bold tracking-tight">
              {totalPrizePool > 0 ? `$${totalPrizePool.toLocaleString()}` : t('tracks.portal.tbd', 'TBD')}
            </p>
          </div>
          <div className="mt-6">
            <ActionLink href={`/${orgSlug}/portal/sponsors`} className="!text-white/90 hover:!text-white">
              {t('tracks.portal.viewRewards', 'View Reward Breakdown')}
            </ActionLink>
          </div>
        </GradientCard>
      </div>

      {/* ---- Track grid section ---- */}
      <div className="flex flex-col gap-5">
        {/* Section header with filter pills */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
            {t('tracks.portal.availableTracks', 'Available Tracks')}
          </h2>
          <div className="flex flex-wrap gap-2">
            <FilterPill
              label={t('tracks.portal.allTracks', 'All Tracks')}
              active={activeFilter === 'all'}
              onClick={() => setActiveFilter('all')}
            />
            {tracks.map(tr => (
              <FilterPill
                key={tr.id}
                label={tr.name}
                active={activeFilter === tr.name}
                onClick={() => setActiveFilter(tr.name)}
              />
            ))}
          </div>
        </div>

        {/* Track cards grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTracks.map((track, idx) => {
            const globalIdx = tracks.findIndex(tr => tr.id === track.id)
            const teamCount = teamCountByTrack[track.id] ?? 0
            const maxTeams = track.max_teams ?? '∞'

            return (
              <div
                key={track.id}
                className="group relative flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex flex-col gap-3 px-6 pt-5 pb-4">
                  {/* Track number */}
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-portal-secondary">
                    {t('tracks.portal.trackNumber', 'Track')} {String(globalIdx + 1).padStart(2, '0')}
                  </span>

                  {/* Icon */}
                  <TrackIcon color={track.color} iconUrl={track.icon_url} />

                  {/* Name */}
                  <h3 className="text-lg font-bold leading-tight text-foreground">{track.name}</h3>

                  {/* Description */}
                  {track.description && (
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {track.description}
                    </p>
                  )}
                </div>

                {/* Bottom accent bar */}
                <div className="mx-6 h-1 rounded-full" style={{ backgroundColor: track.color }} />

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-6 pb-5 pt-4">
                  <span className="text-xs font-medium text-muted-foreground">
                    {teamCount} / {maxTeams} {t('tracks.portal.teams', 'Teams')}
                  </span>
                  <div className="flex items-center gap-3">
                    <ActionLink href={`/${orgSlug}/portal/team`} className="text-[11px]">
                      {t('tracks.portal.details', 'Details')}
                    </ActionLink>
                    <button
                      type="button"
                      className="rounded-lg bg-portal-primary px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary/90"
                    >
                      {t('tracks.portal.joinTrack', 'Join Track')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Suggestion card (always last) */}
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {t('tracks.portal.suggestTitle', "Don't see your track?")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('tracks.portal.suggestDesc', 'Suggest a wild-card track to the admins')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Page entry point ---------- */
export default function TracksPortalPage({ params }: { params: { orgSlug: string } }) {
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <TracksContent />
    </PortalCompetitionLayout>
  )
}
