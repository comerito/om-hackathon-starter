'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Criterion {
  id: string
  name: string
  description: string | null
  maxScore: number
  weight: number
  order: number
}

interface ExistingScore {
  id: string
  projectId: string
  isSubmitted: boolean
  comment: string | null
  privateNotes: string | null
  conflictOfInterest: boolean
}

interface ExistingCriterionScore {
  criterionId: string
  score: number
  note: string | null
}

interface ProjectInfo {
  id: string
  title: string
  tagline: string | null
  description: string | null
  techStack: string[]
  demoUrl: string | null
  repoUrl: string | null
}

// ---------------------------------------------------------------------------
// Score button component
// ---------------------------------------------------------------------------

function ScoreButtons({
  maxScore,
  value,
  onChange,
}: {
  maxScore: number
  value: number | null
  onChange: (score: number) => void
}) {
  const buttons = Array.from({ length: maxScore + 1 }, (_, i) => i)
  return (
    <div className="flex flex-wrap gap-1.5">
      {buttons.map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
            value === score
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-muted border-border'
          }`}
        >
          {score}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScoreCardPage({ params }: { params: { orgSlug: string; projectId: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()
  const { user } = auth

  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [scores, setScores] = useState<Map<string, number>>(new Map())
  const [notes, setNotes] = useState<Map<string, string>>(new Map())
  const [comment, setComment] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')
  const [conflictOfInterest, setConflictOfInterest] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [judgePanelId, setJudgePanelId] = useState<string | null>(null)

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Get active competition
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp = compRes?.data?.[0]
      if (!comp) { setLoading(false); return }
      setCompetitionId(comp.id)

      // Get project details
      const projRes = await apiCall(`/api/projects/projects?id=${params.projectId}&pageSize=1`)
      const proj = projRes?.items?.[0]
      if (proj) {
        setProject({
          id: proj.id,
          title: proj.title,
          tagline: proj.tagline ?? null,
          description: proj.description ?? null,
          techStack: proj.tech_stack ?? [],
          demoUrl: proj.demo_url ?? null,
          repoUrl: proj.repo_url ?? null,
        })
      }

      // Get criteria
      const criteriaRes = await apiCall(`/api/judging/criteria?competitionId=${comp.id}&pageSize=50&sortField=order&sortDir=asc`)
      const criteriaList: Criterion[] = (criteriaRes?.items ?? []).map((c: Record<string, unknown>) => ({
        id: String(c.id),
        name: String(c.name),
        description: c.description ? String(c.description) : null,
        maxScore: Number(c.max_score ?? 10),
        weight: Number(c.weight ?? 0),
        order: Number(c.order ?? 0),
      }))
      setCriteria(criteriaList)

      // Get judge's panel
      const panelRes = await apiCall(`/api/judging/panels?competitionId=${comp.id}&pageSize=50`)
      // Find the panel that this judge belongs to (simplified: take first one)
      const panels = panelRes?.items ?? []
      if (panels.length > 0) {
        setJudgePanelId(panels[0].id)
      }

      // Get existing score for this project
      const scoreRes = await apiCall(`/api/judging/scores?projectId=${params.projectId}&judgeId=${user.id}&pageSize=1`)
      const existingScore: ExistingScore | null = scoreRes?.items?.[0] ?? null

      if (existingScore) {
        setComment(existingScore.comment ?? '')
        setPrivateNotes(existingScore.privateNotes ?? '')
        setConflictOfInterest(existingScore.conflictOfInterest)
        setIsSubmitted(existingScore.isSubmitted)

        // Load criterion scores - we'd need to fetch from the API
        // For now we initialize from the score
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user, params.projectId])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Auto-save function
  const doAutoSave = useCallback(async () => {
    if (!competitionId || !judgePanelId || !user || conflictOfInterest) return

    const criterionScores = Array.from(scores.entries()).map(([criterionId, score]) => ({
      criterionId,
      score,
      note: notes.get(criterionId) ?? null,
    }))

    if (criterionScores.length === 0) return

    setSaving(true)
    try {
      await apiCall('/api/judging/scores', {
        method: 'POST',
        body: JSON.stringify({
          projectId: params.projectId,
          round: 'PRELIMINARY',
          judgePanelId,
          competitionId,
          criterionScores,
          comment: comment || null,
          privateNotes: privateNotes || null,
          conflictOfInterest,
          isSubmitted: false,
        }),
      })
    } catch {
      // silent auto-save
    } finally {
      setSaving(false)
    }
  }, [competitionId, judgePanelId, user, scores, notes, comment, privateNotes, conflictOfInterest, params.projectId])

  // Trigger auto-save on score changes
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(doAutoSave, 2000)
  }, [doAutoSave])

  const handleScoreChange = (criterionId: string, score: number) => {
    setScores((prev) => {
      const next = new Map(prev)
      next.set(criterionId, score)
      return next
    })
    scheduleAutoSave()
  }

  const handleNoteChange = (criterionId: string, note: string) => {
    setNotes((prev) => {
      const next = new Map(prev)
      next.set(criterionId, note)
      return next
    })
    scheduleAutoSave()
  }

  const handleSubmit = async () => {
    if (!competitionId || !judgePanelId || !user) return

    const criterionScores = Array.from(scores.entries()).map(([criterionId, score]) => ({
      criterionId,
      score,
      note: notes.get(criterionId) ?? null,
    }))

    if (criterionScores.length < criteria.length) {
      alert('Please score all criteria before submitting.')
      return
    }

    setSaving(true)
    try {
      await apiCall('/api/judging/scores', {
        method: 'POST',
        body: JSON.stringify({
          projectId: params.projectId,
          round: 'PRELIMINARY',
          judgePanelId,
          competitionId,
          criterionScores,
          comment: comment || null,
          privateNotes: privateNotes || null,
          conflictOfInterest,
          isSubmitted: true,
        }),
      })
      setIsSubmitted(true)
      router.push(`/${params.orgSlug}/portal/judging`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit score')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <PortalPageHeader
        label={project?.title ?? 'Score Card'}
        title={t('judging.portal.scoreCard.title', 'Score Card')}
      />

      {/* Saving indicator */}
      {saving && (
        <div className="fixed top-4 right-4 z-50 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          Saving...
        </div>
      )}

      {/* Draft badge */}
      {scores.size > 0 && !isSubmitted && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/20 p-3 text-center">
          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Draft - Auto-saving your progress
          </span>
        </div>
      )}

      {/* Conflict of interest prompt */}
      <PortalCard>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="coi"
            checked={conflictOfInterest}
            onChange={(e) => {
              setConflictOfInterest(e.target.checked)
              scheduleAutoSave()
            }}
            className="h-5 w-5 rounded border-border"
          />
          <label htmlFor="coi" className="text-sm">
            {t('judging.portal.scoreCard.coi', 'I have a conflict of interest with this project and should be recused from scoring.')}
          </label>
        </div>
      </PortalCard>

      {conflictOfInterest ? (
        <PortalCard>
          <p className="text-muted-foreground text-center py-8">
            {t('judging.portal.scoreCard.coiMessage', 'You have declared a conflict of interest. No scoring is required for this project.')}
          </p>
        </PortalCard>
      ) : (
        <>
          {/* Project details (collapsible) */}
          <PortalCard>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex w-full items-center justify-between"
            >
              <PortalCardHeader label="Project" title={project?.title ?? 'Untitled'} />
              <span className="text-sm text-muted-foreground">{showDetails ? 'Hide' : 'Show'} details</span>
            </button>
            {showDetails && project && (
              <div className="mt-4 space-y-3 border-t pt-4">
                {project.tagline && <p className="text-sm italic">{project.tagline}</p>}
                {project.description && <p className="text-sm">{project.description}</p>}
                {project.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {project.techStack.map((tech) => (
                      <span key={tech} className="rounded-full bg-muted px-2 py-0.5 text-xs">{tech}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 text-sm">
                  {project.demoUrl && (
                    <a href={project.demoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Demo
                    </a>
                  )}
                  {project.repoUrl && (
                    <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Repository
                    </a>
                  )}
                </div>
              </div>
            )}
          </PortalCard>

          {/* Criteria scoring */}
          {criteria.map((criterion) => (
            <PortalCard key={criterion.id}>
              <PortalCardHeader
                label={`Weight: ${(criterion.weight * 100).toFixed(0)}%`}
                title={criterion.name}
              />
              {criterion.description && (
                <p className="text-sm text-muted-foreground mt-1">{criterion.description}</p>
              )}
              <div className="mt-3">
                <ScoreButtons
                  maxScore={criterion.maxScore}
                  value={scores.get(criterion.id) ?? null}
                  onChange={(score) => handleScoreChange(criterion.id, score)}
                />
              </div>
              <textarea
                className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Notes for this criterion (optional)"
                rows={2}
                value={notes.get(criterion.id) ?? ''}
                onChange={(e) => handleNoteChange(criterion.id, e.target.value)}
              />
            </PortalCard>
          ))}

          {/* Feedback textarea */}
          <PortalCard>
            <PortalCardHeader label="Optional" title="Feedback for team" />
            <textarea
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Overall feedback visible to the team"
              rows={3}
              value={comment}
              onChange={(e) => { setComment(e.target.value); scheduleAutoSave() }}
            />
          </PortalCard>

          {/* Private notes */}
          <PortalCard>
            <PortalCardHeader label="Private" title="Notes for yourself" />
            <textarea
              className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Private notes only visible to you"
              rows={2}
              value={privateNotes}
              onChange={(e) => { setPrivateNotes(e.target.value); scheduleAutoSave() }}
            />
          </PortalCard>
        </>
      )}

      {/* Submit button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/${params.orgSlug}/portal/judging`)}
        >
          {t('judging.portal.scoreCard.back', 'Back')}
        </Button>
        {!conflictOfInterest && (
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={saving || isSubmitted || scores.size < criteria.length}
          >
            {isSubmitted
              ? t('judging.portal.scoreCard.submitted', 'Submitted')
              : saving
                ? 'Saving...'
                : t('judging.portal.scoreCard.submit', 'Submit Score')}
          </Button>
        )}
      </div>
    </div>
  )
}
