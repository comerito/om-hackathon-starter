"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { cn } from '@open-mercato/shared/lib/utils'
import { useIsMobile } from '@open-mercato/ui/hooks/useIsMobile'
import { ThumbsUp, Download, Filter } from 'lucide-react'
import { PortalPageTitle, PortalBadge, ProgressBar } from '@/components/portal'

type LeaderboardEntry = {
  project_id: string; project_title: string; team_id: string; team_name: string | null
  track_id: string; average_score: number | null; rank: number | null
  peer_vote_count: number | null; is_finalist: boolean; team_status: string | null
}

/* ---------- Podium ---------- */

function PodiumCard({ entry, place }: { entry: LeaderboardEntry; place: 1 | 2 | 3 }) {
  const t = useT()
  const medalColors = { 1: 'from-yellow-400 to-amber-500', 2: 'from-gray-300 to-gray-400', 3: 'from-amber-600 to-amber-700' }
  const placeLabels = {
    1: t('judging.portal.results.place.1', 'GRAND WINNER'),
    2: t('judging.portal.results.place.2', 'SILVER FINALIST'),
    3: t('judging.portal.results.place.3', 'BRONZE FINALIST'),
  }
  const heights = { 1: 'h-40', 2: 'h-32', 3: 'h-28' }

  return (
    <div className={cn('flex flex-col items-center', place === 1 && 'order-2', place === 2 && 'order-1', place === 3 && 'order-3')}>
      {/* Medal */}
      <div className={cn('size-12 sm:size-16 rounded-full bg-gradient-to-b flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg mb-3', medalColors[place])}>
        {place}
      </div>
      {/* Project info */}
      <p className="text-xs sm:text-sm font-bold text-foreground text-center">{entry.project_title}</p>
      <p className="text-[11px] sm:text-xs text-portal-secondary text-center">{entry.team_name}</p>
      {entry.average_score != null && (
        <PortalBadge variant="primary" className="mt-2">{entry.average_score.toFixed(1)}</PortalBadge>
      )}
      {/* Pedestal */}
      <div className={cn('w-24 sm:w-32 mt-3 rounded-t-lg bg-gradient-to-b from-gray-100 to-gray-50 dark:from-white/10 dark:to-white/5 flex items-end justify-center pb-2', heights[place])}>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
          {placeLabels[place]}
        </span>
      </div>
    </div>
  )
}

/* ---------- Results Content ---------- */

type Track = { id: string; name: string }

function ResultsContent() {
  const t = useT()
  const isMobile = useIsMobile()
  const { selectedId: competitionId, selected, isLoading: contextLoading } = useCompetitionContext()
  const [selectedTrackId, setSelectedTrackId] = React.useState<string>('')
  const [showTrackFilter, setShowTrackFilter] = React.useState(false)

  // Load available tracks
  const { data: tracksData } = useQuery<{ items: Track[] }>({
    queryKey: ['portal-tracks', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: Track[] }>(
        `/api/competitions/portal/competition-data?competition_id=${competitionId}&type=tracks`,
      )
      if (ok && result) return result
      return { items: [] }
    },
    enabled: !!competitionId,
  })

  const tracks = tracksData?.items ?? []

  const trackParam = selectedTrackId ? `&track_id=${selectedTrackId}` : ''
  const { data, isLoading } = useQuery<{ items: LeaderboardEntry[] }>({
    queryKey: ['portal-results', competitionId, selectedTrackId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: LeaderboardEntry[] }>(`/api/judging/leaderboard?competition_id=${competitionId}${trackParam}`)
      if (ok && result) return result
      return { items: [] }
    },
    enabled: !!competitionId,
  })

  if (contextLoading || isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        <div className="h-64 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
      </div>
    )
  }

  if (selected && selected.stage !== 'finished' && selected.stage !== 'archived') {
    return (
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center text-portal-secondary">
        {t('judging.portal.results.stageLocked', 'Results will be available after the judging phase.')}
      </div>
    )
  }

  const entries = data?.items ?? []
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center text-portal-secondary">
        {t('judging.portal.results.empty', 'Results have not been published yet.')}
      </div>
    )
  }

  const top3 = entries.filter(e => e.rank && e.rank <= 3 && e.team_status !== 'disqualified')
  const allEntries = entries

  // Stats
  const totalSubmissions = entries.length
  const avgScore = entries.reduce((sum, e) => sum + (e.average_score ?? 0), 0) / (entries.length || 1)
  const totalVotes = entries.reduce((sum, e) => sum + (e.peer_vote_count ?? 0), 0)

  return (
    <div className="space-y-8">
      {/* Podium */}
      {top3.length >= 3 && (
        <div className="flex items-end justify-center gap-2 sm:gap-4 py-8">
          {[2, 1, 3].map(place => {
            const entry = top3.find(e => e.rank === place)
            return entry ? <PodiumCard key={entry.project_id} entry={entry} place={place as 1 | 2 | 3} /> : null
          })}
        </div>
      )}

      {/* Full Rankings Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">{t('judging.portal.results.rankings', 'Full Rankings')}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowTrackFilter(prev => !prev)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                selectedTrackId
                  ? 'border-portal-primary bg-portal-primary/5 text-portal-primary'
                  : 'border-gray-200 dark:border-white/10 text-portal-secondary hover:bg-gray-50 dark:hover:bg-white/5',
              )}
            >
              <Filter className="size-3.5" /> {t('judging.portal.results.filter', 'Filter')}
            </button>
            <button
              type="button"
              onClick={() => window.open(`/api/judging/portal/export-results?competition_id=${competitionId}`, '_blank')}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-portal-secondary hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <Download className="size-3.5" /> {t('judging.portal.results.export', 'Export')}
            </button>
          </div>
        </div>

        {/* Track filter dropdown */}
        {showTrackFilter && tracks.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setSelectedTrackId('')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                !selectedTrackId
                  ? 'border-portal-primary bg-portal-primary text-white'
                  : 'border-gray-200 dark:border-white/10 text-portal-secondary hover:bg-gray-50 dark:hover:bg-white/5',
              )}
            >
              {t('judging.portal.results.allTracks', 'All Tracks')}
            </button>
            {tracks.map(track => (
              <button
                key={track.id}
                type="button"
                onClick={() => setSelectedTrackId(track.id)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                  selectedTrackId === track.id
                    ? 'border-portal-primary bg-portal-primary text-white'
                    : 'border-gray-200 dark:border-white/10 text-portal-secondary hover:bg-gray-50 dark:hover:bg-white/5',
                )}
              >
                {track.name}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
          {isMobile ? (
            /* Mobile: card-based list */
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {allEntries.map((entry, i) => {
                const isDisqualified = entry.team_status === 'disqualified'
                const rank = entry.rank ?? i + 1
                return (
                  <div key={entry.project_id} className={cn('px-4 py-3.5', isDisqualified && 'opacity-40')}>
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-lg font-bold text-portal-primary shrink-0">
                        {String(rank).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-semibold', isDisqualified && 'line-through')}>{entry.project_title}</p>
                        <p className="text-xs text-portal-secondary">{entry.team_name}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {entry.average_score != null && (
                            <span className="font-mono text-sm font-bold">{entry.average_score.toFixed(1)}</span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-portal-secondary">
                            <ThumbsUp className="size-3" />
                            {entry.peer_vote_count ?? 0}
                          </span>
                          {isDisqualified ? (
                            <PortalBadge variant="danger">{t('judging.portal.results.status.disqualified', 'Disqualified')}</PortalBadge>
                          ) : entry.is_finalist ? (
                            <PortalBadge variant="warning">{t('judging.portal.results.status.finalist', 'Finalist')}</PortalBadge>
                          ) : (
                            <PortalBadge variant="muted">{t('judging.portal.results.status.participant', 'Participant')}</PortalBadge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Desktop: grid table */
            <>
              <div className="grid grid-cols-[60px_1fr_100px_100px_120px] gap-4 px-5 py-3 border-b border-gray-100 dark:border-white/10 text-[10px] font-semibold uppercase tracking-widest text-portal-secondary">
                <span>{t('judging.portal.results.columns.rank', 'Rank')}</span>
                <span>{t('judging.portal.results.columns.projectTeam', 'Project & Team')}</span>
                <span>{t('judging.portal.results.columns.avgScore', 'Avg Score')}</span>
                <span>{t('judging.portal.results.columns.peerVotes', 'Peer Votes')}</span>
                <span>{t('judging.portal.results.columns.status', 'Status')}</span>
              </div>
              {allEntries.map((entry, i) => {
                const isDisqualified = entry.team_status === 'disqualified'
                const rank = entry.rank ?? i + 1
                return (
                  <div
                    key={entry.project_id}
                    className={cn(
                      'grid grid-cols-[60px_1fr_100px_100px_120px] gap-4 px-5 py-3.5 border-b border-gray-50 dark:border-white/5 last:border-0 items-center',
                      isDisqualified && 'opacity-40',
                    )}
                  >
                    <span className="font-mono text-lg font-bold text-portal-primary">
                      {String(rank).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className={cn('text-sm font-semibold truncate', isDisqualified && 'line-through')}>{entry.project_title}</p>
                      <p className="text-xs text-portal-secondary">{entry.team_name}</p>
                    </div>
                    <span className="font-mono text-sm font-bold">
                      {entry.average_score != null ? entry.average_score.toFixed(1) : '—'}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-portal-secondary">
                      <ThumbsUp className="size-3" />
                      {entry.peer_vote_count ?? 0}
                    </span>
                    <div>
                      {isDisqualified ? (
                        <PortalBadge variant="danger">{t('judging.portal.results.status.disqualified', 'Disqualified')}</PortalBadge>
                      ) : entry.is_finalist ? (
                        <PortalBadge variant="warning">{t('judging.portal.results.status.finalist', 'Finalist')}</PortalBadge>
                      ) : (
                        <PortalBadge variant="muted">{t('judging.portal.results.status.participant', 'Participant')}</PortalBadge>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Bottom stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-3 sm:p-4">
          <p className="text-xl sm:text-2xl font-bold text-foreground">{totalSubmissions}</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-portal-secondary mt-0.5">{t('judging.portal.results.stats.totalSubmissions', 'Total Submissions')}</p>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-3 sm:p-4">
          <p className="text-xl sm:text-2xl font-bold text-foreground">{avgScore.toFixed(1)}</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-portal-secondary mt-0.5">{t('judging.portal.results.stats.avgCompetitionScore', 'Avg Competition Score')}</p>
          <ProgressBar value={avgScore * 10} size="sm" className="mt-2" />
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-3 sm:p-4">
          <p className="text-xl sm:text-2xl font-bold text-foreground">{totalVotes.toLocaleString()}</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-portal-secondary mt-0.5">{t('judging.portal.results.stats.communityEngagement', 'Community Engagement')}</p>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-portal-dark p-3 sm:p-4">
          <p className="text-xl sm:text-2xl font-bold text-white">{t('judging.portal.results.stats.verified', 'Verified')}</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mt-0.5">{t('judging.portal.results.stats.panelStatus', 'Judging Panel Status')}</p>
        </div>
      </div>
    </div>
  )
}

export default function ResultsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
      <PortalCompetitionLayout>
      <PortalPageTitle
        label={t('judging.portal.results.label', 'Hackathon Results 2024')}
        title={t('judging.portal.results.title', 'Leaderboard')}
      />
      <ResultsContent />
    </PortalCompetitionLayout>
  )
}
