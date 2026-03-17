"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProjectRow = {
  id: string
  team_id: string
  competition_id: string
  track_id: string
  title: string
  tagline: string | null
  description: string | null
  problem_statement: string | null
  solution: string | null
  tech_stack: string[]
  demo_url: string | null
  repo_url: string | null
  video_url: string | null
  presentation_url: string | null
  uses_preexisting_code: boolean
  preexisting_code_description: string | null
  built_during_hackathon_description: string | null
  flagged_for_reuse: boolean
  flagged_by: string | null
  flagged_at: string | null
  flagged_reason: string | null
  status: string
  submitted_at: string | null
  final_score: number | null
  peer_vote_count: number | null
  rank: number | null
  manual_rank_override: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  team_name?: string | null
  track_name?: string | null
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  SCORED: 'bg-blue-100 text-blue-800',
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params?.id

  // Fetch project
  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project-detail', id],
    queryFn: async () => {
      const res = await fetchCrudList<ProjectRow>('projects/projects', { id: id!, pageSize: '1' } as Record<string, string>)
      return res?.items?.[0] ?? null
    },
    enabled: !!id,
  })

  const project = projectData ?? null

  const handleFlag = async () => {
    if (!project) return
    const reason = window.prompt(t('projects.detail.prompt.flagReason', 'Reason for flagging:'))
    if (!reason) return
    try {
      await apiCall('/api/projects/projects/flag', {
        method: 'POST',
        body: JSON.stringify({ projectId: project.id, reason }),
      })
      flash(t('projects.flash.flagged', 'Project flagged'), 'success')
      queryClient.invalidateQueries({ queryKey: ['project-detail', id] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to flag', 'error')
    }
  }

  const handleUnflag = async () => {
    if (!project) return
    try {
      await apiCall('/api/projects/projects/unflag', {
        method: 'POST',
        body: JSON.stringify({ projectId: project.id }),
      })
      flash(t('projects.flash.unflagged', 'Flag removed'), 'success')
      queryClient.invalidateQueries({ queryKey: ['project-detail', id] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to remove flag', 'error')
    }
  }

  if (!id) return null

  if (isLoading) {
    return (
      <Page>
        <PageBody>
          <div className="flex items-center justify-center py-20">
            <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          </div>
        </PageBody>
      </Page>
    )
  }

  if (!project) {
    return (
      <Page>
        <PageBody>
          <div className="text-red-600">{t('projects.detail.notFound', 'Project not found')}</div>
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href={`/backend/projects?competitionId=${project.competition_id}`} className="text-sm text-muted-foreground hover:underline">
                {t('projects.detail.backToProjects', 'Projects')}
              </Link>
            </div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            {project.tagline && (
              <p className="text-muted-foreground mt-1">{project.tagline}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={project.status} />
              {project.flagged_for_reuse && (
                <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-xs font-medium">
                  Flagged for Reuse
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!project.flagged_for_reuse ? (
              <Button variant="destructive" size="sm" onClick={handleFlag}>
                {t('projects.detail.actions.flag', 'Flag for Reuse')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleUnflag}>
                {t('projects.detail.actions.unflag', 'Remove Flag')}
              </Button>
            )}
          </div>
        </div>

        {/* Flag details */}
        {project.flagged_for_reuse && project.flagged_reason && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-medium text-red-800 mb-1">{t('projects.detail.flagReason', 'Flag Reason')}</h3>
            <p className="text-sm text-red-700">{project.flagged_reason}</p>
            {project.flagged_at && (
              <p className="text-xs text-red-500 mt-1">
                {t('projects.detail.flaggedAt', 'Flagged at')}: {new Date(project.flagged_at).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Info grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">{t('projects.detail.team', 'Team')}</div>
            <div className="text-sm font-medium">{project.team_name ?? project.team_id.slice(0, 8) + '...'}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">{t('projects.detail.track', 'Track')}</div>
            <div className="text-sm font-medium">{project.track_name ?? project.track_id.slice(0, 8) + '...'}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">{t('projects.detail.submitted', 'Submitted')}</div>
            <div className="text-sm font-medium">
              {project.submitted_at ? new Date(project.submitted_at).toLocaleString() : '-'}
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">{t('projects.detail.score', 'Score')}</div>
            <div className="text-sm font-medium">
              {project.final_score != null ? project.final_score.toFixed(2) : '-'}
              {project.rank != null && ` (#${project.rank})`}
            </div>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <div className="mb-6 rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">{t('projects.detail.description', 'Description')}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
          </div>
        )}

        {/* Problem & Solution */}
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          {project.problem_statement && (
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-medium mb-1">{t('projects.detail.problemStatement', 'Problem Statement')}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.problem_statement}</p>
            </div>
          )}
          {project.solution && (
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-medium mb-1">{t('projects.detail.solution', 'Solution')}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.solution}</p>
            </div>
          )}
        </div>

        {/* Tech Stack */}
        {project.tech_stack && project.tech_stack.length > 0 && (
          <div className="mb-6 rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-2">{t('projects.detail.techStack', 'Tech Stack')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {project.tech_stack.map((tech, i) => (
                <span key={i} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        {(project.demo_url || project.repo_url || project.video_url || project.presentation_url) && (
          <div className="mb-6 rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-2">{t('projects.detail.links', 'Links')}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {project.demo_url && (
                <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                  Demo: {project.demo_url}
                </a>
              )}
              {project.repo_url && (
                <a href={project.repo_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                  Repository: {project.repo_url}
                </a>
              )}
              {project.video_url && (
                <a href={project.video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                  Video: {project.video_url}
                </a>
              )}
              {project.presentation_url && (
                <a href={project.presentation_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                  Slides: {project.presentation_url}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Originality Disclosure */}
        <div className="mb-6 rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-2">{t('projects.detail.originality', 'Originality Disclosure')}</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">{t('projects.detail.usesPreexistingCode', 'Uses pre-existing code')}:</span>{' '}
              <span className="font-medium">{project.uses_preexisting_code ? 'Yes' : 'No'}</span>
            </div>
            {project.uses_preexisting_code && project.preexisting_code_description && (
              <div>
                <span className="text-muted-foreground">{t('projects.detail.preexistingDesc', 'Description')}:</span>
                <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{project.preexisting_code_description}</p>
              </div>
            )}
            {project.built_during_hackathon_description && (
              <div>
                <span className="text-muted-foreground">{t('projects.detail.builtDuringDesc', 'Built during hackathon')}:</span>
                <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{project.built_during_hackathon_description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Scoring */}
        {(project.final_score != null || project.peer_vote_count != null || project.rank != null) && (
          <div className="mb-6 rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-2">{t('projects.detail.scoring', 'Scoring')}</h3>
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">{t('projects.detail.finalScore', 'Final Score')}</div>
                <div className="text-lg font-semibold">{project.final_score != null ? project.final_score.toFixed(2) : '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('projects.detail.peerVotes', 'Peer Votes')}</div>
                <div className="text-lg font-semibold">{project.peer_vote_count ?? '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('projects.detail.rank', 'Rank')}</div>
                <div className="text-lg font-semibold">{project.rank != null ? `#${project.rank}` : '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t('projects.detail.manualOverride', 'Manual Override')}</div>
                <div className="text-lg font-semibold">{project.manual_rank_override != null ? `#${project.manual_rank_override}` : '-'}</div>
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </Page>
  )
}
