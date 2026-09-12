/**
 * Lifecycle state for the single-invite ("Invite") dialog.
 *
 * Kept out of the component and dependency-free so the state machine can be unit-tested
 * without a DOM. The dialog previously held `sending` / `result` / `error` as three loose
 * `useState` flags, which allowed two states that wedge the whole flow:
 *
 *   1. `sending === true` forever — `apiFetch` THROWS on 401/403 and on a network error, and
 *      the submit handler cleared the flag only on the happy path. Once stuck, the submit
 *      button stays `disabled` and Cmd+Enter is gated off, so invites silently do nothing
 *      until the page is reloaded.
 *   2. `result !== null` with no way back to the form — the result view replaced the form and
 *      the only exit was unmounting the dialog. Re-clicking the toolbar "Invite" button is a
 *      no-op while the dialog is already open, so the operator saw nothing happen.
 *
 * Modelling the dialog as one explicit phase makes both states unrepresentable:
 * every terminal action leaves `phase` as `form` or `result`, never `sending`.
 */

import type { InviteResult } from './inviteOutcome'

/** The three views the dialog can show. Exactly one is renderable at any time. */
export type ManualInvitePhase = 'form' | 'sending' | 'result'

export type ManualInviteState = {
  phase: ManualInvitePhase
  email: string
  displayName: string
  role: string
  /** Inline validation / transport message shown inside the form. Never set in `result`. */
  error: string | null
  /** Outcome of the last completed submit. Non-null exactly when `phase === 'result'`. */
  result: InviteResult | null
}

export type ManualInviteField = 'email' | 'displayName' | 'role'

export type ManualInviteAction =
  | { type: 'setField'; field: ManualInviteField; value: string }
  /** Local validation rejected the form; stay on it and show why. */
  | { type: 'validationFailed'; message: string }
  /** Request is going out. Ignored unless the form is idle, so a double click cannot re-send. */
  | { type: 'submitStarted' }
  /** Request finished — success, partial success, skip or failure all land here. */
  | { type: 'submitSettled'; result: InviteResult }
  /** Dismiss the outcome and offer a blank form for the next person. */
  | { type: 'resetForNextInvite' }

export const DEFAULT_INVITE_ROLE = 'participant'

export function createManualInviteState(role: string = DEFAULT_INVITE_ROLE): ManualInviteState {
  return { phase: 'form', email: '', displayName: '', role, error: null, result: null }
}

export const initialManualInviteState: ManualInviteState = createManualInviteState()

export function manualInviteReducer(
  state: ManualInviteState,
  action: ManualInviteAction,
): ManualInviteState {
  switch (action.type) {
    case 'setField':
      // Fields are only editable on the form; ignore stray edits from other phases.
      if (state.phase !== 'form') return state
      return { ...state, [action.field]: action.value }

    case 'validationFailed':
      if (state.phase !== 'form') return state
      return { ...state, error: action.message, result: null }

    case 'submitStarted':
      // Only an idle form can start a request. This is the single-flight guard: while a
      // request is in flight another `submitStarted` cannot stack a second one.
      if (state.phase !== 'form') return state
      return { ...state, phase: 'sending', error: null, result: null }

    case 'submitSettled':
      // Only the in-flight request may write a result. A response that lands after the
      // operator already reset the dialog is discarded, so a previous person's outcome can
      // never surface on top of the next invite.
      if (state.phase !== 'sending') return state
      return { ...state, phase: 'result', error: null, result: action.result }

    case 'resetForNextInvite':
      // Discard the outcome and the person-specific fields; keep the role, because inviting
      // several people in the same role in a row is the common case.
      return createManualInviteState(state.role)

    default:
      return state
  }
}

/** True when the dialog is idle and a submit may be started (button enabled, Cmd+Enter armed). */
export function canSubmitManualInvite(state: ManualInviteState): boolean {
  return state.phase === 'form'
}
