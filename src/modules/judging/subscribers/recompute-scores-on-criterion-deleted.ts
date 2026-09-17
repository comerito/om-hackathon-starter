import type { CriterionChangePayload } from '../lib/criteriaRecompute'
import { handleCriterionChangeEvent, type SubscriberContext } from '../lib/criteriaRecomputeStore'

// SPEC-007 step 7b. One event per subscriber file: the generated registry and the persistent
// events worker match a subscriber by its exact event id.
export const metadata = {
  event: 'judging.criterion.deleted',
  persistent: true,
  id: 'judging:recompute-scores-on-criterion-deleted',
}

export default async function handler(payload: CriterionChangePayload, ctx: SubscriberContext) {
  await handleCriterionChangeEvent(metadata.event, metadata.id, payload, ctx)
}
