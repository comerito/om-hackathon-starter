"use client"
import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, LocateFixed, PanelRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Badge, type BadgeVariant } from '@open-mercato/ui/primitives/badge'
import { Button } from '@open-mercato/ui/primitives/button'
import { Progress } from '@open-mercato/ui/primitives/progress'
import { SwitchField } from '@open-mercato/ui/primitives/switch-field'
import { useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { PortalCompetitionLayout } from '../../../../../competitions/components/PortalCompetitionLayout'
import { PortalPageTitle } from '@/components/portal'
import Link from 'next/link'
import { ProjectCardSheet } from '../../../../components/ProjectCardSheet'
import type { JudgeAssignmentScore, JudgeAssignmentsResponse, JudgeProjectCard } from '../../../../lib/judgeAssignments'
import { formatQueuePosition } from '../../../../lib/demoQueue'
import {
  filterQueueEntries, findOnStage, findUpNext, formatWeightedAverage, queueProgress, resolveQueueEntries,
  type QueueEntry, type VoteState,
} from '../../../../lib/votingQueue'

const EMPTY_RESPONSE: JudgeAssignmentsResponse = { panels: [], projects: [], scores: [], voting_open: true }

const VOTE_BADGE_VARIANT: Record<VoteState, BadgeVariant> = {
  voted: 'success',
  in_progress: 'warning',
  not_voted: 'neutral',
  recused: 'muted',
}

const queueRowId = (projectId: string) => `judging-queue-${projectId}`

function JudgingContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { selectedId: competitionId, isLoading: contextLoading } = useCompetitionContext()
  const [cardProjectId, setCardProjectId] = React.useState<string | null>(null)
  const [cardOpen, setCardOpen] = React.useState(false)

  const hideVoted = searchParams.get('hide_voted') === '1'

  const setHideVoted = React.useCallback((next: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('hide_voted', '1')
    else params.delete('hide_voted')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const { data, isLoading } = useQuery<JudgeAssignmentsResponse>({
    queryKey: ['portal-judge-assignments', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<JudgeAssignmentsResponse>(`/api/judging/portal/my-assignments?competition_id=${competitionId}`)
      if (ok && result) return result
      return EMPTY_RESPONSE
    },
    enabled: !!competitionId,
    refetchInterval: 15000,
  })

  if (contextLoading || isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-16 rounded-lg border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  const projects = data?.projects ?? []

  if (projects.length === 0) {
    return <PortalEmptyState title={t('judging.portal.noAssignments', 'No Projects Assigned')} description={t('judging.portal.noAssignmentsDesc', 'No projects assigned to you yet. Panels will be configured by the organizer.')} />
  }

  const entries = resolveQueueEntries(projects, data?.scores ?? [])
  const visibleEntries = filterQueueEntries(entries, hideVoted)
  const { done, total } = queueProgress(entries)
  const onStage = findOnStage(projects)
  const upNext = findUpNext(projects)
  const onStageVisible = onStage !== null && visibleEntries.some(entry => entry.project.id === onStage.id)
  const cardProject = cardProjectId ? projects.find(project => project.id === cardProjectId) ?? null : null

  const voteLabel = (entry: QueueEntry<JudgeProjectCard, JudgeAssignmentScore>): string => {
    switch (entry.state) {
      case 'voted': {
        const score = formatWeightedAverage(entry.score?.weighted_average)
        return score
          ? t('judging.portal.queue.vote.votedWithScore', 'Voted · {score}', { score })
          : t('judging.portal.queue.vote.voted', 'Voted')
      }
      case 'in_progress':
        return entry.criteriaCount > 0
          ? t('judging.portal.queue.vote.inProgressCount', 'In progress · {rated}/{total}', {
            rated: Math.min(entry.ratedCount, entry.criteriaCount), total: entry.criteriaCount,
          })
          : t('judging.portal.queue.vote.inProgress', 'In progress')
      case 'recused':
        return t('judging.portal.queue.vote.recused', 'Recused')
      default:
        return t('judging.portal.queue.vote.notVoted', 'Not voted')
    }
  }

  const jumpToOnStage = () => {
    if (!onStage) return
    document.getElementById(queueRowId(onStage.id))?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{t('judging.portal.scoringProgress', 'Scoring Progress')}</span>
          <span className="text-sm text-muted-foreground tabular-nums">{done} / {total}</span>
        </div>
        <Progress value={done} max={Math.max(total, 1)} tone="success" />
      </div>

      {data?.voting_open === false && (
        <div role="status" className="rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-sm font-medium text-status-warning-text">
          {t('judging.portal.queue.votingClosed', 'Voting is closed')}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SwitchField
          checked={hideVoted}
          onCheckedChange={setHideVoted}
          label={t('judging.portal.queue.hideVoted', 'Hide voted')}
          flip
        />
        {onStageVisible && (
          <Button type="button" variant="outline" size="sm" onClick={jumpToOnStage}>
            <LocateFixed className="size-4" aria-hidden="true" />
            {t('judging.portal.queue.jumpToOnStage', 'Jump to on stage')}
          </Button>
        )}
      </div>

      {/* Queue */}
      {visibleEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">{t('judging.portal.queue.allVoted', 'All projects voted')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('judging.portal.queue.allVotedDesc', 'Turn off "Hide voted" to see them again.')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleEntries.map((entry) => {
            const { project, state } = entry
            const isOnStage = onStage?.id === project.id
            const isUpNext = upNext?.id === project.id
            const position = formatQueuePosition(project.demo?.order)
            const meta = [project.team_name, project.track_name].filter((value): value is string => !!value && value.trim().length > 0)

            return (
              <li
                key={project.id}
                id={queueRowId(project.id)}
                data-vote-state={state}
                className={`overflow-hidden rounded-xl border bg-card transition-colors ${isOnStage ? 'border-status-info-icon ring-2 ring-status-info-border' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-stretch">
                  <Link
                    href={`/${orgSlug}/portal/judging/${project.id}`}
                    className={`flex min-w-0 flex-1 items-start gap-3 p-4 transition-colors hover:bg-muted/30 ${isOnStage ? 'bg-status-info-bg' : ''}`}
                  >
                    <span
                      className="w-9 shrink-0 pt-0.5 font-mono text-sm tabular-nums text-muted-foreground"
                      title={t('judging.portal.projectCard.queuePosition', 'Demo order')}
                    >
                      {position ? `#${position}` : '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-medium break-words">{project.title}</h3>
                        {isOnStage && (
                          <Badge variant="info" size="sm" dot>{t('judging.portal.queue.onStage', 'On stage')}</Badge>
                        )}
                        {isUpNext && (
                          <Badge variant="outline" size="sm">{t('judging.portal.queue.upNext', 'Up next')}</Badge>
                        )}
                        {project.flagged_for_reuse && (
                          <Badge variant="error" size="sm">{t('judging.portal.flagged', 'Flagged')}</Badge>
                        )}
                      </div>
                      {meta.length > 0 && (
                        <p className="mt-0.5 text-sm text-muted-foreground break-words">{meta.join(' · ')}</p>
                      )}
                      <div className="mt-2">
                        <Badge variant={VOTE_BADGE_VARIANT[state]} className="tabular-nums">
                          {voteLabel(entry)}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                  <div className="flex items-center justify-end border-t px-3 py-2 sm:border-l sm:border-t-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setCardProjectId(project.id); setCardOpen(true) }}
                      aria-label={t('judging.portal.queue.openProjectCard', 'Open project card: {title}', { title: project.title })}
                    >
                      <PanelRight className="size-4" aria-hidden="true" />
                      {t('judging.portal.projectCard.title', 'Project card')}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ProjectCardSheet project={cardProject} open={cardOpen && cardProject !== null} onOpenChange={setCardOpen} />
    </div>
  )
}

export default function JudgingDashboardPage({ params }: { params: { orgSlug: string } }) {
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
        label={t('judging.portal.judgingLabel', 'Score assigned projects')}
        title={t('judging.portal.judgingTitle', 'Judging Dashboard')}
      />
      <JudgingContent orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}
