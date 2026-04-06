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
  CompetitionCountdown,
} from '@/components/portal'

type Track = {
  id: string; name: string; short_description: string | null; description: string | null; color: string
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
          : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/15',
      )}
    >
      {label}
    </button>
  )
}

type MembershipData = {
  membership: { team_id: string; role: string } | null
  team: { id: string; track_id: string | null; track_ids?: string[] } | null
}

// Frontend stage check — allow during team_formation and track_selection.
// Later stages (hacking+) are blocked unless allowTrackChange is true on the competition,
// but we don't have that flag here, so we hide buttons and let the backend reject if needed.
const ALLOWED_STAGES_FOR_TRACK_UI = ['team_formation', 'track_selection']

function canSelectTrackUI(stage: string | undefined, allowTrackChange?: boolean): boolean {
  if (!stage) return false
  if (ALLOWED_STAGES_FOR_TRACK_UI.includes(stage)) return true
  // After track_selection, only allow if competition has allowTrackChange enabled
  if (allowTrackChange) return true
  return false
}

/* ---------- Main content ---------- */
function TracksContent() {
  const t = useT()
  const { orgSlug } = usePortalContext()
  const { selectedId, selected, isLoading: contextLoading } = useCompetitionContext()
  const [activeFilter, setActiveFilter] = React.useState('all')
  const [selectingTrackId, setSelectingTrackId] = React.useState<string | null>(null)
  const [trackError, setTrackError] = React.useState<string | null>(null)
  const errorRef = React.useRef<HTMLDivElement>(null)

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

  // Fetch user's team membership (to know current track)
  const { data: membershipData, isLoading: membershipLoading, refetch: refetchMembership } = useQuery({
    queryKey: ['portal-my-membership-tracks', selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const { ok, result } = await apiCall<MembershipData>(
        `/api/teams/portal/my-membership?competition_id=${selectedId}`,
      )
      if (!ok) return null
      return result ?? null
    },
    enabled: !!selectedId,
  })

  const myTeamId = membershipData?.team?.id ?? membershipData?.membership?.team_id ?? null
  const isOwner = membershipData?.membership?.role === 'owner'
  const myTrackIds: string[] = membershipData?.team?.track_ids ?? (membershipData?.team?.track_id ? [membershipData.team.track_id] : [])
  const membershipReady = !membershipLoading
  const maxTracksPerTeam = (selected as any)?.max_tracks_per_team ?? 1

  // Determine if track selection UI should be enabled based on competition stage
  const trackSelectionAllowed = canSelectTrackUI(selected?.stage, (selected as any)?.allow_track_change)
  // "View Details" link only available from team_formation onward
  const showDetails = !!selected?.stage && !['draft', 'open'].includes(selected.stage)

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

  async function handleToggleTrack(trackId: string) {
    if (!myTeamId || selectingTrackId) return
    setTrackError(null)
    setSelectingTrackId(trackId)

    let newIds: string[]
    if (maxTracksPerTeam === 1) {
      // Radio behavior: select this one (or deselect if already selected)
      newIds = myTrackIds.includes(trackId) ? [] : [trackId]
    } else {
      // Toggle behavior
      if (myTrackIds.includes(trackId)) {
        newIds = myTrackIds.filter(id => id !== trackId)
      } else {
        if (myTrackIds.length >= maxTracksPerTeam) {
          setTrackError(t('tracks.portal.maxTracksError', 'Maximum {count} track(s) allowed per team', { count: maxTracksPerTeam }))
          setSelectingTrackId(null)
          setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
          return
        }
        newIds = [...myTrackIds, trackId]
      }
    }

    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>('/api/teams/portal/manage-tracks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ team_id: myTeamId, track_ids: newIds }),
      })
      if (!ok || !(result as any)?.ok) {
        setTrackError((result as any)?.error ?? t('tracks.portal.updateFailed', 'Failed to update tracks'))
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      } else {
        refetchMembership()
      }
    } finally {
      setSelectingTrackId(null)
    }
  }

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

  const tracks = data?.items ?? []

  // Hooks must be above all early returns
  const [featuredTabIdx, setFeaturedTabIdx] = React.useState(0)

  const hasSelectedTrack = myTrackIds.length > 0
  const featuredTracks = hasSelectedTrack
    ? tracks.filter(tr => myTrackIds.includes(tr.id))
    : tracks.length > 0 ? [tracks[0]] : []

  React.useEffect(() => {
    setFeaturedTabIdx(prev => prev >= featuredTracks.length ? 0 : prev)
  }, [featuredTracks.length])

  const featuredTrack = featuredTracks[featuredTabIdx] ?? featuredTracks[0] ?? tracks[0] ?? null

  const filteredTracks = activeFilter === 'all'
    ? tracks
    : tracks.filter(tr => tr.name === activeFilter)

  if (contextLoading || isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!selectedId) {
    return <PortalEmptyState title={t('tracks.portal.noCompetition', 'Select a competition')} description={t('tracks.portal.noCompetitionDesc', 'Choose a competition to view its tracks.')} />
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PortalPageTitle
          label={t('tracks.portal.hubLabel', 'Competition Hub')}
          title={t('tracks.portal.title', 'Competition Tracks')}
        />
        <PortalEmptyState title={t('tracks.portal.empty', 'No tracks available')} description={t('tracks.portal.emptyDesc', 'Tracks will be published by the organizers soon.')} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ---- Page header ---- */}
      <PortalPageTitle
        label={t('tracks.portal.hubLabel', 'Competition Hub')}
        title={t('tracks.portal.title', 'Competition Tracks')}
      />

      {/* ---- Error banner ---- */}
      {trackError && (
        <div ref={errorRef} className="flex items-center justify-between gap-3 rounded-xl border border-portal-danger/20 bg-portal-danger/5 px-5 py-3" style={{ animation: 'slideDown 250ms ease-out' }}>
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-portal-danger">
              <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <p className="text-sm text-portal-danger">{trackError}</p>
          </div>
          <button type="button" onClick={() => setTrackError(null)} className="shrink-0 rounded-md p-1 text-portal-danger/50 hover:bg-portal-danger/10 hover:text-portal-danger transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>
          </button>
          <style>{`@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}

      {/* ---- Stage banner when track selection is locked ---- */}
      {!trackSelectionAllowed && myTeamId && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-5 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-600 dark:text-amber-400">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {t('tracks.portal.selectionLocked', 'Track selection is currently locked. Changes are not allowed at this stage of the competition.')}
          </p>
        </div>
      )}

      {/* ---- Top row: Featured track + Prize pool ---- */}
      <div className="grid gap-5 lg:grid-cols-5">
        {/* Featured / current track card */}
        <div className="lg:col-span-3 flex flex-col justify-between rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm overflow-hidden">
          {/* Tabs — only when multiple selected tracks */}
          {featuredTracks.length > 1 && (
            <div className="flex border-b border-gray-100 dark:border-white/10">
              {featuredTracks.map((ft, idx) => (
                <button
                  key={ft.id}
                  type="button"
                  onClick={() => setFeaturedTabIdx(idx)}
                  className={cn(
                    'flex items-center gap-2 px-4 sm:px-5 py-3 text-sm font-medium transition-colors relative',
                    idx === featuredTabIdx
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-50 dark:hover:bg-white/5',
                  )}
                >
                  <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: ft.color || '#6366f1' }} />
                  <span className="truncate max-w-[120px]">{ft.name}</span>
                  {idx === featuredTabIdx && (
                    <div className="absolute bottom-0 inset-x-0 h-0.5" style={{ backgroundColor: ft.color || '#6366f1' }} />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="p-4 sm:p-6 flex flex-col flex-1 justify-between">
            <div>
              <PortalBadge variant={hasSelectedTrack ? 'success' : 'default'} className="mb-4">
                {hasSelectedTrack
                  ? (myTrackIds.length > 1
                    ? t('tracks.portal.multiSelected', '{count} Tracks Selected', { count: myTrackIds.length })
                    : t('tracks.portal.yourTrack', 'Your Track'))
                  : t('tracks.portal.featuredTrack', 'Featured Track')}
              </PortalBadge>
              <div className="mb-3 flex items-center gap-3">
                <TrackIcon color={featuredTrack.color} iconUrl={featuredTrack.icon_url} size="lg" />
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {featuredTrack.name}
                </h2>
              </div>
              {featuredTrack.short_description && (
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                  {featuredTrack.short_description}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">
                  {teamCountByTrack[featuredTrack.id] ?? 0} / {featuredTrack.max_teams ?? '∞'} {t('tracks.portal.teamsJoined', 'Teams Joined')}
                </span>
              </div>
              {showDetails && (
                <ActionLink href={`/${orgSlug}/portal/tracks/${featuredTrack.id}`}>
                  {t('tracks.portal.viewDetails', 'View Details')}
                </ActionLink>
              )}
            </div>
          </div>
        </div>

        {/* Hackathon progress countdown card */}
        <GradientCard className="lg:col-span-2 flex flex-col justify-between">
          <div>
            <SectionLabel className="mb-2 !text-white/70">
              {t('teams.portal.myTeam.section.hackathonProgress', 'Hackathon Progress')}
            </SectionLabel>
            {selected?.starts_at || selected?.ends_at ? (
              <CompetitionCountdown
                stage={selected?.stage}
                startsAt={selected?.starts_at}
                endsAt={selected?.ends_at}
                tone="inverse"
                align="start"
                size="sm"
              />
            ) : (
              <p className="text-sm text-white/70">
                {t('teams.portal.myTeam.progress.noEndDate', 'No end date set')}
              </p>
            )}
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
          {filteredTracks.map((track) => {
            const globalIdx = tracks.findIndex(tr => tr.id === track.id)
            const teamCount = teamCountByTrack[track.id] ?? 0
            const maxTeams = track.max_teams ?? '∞'
            const isMyTrack = myTrackIds.includes(track.id)
            const isFull = track.max_teams != null && teamCount >= track.max_teams
            const isSelecting = selectingTrackId === track.id
            const atTrackLimit = myTrackIds.length >= maxTracksPerTeam && !isMyTrack

            return (
              <div
                key={track.id}
                className={cn(
                  'group relative flex flex-col rounded-xl border bg-white dark:bg-white/5 shadow-sm transition-all hover:shadow-md',
                  isMyTrack ? 'border-2 ring-1' : 'border-gray-100 dark:border-white/10',
                )}
                style={isMyTrack ? { borderColor: track.color, '--tw-ring-color': `${track.color}30` } as React.CSSProperties : undefined}
              >
                {/* Selected indicator */}
                {isMyTrack && (
                  <div className="absolute -top-2.5 left-5 z-10 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm" style={{ backgroundColor: track.color }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    {t('tracks.portal.yourTrackBadge', 'Your Track')}
                  </div>
                )}

                <div className="flex flex-col gap-3 px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
                  {/* Track number */}
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-portal-secondary">
                    {t('tracks.portal.trackNumber', 'Track')} {String(globalIdx + 1).padStart(2, '0')}
                  </span>

                  {/* Icon */}
                  <TrackIcon color={track.color} iconUrl={track.icon_url} />

                  {/* Name */}
                  <h3 className="text-lg font-bold leading-tight text-foreground">{track.name}</h3>

                  {/* Short description on cards */}
                  {track.short_description && (
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {track.short_description}
                    </p>
                  )}
                </div>

                {/* Bottom accent bar */}
                <div className="mx-4 sm:mx-6 h-1 rounded-full" style={{ backgroundColor: track.color }} />

                {/* Footer */}
                <div className="flex items-center justify-between gap-2 px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4">
                  <span className="text-xs font-medium text-muted-foreground">
                    {teamCount} / {maxTeams} {t('tracks.portal.teams', 'Teams')}
                  </span>
                  <div className="flex items-center gap-3">
                    {showDetails && (
                      <ActionLink href={`/${orgSlug}/portal/tracks/${track.id}`} className="text-[11px]">
                        {t('tracks.portal.details', 'Details')}
                      </ActionLink>
                    )}

                    {!membershipReady ? (
                      /* Still loading membership */
                      <span className="rounded-lg bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-gray-300 dark:text-slate-500 animate-pulse">...</span>
                    ) : !trackSelectionAllowed ? (
                      /* Stage doesn't allow selection */
                      isMyTrack ? null : (
                        <span className="rounded-lg bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-slate-500 cursor-not-allowed">
                          {t('tracks.portal.locked', 'Locked')}
                        </span>
                      )
                    ) : !myTeamId ? (
                      /* No team — link to team page */
                      <a
                        href={`/${orgSlug}/portal/team`}
                        className="rounded-lg border border-portal-primary/30 bg-portal-primary/5 px-3 py-1.5 text-[11px] font-semibold text-portal-primary transition-colors hover:bg-portal-primary/10"
                      >
                        {t('tracks.portal.createTeamFirst', 'Create a Team to Join')}
                      </a>
                    ) : !isOwner ? (
                      /* Has team but not owner — no track actions */
                      null
                    ) : isMyTrack ? (
                      /* Already selected — show leave button */
                      <button
                        type="button"
                        disabled={isSelecting}
                        onClick={() => handleToggleTrack(track.id)}
                        className="rounded-lg border border-portal-danger/30 bg-white dark:bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-portal-danger transition-colors hover:bg-portal-danger/5 disabled:opacity-60"
                      >
                        {isSelecting ? t('common.saving', 'Saving...') : t('tracks.portal.leaveTrack', 'Leave Track')}
                      </button>
                    ) : isFull ? (
                      /* Track is full */
                      <span className="rounded-lg bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-slate-500 cursor-not-allowed">
                        {t('tracks.portal.trackFull', 'Full')}
                      </span>
                    ) : atTrackLimit ? (
                      /* Already at max tracks */
                      <span className="rounded-lg bg-gray-100 dark:bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-slate-500 cursor-not-allowed">
                        {t('tracks.portal.maxReached', 'Max Tracks Reached')}
                      </span>
                    ) : (
                      /* Has team + stage allows + not full + under limit → active join button */
                      <button
                        type="button"
                        disabled={isSelecting}
                        onClick={() => handleToggleTrack(track.id)}
                        className="rounded-lg bg-portal-primary px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-portal-primary/90 disabled:opacity-60"
                      >
                        {isSelecting ? t('common.saving', 'Saving...') : t('tracks.portal.joinTrack', 'Join Track')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}


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
