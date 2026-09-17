"use client"
import * as React from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Rating } from '@open-mercato/ui/primitives/rating'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { STAR_SCALE, starsToPoints } from '../lib/scoring'
import { clampStars, formatPoints, formatWeightPercent, type VoteFormCriterion } from '../lib/voteForm'

export type StarCriterionCardProps = {
  criterion: Pick<VoteFormCriterion, 'id' | 'name' | 'description' | 'max_score' | 'weight'>
  /** Stars shown (1…10), `null` = not rated. */
  stars: number | null
  /** A submitted legacy `0`: empty stars with the "0 pts (earlier scale)" hint. */
  legacyZero?: boolean
  /** The stars come from a legacy row converted for display: adds a small "earlier scale" hint. */
  legacy?: boolean
  note: string
  onStarsChange: (stars: number) => void
  onNoteChange: (note: string) => void
  /** Optional hook so the page can save the note right away when the field loses focus. */
  onNoteBlur?: () => void
  disabled?: boolean
}

/**
 * One criterion on the judge's voting page (SPEC-007 phase 2): a 1–10 star rating with the value
 * converted to the criterion's own points, plus a note that stays collapsed until it is used.
 * When `disabled` (voting closed) an existing note is shown read-only and "Add note" is hidden.
 *
 * Presentational only — the page owns the state and the save queue.
 */
export function StarCriterionCard({
  criterion, stars, legacyZero = false, legacy = false, note, onStarsChange, onNoteChange, onNoteBlur, disabled = false,
}: StarCriterionCardProps) {
  const t = useT()
  const hasNote = note.trim().length > 0
  const [noteOpen, setNoteOpen] = React.useState(hasNote)
  const showNote = noteOpen || hasNote
  const noteId = `judging-vote-note-${criterion.id}`
  const noteRef = React.useRef<HTMLTextAreaElement | null>(null)

  const description = criterion.description?.trim() ?? ''
  const unit = t('judging.portal.vote.pointsUnit', 'pts')

  const handleOpenNote = React.useCallback(() => {
    setNoteOpen(true)
    // Focus once the textarea is mounted.
    window.requestAnimationFrame(() => noteRef.current?.focus())
  }, [])

  return (
    <article
      className="space-y-3 rounded-xl border bg-card p-4"
      data-testid="star-criterion-card"
      data-criterion-id={criterion.id}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5">{criterion.name}</h3>
          {description ? (
            <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {t('judging.portal.vote.weight', 'Weight {percent}%', { percent: formatWeightPercent(criterion.weight) })}
        </span>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Rating
          value={stars ?? 0}
          max={STAR_SCALE}
          onChange={(next) => onStarsChange(clampStars(next))}
          disabled={disabled}
          aria-label={t('judging.portal.vote.starsAria', '{criterion}: rating from 1 to 10 stars', { criterion: criterion.name })}
          className="grid w-fit grid-cols-5 gap-1 sm:inline-flex sm:gap-0.5 [&>*]:size-11 sm:[&>*]:size-10 [&_svg]:size-7 sm:[&_svg]:size-6"
        />
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm" aria-live="polite">
          {stars !== null ? (
            <>
              <span className="font-semibold tabular-nums">
                {t('judging.portal.vote.starsValue', '{stars}/{max}', { stars, max: STAR_SCALE })}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {t('judging.portal.vote.convertedPoints', '→ {points} / {max} {unit}', {
                  points: formatPoints(starsToPoints(stars, STAR_SCALE, criterion.max_score)),
                  max: formatPoints(criterion.max_score),
                  unit,
                })}
              </span>
              {legacy ? (
                <span className="text-xs text-status-warning-text">
                  ({t('judging.portal.vote.earlierScale', 'earlier scale')})
                </span>
              ) : null}
            </>
          ) : legacyZero ? (
            <span className="text-xs font-medium text-status-warning-text">
              {t('judging.portal.vote.legacyZero', '0 pts (earlier scale)')}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('judging.portal.vote.notRated', 'Not rated')}</span>
          )}
        </div>
      </div>

      {showNote ? (
        <div className="space-y-1.5">
          <label htmlFor={noteId} className="text-xs font-medium text-muted-foreground">
            {t('judging.portal.vote.noteLabel', 'Note for this criterion')}
          </label>
          <Textarea
            ref={noteRef}
            id={noteId}
            value={note}
            rows={2}
            disabled={disabled}
            onChange={(event) => onNoteChange(event.target.value)}
            onBlur={() => {
              if (!note.trim()) setNoteOpen(false)
              onNoteBlur?.()
            }}
            className="min-h-[64px]"
          />
        </div>
      ) : disabled ? null : (
        <Button
          type="button"
          variant="muted"
          size="sm"
          className="-ml-2"
          onClick={handleOpenNote}
        >
          <MessageSquarePlus className="size-4" aria-hidden="true" />
          {t('judging.portal.vote.addNote', 'Add note')}
        </Button>
      )}
    </article>
  )
}
