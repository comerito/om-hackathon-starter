'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components'
import { PortalEmptyState } from '@open-mercato/ui/portal/components'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DemoSession {
  id: string
  teamId: string
  projectId: string
  presentationOrder: number
  status: string
}

interface ProjectScore {
  id: string
  projectId: string
  isSubmitted: boolean
  totalScore: number | null
}

interface AssignedProject {
  projectId: string
  teamId: string
  presentationOrder: number
  status: string // demo status
  scored: boolean
  submitted: boolean
  totalScore: number | null
  teamName?: string
  projectTitle?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JudgeDashboardPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user } = auth

  const [projects, setProjects] = useState<AssignedProject[]>([])
  const [loading, setLoading] = useState(true)
  const [competitionId, setCompetitionId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Get active competition
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp = compRes?.data?.[0]
      if (!comp) { setLoading(false); return }
      setCompetitionId(comp.id)

      // Get demo sessions for this competition
      const demoRes = await apiCall(`/api/judging/demos?competitionId=${comp.id}&pageSize=100&sortField=presentation_order&sortDir=asc`)
      const demos: DemoSession[] = demoRes?.items ?? []

      // Get my scores
      const scoreRes = await apiCall(`/api/judging/scores?competitionId=${comp.id}&judgeId=${user.id}&pageSize=100`)
      const scores: ProjectScore[] = scoreRes?.items ?? []

      const scoreByProject = new Map<string, ProjectScore>()
      for (const s of scores) {
        scoreByProject.set(s.projectId, s)
      }

      // Build assigned projects list
      const assignedProjects: AssignedProject[] = demos.map((demo) => {
        const score = scoreByProject.get(demo.projectId)
        return {
          projectId: demo.projectId,
          teamId: demo.teamId,
          presentationOrder: demo.presentationOrder,
          status: demo.status,
          scored: !!score,
          submitted: score?.isSubmitted ?? false,
          totalScore: score?.totalScore ?? null,
        }
      })

      // Enrich with team/project names (batch)
      const projectIds = assignedProjects.map((p) => p.projectId)
      if (projectIds.length > 0) {
        try {
          const projectsRes = await apiCall(`/api/projects/projects?competitionId=${comp.id}&pageSize=100`)
          const projectMap = new Map<string, { title: string; team_id: string }>()
          for (const p of projectsRes?.items ?? []) {
            projectMap.set(p.id, { title: p.title, team_id: p.team_id })
          }
          const teamsRes = await apiCall(`/api/teams/teams?competitionId=${comp.id}&pageSize=100`)
          const teamMap = new Map<string, string>()
          for (const t of teamsRes?.items ?? []) {
            teamMap.set(t.id, t.name)
          }
          for (const ap of assignedProjects) {
            const proj = projectMap.get(ap.projectId)
            if (proj) {
              ap.projectTitle = proj.title
              ap.teamName = teamMap.get(ap.teamId) ?? undefined
            }
          }
        } catch {
          // non-critical enrichment
        }
      }

      setProjects(assignedProjects)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Refresh on events
  usePortalAppEvent('judging.demo.status_changed', () => { fetchData() })
  usePortalAppEvent('judging.score.submitted', () => { fetchData() })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('judging.portal.judging.title', 'Judging')} />
        <PortalEmptyState
          title={t('judging.portal.judging.empty', 'No projects assigned')}
          description="You have no projects to judge at this time."
        />
      </div>
    )
  }

  // Categorize
  const presenting = projects.filter((p) => p.status === 'PRESENTING' || p.status === 'QA')
  const unscored = projects.filter((p) => !p.submitted && p.status !== 'PRESENTING' && p.status !== 'QA')
  const scored = projects.filter((p) => p.submitted)

  const renderProjectCard = (project: AssignedProject) => (
    <Link
      key={project.projectId}
      href={`/${params.orgSlug}/portal/judging/${project.projectId}`}
      className="block"
    >
      <PortalCard className="transition-colors hover:border-primary/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">#{project.presentationOrder}</p>
            <h3 className="font-medium">{project.teamName ?? project.teamId.slice(0, 8)}</h3>
            <p className="text-sm text-muted-foreground">{project.projectTitle ?? 'Untitled'}</p>
          </div>
          <div className="text-right">
            {project.submitted ? (
              <div>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
                  Submitted
                </span>
                {project.totalScore != null && (
                  <p className="mt-1 text-sm font-medium">{project.totalScore.toFixed(1)}</p>
                )}
              </div>
            ) : project.scored ? (
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
                Draft
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Not scored
              </span>
            )}
          </div>
        </div>
      </PortalCard>
    </Link>
  )

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader title={t('judging.portal.judging.title', 'Judging')} />

      {/* Currently Presenting */}
      {presenting.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Currently Presenting
          </h2>
          <div className="space-y-2">
            {presenting.map(renderProjectCard)}
          </div>
        </div>
      )}

      {/* Unscored */}
      {unscored.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Unscored ({unscored.length})
          </h2>
          <div className="space-y-2">
            {unscored.map(renderProjectCard)}
          </div>
        </div>
      )}

      {/* Scored */}
      {scored.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Scored ({scored.length})
          </h2>
          <div className="space-y-2">
            {scored.map(renderProjectCard)}
          </div>
        </div>
      )}
    </div>
  )
}
