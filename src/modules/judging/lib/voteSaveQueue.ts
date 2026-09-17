/**
 * Save queue of the judge's star voting page (SPEC-007 phase 2, UI/UX "Save behavior").
 *
 * Pure reducer so the ordering rules are unit-tested without React:
 *
 * - at most one request is in flight; everything changed meanwhile is merged into `pending` and
 *   sent as the next request;
 * - a star click asks for an immediate flush, typed text waits for the page's debounce timer (or
 *   blur) to dispatch `flush`;
 * - a failed request folds its patch back under `pending` (newer edits win) and stops until the
 *   judge retries or makes another change that flushes;
 * - `409 Voting is closed` closes the queue for good: nothing is sent any more.
 */

export type CriterionPatch = { stars?: number; note?: string | null }

/** Partial vote update: omitted fields are left unchanged by the server. */
export type VotePatch = {
  criteria: Record<string, CriterionPatch>
  comment?: string | null
  private_notes?: string | null
  conflict_of_interest?: boolean
}

export type SaveQueueState = {
  /** Changes not yet sent. */
  pending: VotePatch
  /** The patch of the request currently in flight, `null` when idle. */
  inFlight: VotePatch | null
  /** A flush was requested for `pending` (star click, debounce elapsed, blur, retry). */
  flushRequested: boolean
  /** Outcome of the last finished request. */
  lastResult: 'none' | 'saved' | 'error'
  /** Voting is closed (409 or `voting_open === false`): nothing is sent any more. */
  closed: boolean
}

export type SaveQueueAction =
  | { type: 'change'; patch: VotePatch; immediate: boolean }
  | { type: 'flush' }
  | { type: 'retry' }
  /** The page began sending `patch` (the value `nextRequest` returned when it rendered). */
  | { type: 'start'; patch: VotePatch }
  | { type: 'success' }
  | { type: 'failure'; closed: boolean }
  | { type: 'close' }

export const EMPTY_PATCH: VotePatch = { criteria: {} }

export const INITIAL_SAVE_QUEUE: SaveQueueState = {
  pending: EMPTY_PATCH,
  inFlight: null,
  flushRequested: false,
  lastResult: 'none',
  closed: false,
}

export function isEmptyPatch(patch: VotePatch): boolean {
  return Object.keys(patch.criteria).length === 0
    && patch.comment === undefined
    && patch.private_notes === undefined
    && patch.conflict_of_interest === undefined
}

/** `next` applied on top of `base`: per criterion and per field, the defined values of `next` win. */
export function mergePatch(base: VotePatch, next: VotePatch): VotePatch {
  const criteria: Record<string, CriterionPatch> = { ...base.criteria }
  for (const [criterionId, change] of Object.entries(next.criteria)) {
    const merged: CriterionPatch = { ...(criteria[criterionId] ?? {}) }
    if (change.stars !== undefined) merged.stars = change.stars
    if (change.note !== undefined) merged.note = change.note
    criteria[criterionId] = merged
  }
  const result: VotePatch = { criteria }
  const comment = next.comment !== undefined ? next.comment : base.comment
  const privateNotes = next.private_notes !== undefined ? next.private_notes : base.private_notes
  const conflict = next.conflict_of_interest !== undefined ? next.conflict_of_interest : base.conflict_of_interest
  if (comment !== undefined) result.comment = comment
  if (privateNotes !== undefined) result.private_notes = privateNotes
  if (conflict !== undefined) result.conflict_of_interest = conflict
  return result
}

export function saveQueueReducer(state: SaveQueueState, action: SaveQueueAction): SaveQueueState {
  switch (action.type) {
    case 'change': {
      if (state.closed) return state
      return {
        ...state,
        pending: mergePatch(state.pending, action.patch),
        flushRequested: state.flushRequested || action.immediate,
      }
    }
    case 'flush':
    case 'retry': {
      if (state.closed || isEmptyPatch(state.pending)) return state
      return { ...state, flushRequested: true }
    }
    case 'start': {
      if (state.closed || state.inFlight !== null) return state
      if (action.patch === state.pending) {
        return { ...state, inFlight: action.patch, pending: EMPTY_PATCH, flushRequested: false }
      }
      // Changes arrived between computing the request and sending it: keep the whole pending patch
      // (it already contains the sent values) so it is resent right after this request finishes.
      return { ...state, inFlight: action.patch }
    }
    case 'success': {
      if (state.inFlight === null) return state
      return { ...state, inFlight: null, lastResult: 'saved' }
    }
    case 'failure': {
      const pending = state.inFlight ? mergePatch(state.inFlight, state.pending) : state.pending
      return {
        ...state,
        pending,
        inFlight: null,
        flushRequested: false,
        lastResult: 'error',
        closed: state.closed || action.closed,
      }
    }
    case 'close':
      return state.closed ? state : { ...state, closed: true, flushRequested: false }
    default:
      return state
  }
}

/** The patch to send now, or `null` when nothing should be sent yet. */
export function nextRequest(state: SaveQueueState): VotePatch | null {
  if (state.closed || state.inFlight !== null || !state.flushRequested) return null
  return isEmptyPatch(state.pending) ? null : state.pending
}

/** Whether leaving the page would lose changes that can still be saved. */
export function hasUnsavedChanges(state: SaveQueueState): boolean {
  if (state.closed) return false
  return state.inFlight !== null || !isEmptyPatch(state.pending)
}

/**
 * The patch to send when the page is left (unmount), or `null` when there is nothing to save.
 * It includes the in-flight patch: if that request fails, its values are not lost, and resending
 * values that did land is harmless because the POST is a per-field upsert.
 */
export function leaveRequest(state: SaveQueueState): VotePatch | null {
  if (state.closed || isEmptyPatch(state.pending)) return null
  return mergePatch(state.inFlight ?? EMPTY_PATCH, state.pending)
}

/** How a save request ended, as the hook's in-flight promise resolves it. */
export type SaveOutcome = 'saved' | 'failed' | 'closed'

/**
 * Sends the leave request only after the request still in flight settles, so an older request
 * landing last cannot overwrite the newer values. With nothing in flight it sends right away
 * (synchronously, before the page is gone). Skipped when the in-flight request reported voting
 * closed; `send` failures are swallowed (best effort).
 */
export function sendAfterInFlight(
  inFlight: Promise<SaveOutcome> | null,
  send: () => Promise<unknown>,
): Promise<void> {
  const sendSafely = async (): Promise<void> => {
    try {
      await send()
    } catch {
      // best effort: the page is already gone, there is nobody to report to
    }
  }
  if (inFlight === null) return sendSafely()
  return inFlight.then(
    (outcome) => (outcome === 'closed' ? undefined : sendSafely()),
    () => sendSafely(),
  )
}

export type SaveIndicatorState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * What the save indicator shows: an error until the pending changes are sent again, "Saving…" while
 * a request is in flight or changes are queued, otherwise the outcome of the last request.
 */
export function saveIndicatorState(state: SaveQueueState): SaveIndicatorState {
  if (state.closed) return state.lastResult === 'saved' && isEmptyPatch(state.pending) ? 'saved' : 'idle'
  if (state.inFlight !== null) return 'saving'
  if (state.lastResult === 'error') return 'error'
  if (!isEmptyPatch(state.pending)) return 'saving'
  return state.lastResult === 'saved' ? 'saved' : 'idle'
}

export type PortalVoteRequestFields = {
  criterion_scores?: Array<{ criterion_id: string; stars?: number; note?: string | null }>
  comment?: string | null
  private_notes?: string | null
  conflict_of_interest?: boolean
}

/** The patch as the `POST /api/judging/portal/score-project` body fields (omitted = unchanged). */
export function patchToRequestFields(patch: VotePatch): PortalVoteRequestFields {
  const fields: PortalVoteRequestFields = {}
  const criterionScores = Object.entries(patch.criteria)
    .filter(([, change]) => change.stars !== undefined || change.note !== undefined)
    .map(([criterionId, change]) => ({
      criterion_id: criterionId,
      ...(change.stars !== undefined ? { stars: change.stars } : {}),
      ...(change.note !== undefined ? { note: change.note } : {}),
    }))
  if (criterionScores.length > 0) fields.criterion_scores = criterionScores
  if (patch.comment !== undefined) fields.comment = patch.comment
  if (patch.private_notes !== undefined) fields.private_notes = patch.private_notes
  if (patch.conflict_of_interest !== undefined) fields.conflict_of_interest = patch.conflict_of_interest
  return fields
}
