"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { Alert } from '@open-mercato/ui/primitives/alert'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { PortalPageTitle } from '@/components/portal'

type ProjectForVote = { id: string; title: string; tagline: string | null; team_name: string | null; track_id: string }
type MyVote = { id: string; project_id: string; created_at: string }

/**
 * Peer-voting context as `GET /api/sponsors/portal/my-votes` reports it. The
 * server owns the eligibility rule (`sponsors/lib/voting-eligibility.ts`); this
 * page only mirrors its verdict so a button is never offered for a vote the
 * server would refuse.
 */
type VotingContext = {
  open: boolean
  reason: string | null
  message: string | null
  votes_used: number
  votes_max: number
  allow_vote_change: boolean
  my_team_id: string | null
  my_team_project_ids: string[]
}

type MyVotesResponse = { votes: MyVote[]; count: number; voting?: VotingContext }

/** Shown only until `my-votes` answers; `votes_max` mirrors the server default. */
const DEFAULT_VOTING_CONTEXT: VotingContext = {
  open: false,
  reason: null,
  message: null,
  votes_used: 0,
  votes_max: 3,
  allow_vote_change: false,
  my_team_id: null,
  my_team_project_ids: [],
}

/** Why this particular card cannot be voted for right now — `null` means it can. */
type BlockedReason =
  | 'voting_disabled'
  | 'voting_not_open_yet'
  | 'voting_closed'
  | 'voting_window_not_started'
  | 'voting_window_ended'
  | 'own_team_project'
  | 'already_voted'
  | 'no_votes_left'

function VotingContent() {
  const t = useT()
  const queryClient = useQueryClient()
  const { selectedId: competitionId, selected, isLoading: contextLoading } = useCompetitionContext()
  const [voting, setVoting] = React.useState<string | null>(null)
  // Portal pages mount no `<FlashMessages />` host, so a flash() toast here is
  // a no-op — the result of a vote is rendered inline instead.
  const [notice, setNotice] = React.useState<{ status: 'success' | 'error'; text: string } | null>(null)

  const blockedLabel = React.useCallback((reason: BlockedReason, votesMax: number): string => {
    switch (reason) {
      case 'own_team_project':
        return t('sponsors.portal.blocked.ownTeam', "You cannot vote for your own team's project")
      case 'already_voted':
        return t('sponsors.portal.blocked.alreadyVoted', 'You have already voted for this project')
      case 'no_votes_left':
        return t('sponsors.portal.blocked.noVotesLeft', 'You have used all {max} of your votes', { max: votesMax })
      case 'voting_disabled':
        return t('sponsors.portal.blocked.votingDisabled', 'Peer voting is not enabled for this competition')
      case 'voting_not_open_yet':
      case 'voting_window_not_started':
        return t('sponsors.portal.blocked.notOpenYet', 'Voting has not opened yet')
      case 'voting_closed':
      case 'voting_window_ended':
      default:
        return t('sponsors.portal.blocked.closed', 'Voting has closed')
    }
  }, [t])

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

  // Get my votes + the server's voting eligibility verdict
  const { data: myVotesData } = useQuery({
    queryKey: ['portal-my-votes', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<MyVotesResponse>(`/api/sponsors/portal/my-votes?competition_id=${competitionId}`)
      return ok && result ? result : { votes: [], count: 0 }
    },
    enabled: !!competitionId,
  })

  const myVotes = myVotesData?.votes ?? []
  const votedProjectIds = new Set(myVotes.map(v => v.project_id))
  const projects = projectsData ?? []

  // Fall back to the competition stage only until the server's verdict arrives.
  const votingContext: VotingContext = myVotesData?.voting ?? {
    ...DEFAULT_VOTING_CONTEXT,
    open: !!selected && !['deliberation', 'finished', 'archived'].includes(selected.stage),
    votes_used: myVotes.length,
  }
  const votesUsed = votingContext.votes_used
  const votesMax = votingContext.votes_max
  const ownProjectIds = new Set(votingContext.my_team_project_ids)
  const votingClosed = !votingContext.open

  /** Mirrors `evaluateVoteEligibility` on the server, in the same order. */
  function blockedReason(projectId: string): BlockedReason | null {
    if (!votingContext.open) return (votingContext.reason as BlockedReason | null) ?? 'voting_closed'
    if (ownProjectIds.has(projectId)) return 'own_team_project'
    if (votedProjectIds.has(projectId)) return 'already_voted'
    if (votesUsed >= votesMax) return 'no_votes_left'
    return null
  }

  async function handleVote(projectId: string) {
    setVoting(projectId)
    setNotice(null)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>('/api/sponsors/portal/cast-vote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ competition_id: competitionId, project_id: projectId }),
      })
      if (ok) {
        setNotice({ status: 'success', text: t('sponsors.portal.voteSuccess', 'Vote cast!') })
      } else {
        setNotice({ status: 'error', text: result?.error ?? t('sponsors.portal.voteFailed', 'Failed to vote') })
      }
      // Refetch either way: a rejection usually means this page's view of the
      // voting window or the vote budget is stale.
      queryClient.invalidateQueries({ queryKey: ['portal-my-votes'] })
    } catch {
      setNotice({ status: 'error', text: t('sponsors.portal.voteFailed', 'Failed to vote') })
    } finally {
      setVoting(null)
    }
  }

  async function handleUnvote(voteId: string) {
    setNotice(null)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>(`/api/sponsors/portal/cast-vote?vote_id=${voteId}`, { method: 'DELETE' })
      if (ok) {
        setNotice({ status: 'success', text: t('sponsors.portal.voteRemoved', 'Vote removed') })
      } else {
        setNotice({ status: 'error', text: result?.error ?? t('sponsors.portal.voteRemoveFailed', 'Failed to remove vote') })
      }
      queryClient.invalidateQueries({ queryKey: ['portal-my-votes'] })
    } catch {
      setNotice({ status: 'error', text: t('sponsors.portal.voteRemoveFailed', 'Failed to remove vote') })
    }
  }

  if (contextLoading || projectsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 rounded-lg border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return <PortalEmptyState title={t('sponsors.portal.noProjects', 'No Projects to Vote On')} description={t('sponsors.portal.noProjectsDesc', 'Projects will appear here after the hacking phase.')} />
  }

  return (
    <div className="space-y-6">
      {/* Result of the last vote/unvote — the portal has no flash host */}
      {notice && (
        <Alert status={notice.status} dismissible onDismiss={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      {/* Voting closed banner */}
      {votingClosed && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-4 text-center">
          <p className="font-medium text-blue-800 dark:text-blue-300">
            {votingContext.reason === 'voting_not_open_yet' || votingContext.reason === 'voting_window_not_started'
              ? t('sponsors.portal.blocked.notOpenYet', 'Voting has not opened yet')
              : t('sponsors.portal.votingEnded', 'Voting has ended.')}
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
            {t('sponsors.portal.votesRecorded', 'Your {count} vote(s) have been recorded.', { count: votesUsed })}
          </p>
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
          const blocked = isVoted ? null : blockedReason(project.id)
          const canVote = blocked === null
          // Retraction is refused server-side unless the organiser allows vote
          // changes — say so rather than offering a button that cannot work.
          const unvoteBlocked = votingClosed
            ? blockedLabel((votingContext.reason as BlockedReason | null) ?? 'voting_closed', votesMax)
            : !votingContext.allow_vote_change
              ? t('sponsors.portal.blocked.noVoteChange', 'Votes cannot be changed in this competition')
              : null
          // Why this card offers no action, in words the voter can read. Once
          // voting is closed the banner above already says so for every card, so
          // only card-specific reasons are repeated here.
          const blockedText = isVoted ? unvoteBlocked : blocked ? blockedLabel(blocked, votesMax) : null
          const cardBlockedText = votingContext.open ? blockedText : null

          return (
            <PortalCard key={project.id}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{project.title}</h3>
                    {project.team_name && <p className="text-sm text-muted-foreground">{project.team_name}</p>}
                    {project.tagline && <p className="text-xs text-muted-foreground mt-1 truncate">{project.tagline}</p>}
                    {cardBlockedText && (
                      <p className="text-xs text-muted-foreground mt-2">{cardBlockedText}</p>
                    )}
                  </div>
                  {isVoted ? (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => vote && handleUnvote(vote.id)}
                      disabled={!!unvoteBlocked}
                      title={unvoteBlocked ?? undefined}
                      className="shrink-0 border-green-500 text-green-700 dark:text-green-400"
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
                      title={blockedText ?? undefined}
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
