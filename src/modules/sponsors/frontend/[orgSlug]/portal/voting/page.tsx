"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { PortalPageTitle } from '@/components/portal'

type ProjectForVote = { id: string; title: string; tagline: string | null; team_name: string | null; track_id: string }
type MyVote = { id: string; project_id: string; created_at: string }

function VotingContent() {
  const t = useT()
  const queryClient = useQueryClient()
  const { selectedId: competitionId, selected } = useCompetitionContext()
  const [voting, setVoting] = React.useState<string | null>(null)

  // Get published projects
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['portal-voting-projects', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: Array<{ id: string; title: string; tagline: string | null; team_id: string; track_id: string; team_name: string | null }> }>(
        `/api/competitions/portal/competition-data?competition_id=${competitionId}&type=projects&status=published`,
      )
      return ok && result ? result.items.map(p => ({
        id: p.id, title: p.title, tagline: p.tagline,
        team_name: p.team_name ?? null, track_id: p.track_id,
      })) : []
    },
    enabled: !!competitionId,
  })

  // Get my votes
  const { data: myVotesData } = useQuery({
    queryKey: ['portal-my-votes', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ votes: MyVote[]; count: number }>(`/api/sponsors/portal/my-votes?competition_id=${competitionId}`)
      return ok && result ? result : { votes: [], count: 0 }
    },
    enabled: !!competitionId,
  })

  const myVotes = myVotesData?.votes ?? []
  const votedProjectIds = new Set(myVotes.map(v => v.project_id))
  const votesUsed = myVotes.length
  const votesMax = 3 // From peerVotingConfig.votesPerPerson default
  const projects = projectsData ?? []

  // Check if voting is closed (competition in DELIBERATION+ stage)
  const votingClosed = selected && ['deliberation', 'finished', 'archived'].includes(selected.stage)

  async function handleVote(projectId: string) {
    setVoting(projectId)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>('/api/sponsors/portal/cast-vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ competition_id: competitionId, project_id: projectId }),
      })
      if (ok) {
        flash(t('sponsors.portal.voteSuccess', 'Vote cast!'), 'success')
        queryClient.invalidateQueries({ queryKey: ['portal-my-votes'] })
      } else {
        flash(result?.error ?? 'Failed to vote', 'error')
      }
    } finally {
      setVoting(null)
    }
  }

  async function handleUnvote(voteId: string) {
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>(`/api/sponsors/portal/cast-vote?vote_id=${voteId}`, { method: 'DELETE' })
      if (ok) {
        flash(t('sponsors.portal.voteRemoved', 'Vote removed'), 'success')
        queryClient.invalidateQueries({ queryKey: ['portal-my-votes'] })
      } else {
        flash(result?.error ?? 'Failed to remove vote', 'error')
      }
    } catch {
      flash('Failed to remove vote', 'error')
    }
  }

  if (projectsLoading) return <div className="text-center py-12 text-muted-foreground">{t('common.loading', 'Loading...')}</div>

  if (projects.length === 0) {
    return <PortalEmptyState title={t('sponsors.portal.noProjects', 'No Projects to Vote On')} description={t('sponsors.portal.noProjectsDesc', 'Projects will appear here after the hacking phase.')} />
  }

  return (
    <div className="space-y-6">
      {/* Voting closed banner */}
      {votingClosed && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="font-medium text-blue-800">{t('sponsors.portal.votingEnded', 'Voting has ended.')}</p>
          <p className="text-sm text-blue-700 mt-1">{t('sponsors.portal.votesRecorded', `Your ${votesUsed} vote(s) have been recorded.`)}</p>
        </div>
      )}

      {/* Vote counter */}
      {!votingClosed && (
        <div className="rounded-lg border bg-muted/30 p-4 flex items-center justify-between">
          <span className="text-sm font-medium">{t('sponsors.portal.votesUsed', 'Votes used')}</span>
          <span className="text-lg font-bold">{votesUsed} / {votesMax}</span>
        </div>
      )}

      {/* Project grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {projects.map(project => {
          const isVoted = votedProjectIds.has(project.id)
          const vote = myVotes.find(v => v.project_id === project.id)
          const canVote = !votingClosed && !isVoted && votesUsed < votesMax

          return (
            <PortalCard key={project.id}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{project.title}</h3>
                    {project.team_name && <p className="text-sm text-muted-foreground">{project.team_name}</p>}
                    {project.tagline && <p className="text-xs text-muted-foreground mt-1 truncate">{project.tagline}</p>}
                  </div>
                  {isVoted ? (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => vote && handleUnvote(vote.id)}
                      disabled={!!votingClosed}
                      className="shrink-0 border-green-500 text-green-700"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="mr-1">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      {t('sponsors.portal.voted', 'Voted')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => handleVote(project.id)}
                      disabled={!canVote || voting === project.id}
                      className="shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      {voting === project.id ? t('common.saving', 'Saving...') : t('sponsors.portal.vote', 'Vote')}
                    </Button>
                  )}
                </div>
              </div>
            </PortalCard>
          )
        })}
      </div>
    </div>
  )
}

export default function VotingPage({ params }: { params: { orgSlug: string } }) {
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
        label={t('sponsors.portal.votingLabel', 'Vote for your favorite projects')}
        title={t('sponsors.portal.votingTitle', "People's Choice")}
      />
      <VotingContent />
    </PortalCompetitionLayout>
  )
}
