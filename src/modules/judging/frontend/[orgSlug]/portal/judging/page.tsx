"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { CompetitionProvider, useCompetitionContext } from '../../../../../competitions/components/CompetitionContext'
import { CompetitionSelector } from '../../../../../competitions/components/CompetitionSelector'
import Link from 'next/link'

type ProjectAssignment = {
  id: string; title: string; tagline: string | null; team_name: string | null
  track_id: string; flagged_for_reuse: boolean; uses_preexisting_code: boolean
}

type ScoreStatus = { id: string; project_id: string; round: string; total_score: number | null; is_submitted: boolean; conflict_of_interest: boolean }

type AssignmentsResponse = {
  panels: Array<{ id: string; name: string; round: string }>
  projects: ProjectAssignment[]
  scores: ScoreStatus[]
}

function JudgingContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const { selectedId: competitionId } = useCompetitionContext()

  const { data, isLoading } = useQuery<AssignmentsResponse>({
    queryKey: ['portal-judge-assignments', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<AssignmentsResponse>(`/api/judging/portal/my-assignments?competition_id=${competitionId}`)
      if (ok && result) return result
      return { panels: [], projects: [], scores: [] }
    },
    enabled: !!competitionId,
  })

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t('common.loading', 'Loading...')}</div>

  const projects = data?.projects ?? []
  const scores = data?.scores ?? []
  const scoreMap = new Map(scores.map(s => [s.project_id + ':' + s.round, s]))

  if (projects.length === 0) {
    return <PortalEmptyState title={t('judging.portal.noAssignments', 'No Projects Assigned')} description={t('judging.portal.noAssignmentsDesc', 'No projects assigned to you yet. Panels will be configured by the organizer.')} />
  }

  const scored = scores.filter(s => s.is_submitted).length
  const total = projects.length

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{t('judging.portal.scoringProgress', 'Scoring Progress')}</span>
          <span className="text-sm text-muted-foreground">{scored} / {total}</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${total ? (scored / total) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Project list */}
      <div className="space-y-3">
        {projects.map(project => {
          const score = scoreMap.get(project.id + ':preliminary')
          const status = score?.is_submitted ? 'submitted' : score ? 'draft' : 'unscored'
          const statusStyles = {
            submitted: 'bg-green-100 text-green-800',
            draft: 'bg-yellow-100 text-yellow-800',
            unscored: 'bg-gray-100 text-gray-600',
          }

          return (
            <Link key={project.id} href={`/${orgSlug}/portal/judging/${project.id}`}>
              <PortalCard>
                <div className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{project.title}</h3>
                      {project.flagged_for_reuse && (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">Flagged</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{project.team_name}</p>
                    {project.tagline && <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.tagline}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {score?.total_score != null && <span className="text-lg font-mono font-bold">{score.total_score.toFixed(1)}</span>}
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>
                      {status === 'submitted' ? 'Submitted' : status === 'draft' ? 'Draft' : 'Unscored'}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </div>
              </PortalCard>
            </Link>
          )
        })}
      </div>
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
    <CompetitionProvider>
      <CompetitionSelector />
      <div className="flex flex-col gap-6">
        <PortalPageHeader title={t('judging.portal.judgingTitle', 'Judging Dashboard')} label={t('judging.portal.judgingLabel', 'Score assigned projects')} />
        <JudgingContent orgSlug={params.orgSlug} />
      </div>
    </CompetitionProvider>
  )
}
