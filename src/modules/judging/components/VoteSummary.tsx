"use client"
import * as React from 'react'
import { AlertCircle, Check, Loader2, UserX } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { STAR_SCALE, type RankPlace, type ScoreSummary } from '../lib/scoring'
import { formatWeightedAverage } from '../lib/votingQueue'
import { formatPoints } from '../lib/voteForm'

export type VoteSaveState = 'idle' | 'saving' | 'saved' | 'error'

export type VoteSummaryProps = {
  summary: ScoreSummary
  /** Place among the judge's voted projects in the same track; `null` hides the row. */
  place: RankPlace | null
  progress: { done: number; total: number }
  saveState: VoteSaveState
  onRetry: () => void
  recused: boolean
}

function SaveIndicator({ saveState, onRetry }: { saveState: VoteSaveState; onRetry: () => void }) {
  const t = useT()
  return (
    <div className="flex min-h-8 items-center gap-2 text-xs font-medium" role="status" aria-live="polite" data-save-state={saveState}>
      {saveState === 'saving' ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t('judging.portal.vote.saving', 'Saving…')}
        </span>
      ) : null}
      {saveState === 'saved' ? (
        <span className="inline-flex items-center gap-1 text-status-success-text">
          <Check className="size-3.5 text-status-success-icon" aria-hidden="true" />
          {t('judging.portal.vote.saved', 'Saved')}
        </span>
      ) : null}
      {saveState === 'error' ? (
        <>
          <span className="inline-flex items-center gap-1 text-status-error-text">
            <AlertCircle className="size-3.5 text-status-error-icon" aria-hidden="true" />
            {t('judging.portal.vote.notSaved', 'Not saved')}
          </span>
          <Button type="button" variant="destructive-outline" size="2xs" onClick={onRetry}>
            {t('judging.portal.vote.retry', 'Retry')}
          </Button>
        </>
      ) : null}
    </div>
  )
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="truncate text-[11px] uppercase tracking-wide text-muted-foreground lg:text-xs">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums lg:text-base">{value}</dd>
    </div>
  )
}

/**
 * Live summary of the judge's vote (SPEC-007 phase 2), recalculated on every click by the page.
 *
 * A compact bar fixed to the bottom of the viewport on mobile — the page must leave bottom
 * padding (about `pb-40`) so the last card is not covered — and a sticky side card from `lg:`.
 */
export function VoteSummary({ summary, place, progress, saveState, onRetry, recused }: VoteSummaryProps) {
  const t = useT()
  const outOf = (value: string, max: string) => t('judging.portal.vote.outOf', '{value} / {max}', { value, max })
  const average = formatWeightedAverage(summary.weightedAverage10)

  return (
    <aside
      aria-label={t('judging.portal.vote.summaryTitle', 'Your vote')}
      data-testid="vote-summary"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-24 lg:z-auto lg:rounded-xl lg:border lg:bg-card lg:p-4 lg:shadow-none lg:backdrop-blur-none"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-1.5 lg:max-w-none lg:gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('judging.portal.vote.summaryTitle', 'Your vote')}
          </h2>
          <SaveIndicator saveState={saveState} onRetry={onRetry} />
        </div>

        {recused ? (
          <div
            className="flex items-start gap-2 rounded-lg border border-status-neutral-border bg-status-neutral-bg px-3 py-2 text-sm text-status-neutral-text"
            data-testid="vote-summary-recused"
          >
            <UserX className="mt-0.5 size-4 shrink-0 text-status-neutral-icon" aria-hidden="true" />
            <div>
              <p className="font-semibold">{t('judging.portal.vote.recused', 'Recused')}</p>
              <p className="hidden text-xs lg:block">
                {t('judging.portal.vote.recusedDesc', 'Your stars are kept but not counted while you are recused.')}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 lg:flex-col lg:items-stretch">
            <div
              className="shrink-0 rounded-lg bg-muted/40 px-3 py-1.5 lg:px-4 lg:py-3"
              data-testid="vote-summary-average"
            >
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground lg:text-xs">
                {t('judging.portal.vote.weightedAverage', 'Weighted average')}
              </p>
              <p className="tabular-nums">
                <span className="text-2xl font-bold leading-tight lg:text-4xl">{average ?? '–'}</span>
                <span className="text-sm text-muted-foreground lg:text-base"> / {STAR_SCALE}</span>
              </p>
            </div>
            <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4 lg:grid-cols-2 lg:gap-y-3">
              <Stat
                testId="vote-summary-rated"
                label={t('judging.portal.vote.ratedCriteria', 'Rated criteria')}
                value={outOf(String(summary.ratedCount), String(summary.criteriaCount))}
              />
              <Stat
                testId="vote-summary-star-sum"
                label={t('judging.portal.vote.starSum', 'Star sum')}
                value={outOf(formatPoints(summary.starSum), String(summary.criteriaCount * STAR_SCALE))}
              />
              {place ? (
                <Stat
                  testId="vote-summary-place"
                  label={t('judging.portal.vote.place', 'Place')}
                  value={t('judging.portal.vote.placeValue', '{place} of {of}', { place: place.place, of: place.of })}
                />
              ) : null}
              <Stat
                testId="vote-summary-progress"
                label={t('judging.portal.vote.progress', 'Queue progress')}
                value={t('judging.portal.vote.progressValue', '{done} / {total} done', { done: progress.done, total: progress.total })}
              />
            </dl>
          </div>
        )}
      </div>
    </aside>
  )
}
