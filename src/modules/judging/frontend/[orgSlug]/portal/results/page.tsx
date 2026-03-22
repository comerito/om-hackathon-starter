"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'

type LeaderboardEntry = {
  project_id: string; project_title: string; team_id: string; team_name: string | null
  track_id: string; average_score: number | null; rank: number | null
  peer_vote_count: number | null; is_finalist: boolean; team_status: string | null
}

function ResultsContent() {
  const t = useT()
  const { selectedId: competitionId, selected } = useCompetitionContext()

  const { data, isLoading } = useQuery<{ items: LeaderboardEntry[] }>({
    queryKey: ['portal-results', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: LeaderboardEntry[] }>(`/api/judging/leaderboard?competition_id=${competitionId}`)
      if (ok && result) return result
      return { items: [] }
    },
    enabled: !!competitionId,
  })

  // Check if competition is in FINISHED stage
  if (selected && selected.stage !== 'finished' && selected.stage !== 'archived') {
    return <PortalEmptyState title={t('judging.portal.resultsNotReady', 'Results Not Available Yet')} description={t('judging.portal.resultsNotReadyDesc', 'Results will be available after the judging phase.')} />
  }

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t('common.loading', 'Loading...')}</div>

  const entries = data?.items ?? []
  if (entries.length === 0) {
    return <PortalEmptyState title={t('judging.portal.noResults', 'No Results')} description={t('judging.portal.noResultsDesc', 'Results have not been published yet.')} />
  }

  const medals = ['', '🥇', '🥈', '🥉']

  return (
    <div className="space-y-6">
      <PortalCard>
        <PortalCardHeader title={t('judging.portal.leaderboard', 'Leaderboard')} />
        <div className="divide-y">
          {entries.map((entry, i) => {
            const isDisqualified = entry.team_status === 'disqualified'
            return (
              <div key={entry.project_id} className={`flex items-center gap-4 px-6 py-4 ${isDisqualified ? 'opacity-40 line-through' : ''}`}>
                <div className="w-10 text-center">
                  {!isDisqualified && entry.rank && entry.rank <= 3 ? (
                    <span className="text-2xl">{medals[entry.rank]}</span>
                  ) : (
                    <span className="text-lg font-mono font-bold text-muted-foreground">{entry.rank ?? i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{entry.project_title}</h3>
                  <p className="text-sm text-muted-foreground">{entry.team_name}</p>
                </div>
                <div className="text-right">
                  {entry.average_score != null && (
                    <div className="text-xl font-mono font-bold">{entry.average_score.toFixed(1)}</div>
                  )}
                  {entry.peer_vote_count != null && entry.peer_vote_count > 0 && (
                    <div className="text-xs text-muted-foreground">{entry.peer_vote_count} votes</div>
                  )}
                </div>
                {entry.is_finalist && (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Finalist</span>
                )}
              </div>
            )
          })}
        </div>
      </PortalCard>
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
    <CompetitionProvider>
      <CompetitionSelector />
      <div className="flex flex-col gap-6">
        <PortalPageHeader title={t('judging.portal.resultsTitle', 'Results')} label={t('judging.portal.resultsLabel', 'Competition results')} />
        <ResultsContent />
      </div>
    </CompetitionProvider>
  )
}
