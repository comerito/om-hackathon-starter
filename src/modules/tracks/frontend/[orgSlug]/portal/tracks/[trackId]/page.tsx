"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { MarkdownContent } from '@open-mercato/ui/backend/markdown/MarkdownContent'
import { PortalCompetitionLayout } from '../../../../../../competitions/components/PortalCompetitionLayout'
import {
  PortalPageTitle,
  SectionLabel,
  PortalBadge,
} from '@/components/portal'

type TrackDetail = {
  id: string; name: string; short_description: string | null; description: string | null
  color: string; icon_url: string | null; max_teams: number | null
  category: string | null; badge: string | null; competition_id: string
}

type Criterion = {
  id: string; name: string; description: string | null
  max_score: number; weight: number; round: string; order: number; is_global: boolean
}

type Attachment = {
  id: string; file_name: string; file_size: number; url: string; mime_type: string
}

const LUCIDE_PATHS: Record<string, React.ReactNode> = {
  cpu: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" /></>,
  brain: <><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M12 5v13" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></>,
  rocket: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>,
  code: <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  shield: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></>,
  zap: <><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" /></>,
  heart: <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></>,
  palette: <><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" /><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" /><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" /><circle cx="6.5" cy="12" r="0.5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" /></>,
}

function TrackIcon({ color, iconUrl }: { color: string; iconUrl: string | null }) {
  const iconName = iconUrl?.startsWith('lucide:') ? iconUrl.replace('lucide:', '') : null
  const paths = iconName ? LUCIDE_PATHS[iconName] : null
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}15` }}>
      {paths ? (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
      ) : (
        <div className="h-8 w-8 rounded-full" style={{ backgroundColor: color }} />
      )}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function TrackDetailContent({ trackId }: { trackId: string }) {
  const t = useT()
  const { orgSlug } = usePortalContext()
  const roundLabels: Record<string, string> = {
    preliminary: t('tracks.portal.round.preliminary', 'Preliminary'),
    final: t('tracks.portal.round.final', 'Final'),
    both: t('tracks.portal.round.both', 'Both Rounds'),
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-track-detail', trackId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ track: TrackDetail; criteria: Criterion[]; attachments: Attachment[] }>(
        `/api/tracks/portal/track-detail?track_id=${trackId}`,
      )
      if (!ok || !result) throw new Error(t('tracks.portal.notFound', 'Track not found'))
      return result
    },
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PortalPageTitle label={t('tracks.portal.detailLabel', 'Track Details')} title={t('common.loading', 'Loading...')} />
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-8">
          <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return <PortalEmptyState title={t('tracks.portal.notFound', 'Track not found')} description={t('tracks.portal.notFoundDesc', 'This track may have been removed.')} />
  }

  const { track, criteria, attachments } = data
  const globalCriteria = criteria.filter(c => c.is_global)
  const trackCriteria = criteria.filter(c => !c.is_global)

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <a href={`/${orgSlug}/portal/tracks`} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          {t('tracks.portal.backToTracks', 'Back to Tracks')}
        </a>
        <div className="flex items-start gap-5">
          <TrackIcon color={track.color} iconUrl={track.icon_url} />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{track.name}</h1>
              {track.badge && <PortalBadge variant="default">{track.badge.toUpperCase()}</PortalBadge>}
            </div>
            {track.short_description && (
              <p className="mt-2 text-lg text-muted-foreground">{track.short_description}</p>
            )}
            {track.category && (
              <span className="mt-2 inline-block rounded-full bg-gray-100 dark:bg-white/10 px-3 py-0.5 text-xs font-medium text-gray-600 dark:text-slate-400">{track.category}</span>
            )}
          </div>
        </div>
        <div className="mt-4 h-1 rounded-full" style={{ backgroundColor: track.color }} />
      </div>

      {/* Description */}
      {track.description && (
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <SectionLabel className="mb-3">{t('tracks.portal.about', 'About This Track')}</SectionLabel>
          <MarkdownContent
            body={track.description}
            format="markdown"
            className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-a:text-portal-primary [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          />
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <SectionLabel className="mb-3">{t('tracks.portal.resources', 'Resources & Files')}</SectionLabel>
          <ul className="divide-y">
            {attachments.map((att) => (
              <li key={att.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 dark:bg-white/5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{att.file_name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</p>
                  </div>
                </div>
                <a
                  href={att.url}
                  download
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-portal-primary hover:bg-portal-primary/5 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  {t('tracks.portal.download', 'Download')}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Judging Criteria */}
      {criteria.length > 0 && (
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-6">
          <SectionLabel className="mb-4">{t('tracks.portal.judgingCriteria', 'Judging Criteria')}</SectionLabel>
          <p className="mb-5 text-sm text-muted-foreground">
            {t('tracks.portal.criteriaDesc', 'Projects in this track will be evaluated on the following criteria.')}
          </p>

          {trackCriteria.length > 0 && (
            <div className="mb-6">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('tracks.portal.trackSpecific', 'Track-Specific Criteria')}</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {trackCriteria.map((c) => (
                  <CriterionCard key={c.id} criterion={c} color={track.color} roundLabels={roundLabels} />
                ))}
              </div>
            </div>
          )}

          {globalCriteria.length > 0 && (
            <div>
              {trackCriteria.length > 0 && (
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('tracks.portal.globalCriteria', 'General Criteria (All Tracks)')}</h4>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {globalCriteria.map((c) => (
                  <CriterionCard key={c.id} criterion={c} color="#6b7280" roundLabels={roundLabels} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CriterionCard({ criterion, color, roundLabels }: { criterion: Criterion; color: string; roundLabels: Record<string, string> }) {
  const t = useT()
  return (
    <div className="rounded-lg border border-gray-100 dark:border-white/10 p-4">
      <div className="flex items-start justify-between gap-2">
        <h5 className="text-sm font-semibold text-foreground">{criterion.name}</h5>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${color}15`, color }}>
          {(criterion.weight * 100).toFixed(0)}%
        </span>
      </div>
      {criterion.description && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{criterion.description}</p>
      )}
      <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>{t('tracks.portal.criteria.maxScore', 'Max: {count} pts', { count: criterion.max_score })}</span>
        <span>{roundLabels[criterion.round] ?? criterion.round}</span>
      </div>
    </div>
  )
}

export default function TrackDetailPage({ params }: { params: { orgSlug: string; trackId: string } }) {
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <TrackDetailContent trackId={params.trackId} />
    </PortalCompetitionLayout>
  )
}
