"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { CompetitionProvider, useCompetitionContext } from '../../../../../../competitions/components/CompetitionContext'

type Criterion = { id: string; name: string; description: string | null; max_score: number; weight: number; order: number }
type ExistingScore = {
  id: string; total_score: number | null; comment: string | null; private_notes: string | null
  conflict_of_interest: boolean; is_submitted: boolean
  criterion_scores: Array<{ criterion_id: string; score: number; note: string | null }>
}
type ScoreDataResponse = { criteria: Criterion[]; score: ExistingScore | null }

function ScoreCardContent({ projectId, orgSlug }: { projectId: string; orgSlug: string }) {
  const t = useT()
  const queryClient = useQueryClient()
  const { selectedId: competitionId } = useCompetitionContext()

  const [criterionScores, setCriterionScores] = React.useState<Map<string, number>>(new Map())
  const [criterionNotes, setCriterionNotes] = React.useState<Map<string, string>>(new Map())
  const [comment, setComment] = React.useState('')
  const [privateNotes, setPrivateNotes] = React.useState('')
  const [conflictOfInterest, setConflictOfInterest] = React.useState<boolean | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const autoSaveRef = React.useRef<NodeJS.Timeout | null>(null)

  const { data, isLoading } = useQuery<ScoreDataResponse>({
    queryKey: ['portal-score', projectId, competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<ScoreDataResponse>(
        `/api/judging/portal/score-project?project_id=${projectId}&competition_id=${competitionId}&round=preliminary`,
      )
      if (ok && result) return result
      return { criteria: [], score: null }
    },
    enabled: !!competitionId && !!projectId,
  })

  // Populate from existing score
  React.useEffect(() => {
    if (!data?.score) return
    const s = data.score
    setComment(s.comment ?? '')
    setPrivateNotes(s.private_notes ?? '')
    setConflictOfInterest(s.conflict_of_interest)
    const scMap = new Map<string, number>()
    const noteMap = new Map<string, string>()
    for (const cs of s.criterion_scores) {
      scMap.set(cs.criterion_id, cs.score)
      if (cs.note) noteMap.set(cs.criterion_id, cs.note)
    }
    setCriterionScores(scMap)
    setCriterionNotes(noteMap)
  }, [data?.score])

  const criteria = data?.criteria ?? []
  const isSubmitted = data?.score?.is_submitted ?? false

  function buildPayload(submit: boolean) {
    return {
      project_id: projectId,
      judge_panel_id: 'auto', // Will be resolved server-side
      competition_id: competitionId,
      round: 'preliminary',
      comment: comment.trim() || null,
      private_notes: privateNotes.trim() || null,
      conflict_of_interest: conflictOfInterest ?? false,
      is_submitted: submit,
      criterion_scores: criteria.map(c => ({
        criterion_id: c.id,
        score: criterionScores.get(c.id) ?? 0,
        note: criterionNotes.get(c.id)?.trim() || null,
      })),
    }
  }

  async function doSave(submit: boolean) {
    if (submit) setSubmitting(true); else setSaving(true)
    try {
      const { ok, result } = await apiCall<{ ok: boolean; error?: string }>('/api/judging/portal/score-project', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildPayload(submit)),
      })
      if (ok) {
        flash(submit ? t('judging.portal.scoreSubmitted', 'Score submitted!') : t('judging.portal.scoreSaved', 'Score saved'), 'success')
        if (submit) queryClient.invalidateQueries({ queryKey: ['portal-judge-assignments'] })
      } else {
        flash(result?.error ?? t('judging.portal.saveFailed', 'Failed to save'), 'error')
      }
    } finally {
      setSaving(false); setSubmitting(false)
    }
  }

  // Auto-save on change (debounced)
  React.useEffect(() => {
    if (isSubmitted || conflictOfInterest === null) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => doSave(false), 5000)
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [criterionScores, criterionNotes, comment, privateNotes, conflictOfInterest])

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{t('common.loading', 'Loading...')}</div>

  // Conflict of interest prompt
  if (conflictOfInterest === null && !isSubmitted) {
    return (
      <PortalCard>
        <div className="p-6 text-center space-y-4">
          <h3 className="text-lg font-semibold">{t('judging.portal.conflictPrompt', 'Conflict of Interest Check')}</h3>
          <p className="text-muted-foreground">{t('judging.portal.conflictDesc', 'Do you have a conflict of interest with this team?')}</p>
          <div className="flex justify-center gap-4">
            <Button variant="destructive" onClick={() => { setConflictOfInterest(true); doSave(false) }}>
              {t('judging.portal.yesRecuse', 'Yes, recuse myself')}
            </Button>
            <Button onClick={() => setConflictOfInterest(false)}>
              {t('judging.portal.noProceed', 'No, proceed to scoring')}
            </Button>
          </div>
        </div>
      </PortalCard>
    )
  }

  if (conflictOfInterest) {
    return (
      <PortalCard>
        <div className="p-6 text-center space-y-2">
          <h3 className="text-lg font-semibold text-muted-foreground">{t('judging.portal.recused', 'Recused')}</h3>
          <p className="text-sm text-muted-foreground">{t('judging.portal.recusedDesc', 'You have recused yourself from scoring this project due to a conflict of interest.')}</p>
        </div>
      </PortalCard>
    )
  }

  return (
    <div className="space-y-6">
      {isSubmitted && (
        <div className="rounded-lg border border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/10 p-3 text-center">
          <span className="text-sm font-medium text-green-800 dark:text-green-400">{t('judging.portal.alreadySubmitted', 'This score has been submitted.')}</span>
        </div>
      )}

      {/* Criterion scoring — tappable number buttons */}
      {criteria.map(criterion => {
        const currentScore = criterionScores.get(criterion.id) ?? -1
        return (
          <PortalCard key={criterion.id}>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{criterion.name}</h4>
                  {criterion.description && <p className="text-xs text-muted-foreground mt-0.5">{criterion.description}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{(criterion.weight * 100).toFixed(0)}%</span>
              </div>
              {/* Tappable number buttons */}
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: criterion.max_score + 1 }, (_, i) => (
                  <button key={i} type="button" disabled={isSubmitted}
                    onClick={() => { const m = new Map(criterionScores); m.set(criterion.id, i); setCriterionScores(m) }}
                    className={`h-10 w-10 rounded-lg text-sm font-medium transition-all ${
                      currentScore === i
                        ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    } ${isSubmitted ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                    aria-label={t('judging.portal.scoreAria', 'Score {score} out of {max}', { score: i, max: criterion.max_score })}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          </PortalCard>
        )
      })}

      {/* Feedback */}
      <PortalCard>
        <PortalCardHeader title={t('judging.portal.feedback', 'Feedback')} />
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('judging.portal.comment', 'Feedback (visible to team after results)')}</label>
            <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={comment} onChange={(e) => setComment(e.target.value)} disabled={isSubmitted} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('judging.portal.privateNotes', 'Private Notes (only you and admins)')}</label>
            <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} disabled={isSubmitted} />
          </div>
        </div>
      </PortalCard>

      {/* Save / Submit */}
      {!isSubmitted && (
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => doSave(false)} disabled={saving}>
            {saving ? t('common.saving', 'Saving...') : t('judging.portal.saveDraft', 'Save Draft')}
          </Button>
          <Button onClick={() => doSave(true)} disabled={submitting}>
            {submitting ? t('common.submitting', 'Submitting...') : t('judging.portal.submitScore', 'Submit Score')}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function ScoreCardPage({ params }: { params: { orgSlug: string; projectId: string } }) {
  const t = useT()
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) router.replace(`/${params.orgSlug}/portal/login`)
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <CompetitionProvider>
      <div className="flex flex-col gap-6">
        <PortalPageHeader title={t('judging.portal.scoreCard', 'Score Card')} label={t('judging.portal.scoreCardLabel', 'Rate this project')} />
        <ScoreCardContent projectId={params.projectId} orgSlug={params.orgSlug} />
      </div>
    </CompetitionProvider>
  )
}
