"use client"
import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Lock, PanelRight, UserX } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { PortalPageTitle } from '@/components/portal'
import { useCompetitionContext } from '../../../../../../competitions/components/CompetitionContext'
import { PortalCompetitionLayout } from '../../../../../../competitions/components/PortalCompetitionLayout'
import { ProjectCardSheet } from '../../../../../components/ProjectCardSheet'
import { StarCriterionCard } from '../../../../../components/StarCriterionCard'
import { VoteSummary } from '../../../../../components/VoteSummary'
import { useVoteSaver } from '../../../../../components/useVoteSaver'
import type { JudgeAssignmentsResponse } from '../../../../../lib/judgeAssignments'
import { formatQueuePosition } from '../../../../../lib/demoQueue'
import {
  initialVoteState, placeAmongMyVotes, summarizeVote, withNote, withStars,
  type VoteFormCriterion, type VoteFormScore, type VoteFormState,
} from '../../../../../lib/voteForm'
import {
  findNextInQueue, liveVoteState, queueProgress, resolveQueueEntries, withEntryState,
} from '../../../../../lib/votingQueue'

const ROUND = 'preliminary'

type ScoreProjectResponse = {
  criteria: VoteFormCriterion[]
  score: VoteFormScore | null
  voting_open: boolean
}

type ScoreQueryResult =
  | { status: 'ok'; data: ScoreProjectResponse }
  | { status: 'unavailable' }

type LocalVote = {
  votes: VoteFormState
  comment: string
  privateNotes: string
  recused: boolean
}

const EMPTY_ASSIGNMENTS: JudgeAssignmentsResponse = { panels: [], projects: [], scores: [], voting_open: true }

/** Text as the API stores it: surrounding whitespace dropped, empty → `null`. */
const textForSave = (value: string): string | null => value.trim() || null

function VotingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-16 rounded-lg border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
      {[1, 2, 3].map(i => (
        <div key={i} className="h-32 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
      ))}
    </div>
  )
}

function VotingContent({ projectId, orgSlug, competitionId }: { projectId: string; orgSlug: string; competitionId: string }) {
  const t = useT()
  const queryClient = useQueryClient()
  const queueHref = `/${orgSlug}/portal/judging`

  const scoreQuery = useQuery<ScoreQueryResult>({
    queryKey: ['portal-vote', competitionId, projectId],
    queryFn: async () => {
      const params = new URLSearchParams({ project_id: projectId, competition_id: competitionId, round: ROUND })
      const { ok, status, result } = await apiCall<ScoreProjectResponse>(`/api/judging/portal/score-project?${params.toString()}`)
      if (ok && result) return { status: 'ok', data: result }
      if (status >= 500) throw new Error('Failed to load the vote')
      return { status: 'unavailable' }
    },
    // Local state is the truth once loaded: never refetch underneath the judge's edits, and start
    // from the server again whenever the page is opened.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const assignmentsQuery = useQuery<JudgeAssignmentsResponse>({
    queryKey: ['portal-judge-assignments', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<JudgeAssignmentsResponse>(`/api/judging/portal/my-assignments?competition_id=${competitionId}`)
      if (ok && result) return result
      return EMPTY_ASSIGNMENTS
    },
  })

  const loaded = scoreQuery.data?.status === 'ok' ? scoreQuery.data.data : null
  const [local, setLocal] = React.useState<LocalVote | null>(null)
  const [savedOnce, setSavedOnce] = React.useState(false)
  const [cardOpen, setCardOpen] = React.useState(false)
  const [recuseOpen, setRecuseOpen] = React.useState(false)

  React.useEffect(() => {
    if (local !== null || loaded === null) return
    setLocal({
      votes: initialVoteState(loaded.criteria, loaded.score),
      comment: loaded.score?.comment ?? '',
      privateNotes: loaded.score?.private_notes ?? '',
      recused: loaded.score?.conflict_of_interest ?? false,
    })
  }, [loaded, local])

  const saver = useVoteSaver({
    projectId,
    competitionId,
    round: ROUND,
    votingClosed: loaded?.voting_open === false,
    onSaved: () => {
      setSavedOnce(true)
      void queryClient.invalidateQueries({ queryKey: ['portal-judge-assignments', competitionId] })
    },
  })

  if (scoreQuery.isLoading || (loaded !== null && local === null)) return <VotingSkeleton />

  if (scoreQuery.isError) {
    return (
      <PortalEmptyState
        title={t('judging.portal.vote.loadFailed', 'Could not load this vote')}
        description={t('judging.portal.vote.loadFailedDesc', 'Check your connection and try again.')}
        action={(
          <Button type="button" variant="outline" onClick={() => { void scoreQuery.refetch() }}>
            {t('judging.portal.vote.retry', 'Retry')}
          </Button>
        )}
      />
    )
  }

  if (loaded === null || local === null) {
    return (
      <PortalEmptyState
        title={t('judging.portal.vote.notFound', 'Project not available')}
        description={t('judging.portal.vote.notFoundDesc', 'This project is not assigned to you in the selected competition.')}
        action={(
          <Button asChild variant="outline">
            <Link href={queueHref}>{t('judging.portal.vote.backToQueue', 'Back to queue')}</Link>
          </Button>
        )}
      />
    )
  }

  const criteria = [...loaded.criteria].sort((a, b) => a.order - b.order)
  const assignments = assignmentsQuery.data ?? EMPTY_ASSIGNMENTS
  const project = assignments.projects.find(candidate => candidate.id === projectId) ?? null
  const closed = saver.closed || loaded.voting_open === false || assignments.voting_open === false
  const { recused } = local

  const summary = summarizeVote(criteria, local.votes, loaded.score)
  const hasScore = loaded.score !== null || savedOnce
  const entries = withEntryState(
    resolveQueueEntries(assignments.projects, assignments.scores, ROUND),
    projectId,
    liveVoteState({ recused, isComplete: summary.isComplete, ratedCount: summary.ratedCount, hasScore }),
  )
  const progress = queueProgress(entries)
  const nextProject = findNextInQueue(entries, projectId)
  const place = project
    ? placeAmongMyVotes({ id: project.id, track_id: project.track_id }, assignments.scores, { summary, recused, round: ROUND })
    : null

  const position = formatQueuePosition(project?.demo?.order)
  const meta = [
    position ? `#${position}` : null,
    project?.team_name ?? null,
    project?.track_name ?? null,
  ].filter((value): value is string => !!value && value.trim().length > 0)

  const setStars = (criterionId: string, stars: number) => {
    if (closed) return
    setLocal(current => current && { ...current, votes: withStars(current.votes, criterionId, stars) })
    saver.change({ criteria: { [criterionId]: { stars } } }, { immediate: true })
  }

  const setNote = (criterionId: string, note: string) => {
    if (closed) return
    setLocal(current => current && { ...current, votes: withNote(current.votes, criterionId, note) })
    saver.change({ criteria: { [criterionId]: { note: textForSave(note) } } }, { immediate: false })
  }

  const setComment = (comment: string) => {
    if (closed) return
    setLocal(current => current && { ...current, comment })
    saver.change({ criteria: {}, comment: textForSave(comment) }, { immediate: false })
  }

  const setPrivateNotes = (privateNotes: string) => {
    if (closed) return
    setLocal(current => current && { ...current, privateNotes })
    saver.change({ criteria: {}, private_notes: textForSave(privateNotes) }, { immediate: false })
  }

  const setRecused = (next: boolean) => {
    if (closed) return
    setLocal(current => current && { ...current, recused: next })
    saver.change({ criteria: {}, conflict_of_interest: next }, { immediate: true })
  }

  const confirmRecuse = () => {
    setRecuseOpen(false)
    setRecused(true)
  }

  const handleRecuseKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      confirmRecuse()
    }
  }

  return (
    <div className="space-y-6 pb-40 lg:pb-0">
      {/* Header */}
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={queueHref}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('judging.portal.vote.backToQueue', 'Back to queue')}
          </Link>
        </Button>
        <PortalPageTitle
          label={t('judging.portal.vote.pageLabel', 'Vote on project')}
          title={project?.title ?? t('judging.portal.vote.titleFallback', 'Project vote')}
        />
        {meta.length > 0 ? (
          <p className="text-sm text-muted-foreground break-words" data-testid="vote-project-meta">
            {meta.join(' · ')}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {project ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setCardOpen(true)}>
              <PanelRight className="size-4" aria-hidden="true" />
              {t('judging.portal.projectCard.title', 'Project card')}
            </Button>
          ) : null}
          {nextProject ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/${orgSlug}/portal/judging/${nextProject.id}`} data-testid="vote-next-in-queue">
                {t('judging.portal.vote.nextInQueue', 'Next in queue')}
                <span className="max-w-[12rem] truncate text-muted-foreground">{nextProject.title}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {closed ? (
        <div
          role="status"
          data-testid="vote-closed"
          className="flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm text-status-warning-text"
        >
          <Lock className="mt-0.5 size-4 shrink-0 text-status-warning-icon" aria-hidden="true" />
          <div>
            <p className="font-medium">{t('judging.portal.vote.votingClosed', 'Voting is closed')}</p>
            <p>
              {saver.lostChanges
                ? t('judging.portal.vote.votingClosedUnsaved', 'Results are published, so your last change was not saved.')
                : t('judging.portal.vote.votingClosedDesc', 'Results are published, so votes can no longer be changed.')}
            </p>
          </div>
        </div>
      ) : null}

      <div className="gap-6 lg:grid lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0 space-y-4">
          {recused ? (
            <div
              data-testid="vote-recused-notice"
              className="flex flex-col gap-3 rounded-xl border border-status-neutral-border bg-status-neutral-bg p-4 text-status-neutral-text sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2">
                <UserX className="mt-0.5 size-4 shrink-0 text-status-neutral-icon" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">{t('judging.portal.recused', 'Recused')}</p>
                  <p className="text-sm">{t('judging.portal.recusedDesc', 'You have recused yourself from scoring this project due to a conflict of interest.')}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={closed} onClick={() => setRecused(false)}>
                {t('judging.portal.vote.undoRecusal', 'Undo recusal')}
              </Button>
            </div>
          ) : (
            <>
              {criteria.length === 0 ? (
                <PortalEmptyState
                  title={t('judging.portal.vote.noCriteria', 'No criteria to rate')}
                  description={t('judging.portal.vote.noCriteriaDesc', 'The organizers have not set up judging criteria for this project yet.')}
                />
              ) : (
                criteria.map(criterion => {
                  const entry = local.votes[criterion.id]
                  return (
                    <StarCriterionCard
                      key={criterion.id}
                      criterion={criterion}
                      stars={entry?.stars ?? null}
                      legacyZero={entry?.legacyZero ?? false}
                      legacy={entry?.legacy ?? false}
                      note={entry?.note ?? ''}
                      onStarsChange={stars => setStars(criterion.id, stars)}
                      onNoteChange={note => setNote(criterion.id, note)}
                      onNoteBlur={saver.flush}
                      disabled={closed}
                    />
                  )
                })
              )}

              <PortalCard>
                <PortalCardHeader title={t('judging.portal.feedback', 'Feedback')} />
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="judging-vote-comment" className="block text-sm font-medium">
                      {t('judging.portal.comment', 'Feedback (visible to team after results)')}
                    </label>
                    <Textarea
                      id="judging-vote-comment"
                      value={local.comment}
                      rows={3}
                      disabled={closed}
                      onChange={event => setComment(event.target.value)}
                      onBlur={saver.flush}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="judging-vote-private-notes" className="block text-sm font-medium">
                      {t('judging.portal.privateNotes', 'Private Notes (only you and admins)')}
                    </label>
                    <Textarea
                      id="judging-vote-private-notes"
                      value={local.privateNotes}
                      rows={2}
                      disabled={closed}
                      onChange={event => setPrivateNotes(event.target.value)}
                      onBlur={saver.flush}
                    />
                  </div>
                </div>
              </PortalCard>

              {!closed ? (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setRecuseOpen(true)}
                    data-testid="vote-recuse"
                  >
                    {t('judging.portal.vote.recuse', 'Recuse myself (conflict of interest)')}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <VoteSummary
          summary={summary}
          place={place}
          progress={progress}
          saveState={saver.saveState}
          onRetry={saver.retry}
          recused={recused}
        />
      </div>

      <ProjectCardSheet project={project} open={cardOpen && project !== null} onOpenChange={setCardOpen} />

      <Dialog open={recuseOpen} onOpenChange={setRecuseOpen}>
        <DialogContent onKeyDown={handleRecuseKeyDown}>
          <DialogHeader>
            <DialogTitle>{t('judging.portal.vote.recuseConfirmTitle', 'Recuse yourself from this project?')}</DialogTitle>
            <DialogDescription>
              {t('judging.portal.vote.recuseConfirmDesc', 'Your vote on this project will not count. Your stars are kept, and you can undo this until results are published.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRecuseOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={confirmRecuse}>
              {t('judging.portal.vote.recuseConfirm', 'Recuse myself')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VotingPageBody({ projectId, orgSlug }: { projectId: string; orgSlug: string }) {
  const t = useT()
  const { selectedId: competitionId, isLoading } = useCompetitionContext()
  if (isLoading) return <VotingSkeleton />
  if (!competitionId) {
    return (
      <PortalEmptyState
        title={t('judging.portal.vote.notFound', 'Project not available')}
        description={t('judging.portal.vote.notFoundDesc', 'This project is not assigned to you in the selected competition.')}
      />
    )
  }
  // Remount per competition so a switch in the picker never sends queued changes to the wrong one.
  return <VotingContent key={`${competitionId}:${projectId}`} projectId={projectId} orgSlug={orgSlug} competitionId={competitionId} />
}

export default function VotingPage({ params }: { params: { orgSlug: string; projectId: string } }) {
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <VotingPageBody projectId={params.projectId} orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}
