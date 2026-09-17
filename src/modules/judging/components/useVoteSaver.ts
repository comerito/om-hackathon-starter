"use client"
import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import {
  INITIAL_SAVE_QUEUE,
  hasUnsavedChanges,
  isEmptyPatch,
  leaveRequest,
  nextRequest,
  patchToRequestFields,
  saveIndicatorState,
  saveQueueReducer,
  sendAfterInFlight,
  type SaveIndicatorState,
  type SaveOutcome,
  type VotePatch,
} from '../lib/voteSaveQueue'

/** Typed text (notes, feedback, private notes) is saved this long after typing stops. */
export const TEXT_SAVE_DEBOUNCE_MS = 800

const SAVE_URL = '/api/judging/portal/score-project'

export type SaveVoteResponse = {
  ok: boolean
  score_id: string
  rated_count: number
  criteria_count: number
  is_voted: boolean
  weighted_average: number | null
  total_score: number | null
}

export type UseVoteSaverOptions = {
  projectId: string
  competitionId: string
  round: 'preliminary'
  /** `voting_open === false` from the API: the saver never sends anything. */
  votingClosed: boolean
  onSaved?: (result: SaveVoteResponse | null) => void
}

export type UseVoteSaver = {
  saveState: SaveIndicatorState
  /** Voting closed, either reported up front or by a `409` on save. */
  closed: boolean
  unsaved: boolean
  /** Voting closed while changes were still queued: they will never be saved. */
  lostChanges: boolean
  /** Queues a change; `immediate` sends it now (stars, recusal), otherwise after the debounce. */
  change: (patch: VotePatch, options: { immediate: boolean }) => void
  /** Sends queued text right away (blur). */
  flush: () => void
  retry: () => void
}

/**
 * Autosave for the judge voting page (SPEC-007 phase 2): one request in flight, changes merged
 * while it runs, retry after failures, read-only after `409 Voting is closed`. The ordering rules
 * live in the pure `saveQueueReducer`; this hook only wires timers, the request and `beforeunload`.
 */
export function useVoteSaver({ projectId, competitionId, round, votingClosed, onSaved }: UseVoteSaverOptions): UseVoteSaver {
  const [state, dispatch] = React.useReducer(saveQueueReducer, INITIAL_SAVE_QUEUE)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSavedRef = React.useRef(onSaved)
  const stateRef = React.useRef(state)
  const requestTargetRef = React.useRef({ projectId, competitionId, round })
  /** The save request still running, if any; it keeps running after the page unmounts. */
  const inFlightRef = React.useRef<Promise<SaveOutcome> | null>(null)

  React.useEffect(() => {
    onSavedRef.current = onSaved
    stateRef.current = state
    requestTargetRef.current = { projectId, competitionId, round }
  })

  React.useEffect(() => {
    if (votingClosed) dispatch({ type: 'close' })
  }, [votingClosed])

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const request = nextRequest(state)
  React.useEffect(() => {
    if (request === null) return
    dispatch({ type: 'start', patch: request })
    const target = requestTargetRef.current
    const body = JSON.stringify({
      project_id: target.projectId,
      competition_id: target.competitionId,
      judge_panel_id: 'auto',
      round: target.round,
      ...patchToRequestFields(request),
    })
    const inFlight = (async (): Promise<SaveOutcome> => {
      try {
        const response = await apiCall<SaveVoteResponse>(SAVE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        })
        if (response.ok) {
          dispatch({ type: 'success' })
          onSavedRef.current?.(response.result)
          return 'saved'
        }
        const closed = response.status === 409
        dispatch({ type: 'failure', closed })
        return closed ? 'closed' : 'failed'
      } catch {
        dispatch({ type: 'failure', closed: false })
        return 'failed'
      }
    })()
    inFlightRef.current = inFlight
    void inFlight.finally(() => {
      if (inFlightRef.current === inFlight) inFlightRef.current = null
    })
  }, [request])

  const unsaved = hasUnsavedChanges(state)
  React.useEffect(() => {
    if (!unsaved) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [unsaved])

  // Leaving the page inside the app (back link, "Next in queue") would drop debounced text:
  // send whatever is still queued as a best-effort request that survives the navigation. It waits
  // for a request still in flight, otherwise that older request could land last and overwrite it.
  React.useEffect(() => () => {
    clearTimer()
    const patch = leaveRequest(stateRef.current)
    if (patch === null) return
    const target = requestTargetRef.current
    const body = JSON.stringify({
      project_id: target.projectId,
      competition_id: target.competitionId,
      judge_panel_id: 'auto',
      round: target.round,
      ...patchToRequestFields(patch),
    })
    void sendAfterInFlight(inFlightRef.current, () => apiCall<SaveVoteResponse>(SAVE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body,
    }))
  }, [clearTimer])

  const change = React.useCallback((patch: VotePatch, options: { immediate: boolean }) => {
    dispatch({ type: 'change', patch, immediate: options.immediate })
    clearTimer()
    if (!options.immediate) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        dispatch({ type: 'flush' })
      }, TEXT_SAVE_DEBOUNCE_MS)
    }
  }, [clearTimer])

  const flush = React.useCallback(() => {
    clearTimer()
    dispatch({ type: 'flush' })
  }, [clearTimer])

  const retry = React.useCallback(() => {
    clearTimer()
    dispatch({ type: 'retry' })
  }, [clearTimer])

  return {
    saveState: saveIndicatorState(state),
    closed: state.closed,
    unsaved,
    lostChanges: state.closed && !isEmptyPatch(state.pending),
    change,
    flush,
    retry,
  }
}
