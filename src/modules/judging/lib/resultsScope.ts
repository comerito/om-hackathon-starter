import { CompetitionStage, STAGE_ORDER } from '../../competitions/data/entities'

/**
 * When a competition's ranking becomes visible to portal (customer) callers.
 *
 * The portal results page already draws this line — it renders "Results will be available
 * after the judging phase" for anything before `finished`. Keeping the rule here, as a pure
 * predicate, is what stops the page and the API behind it from disagreeing (the export
 * endpoint used to serve the full ranking while the page told the same user it was not
 * published yet).
 *
 * Expressed as a position in `STAGE_ORDER` rather than a literal `['finished', 'archived']`
 * list so that a stage added after `finished` is published by default, and an unknown or
 * malformed stage fails closed.
 */
const PUBLISHED_FROM_INDEX = STAGE_ORDER.indexOf(CompetitionStage.FINISHED)

export function areResultsPublished(stage: string | null | undefined): boolean {
  if (!stage) return false
  const index = STAGE_ORDER.indexOf(stage as CompetitionStage)
  if (index === -1) return false
  return index >= PUBLISHED_FROM_INDEX
}

export const RESULTS_NOT_PUBLISHED_MESSAGE = 'Results have not been published for this competition yet'
