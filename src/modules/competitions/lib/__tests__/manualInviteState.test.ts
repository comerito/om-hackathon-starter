import {
  canSubmitManualInvite,
  createManualInviteState,
  manualInviteReducer,
  type ManualInviteAction,
  type ManualInviteState,
} from '../manualInviteState'
import type { InviteResult } from '../inviteOutcome'

const sent = (email: string): InviteResult => ({ email, status: 'sent', invitationCreated: true })

const created = (email: string): InviteResult => ({
  email,
  status: 'created',
  invitationCreated: true,
  emailError: 'RESEND_API_KEY is not set',
})

const existingUser = (email: string): InviteResult => ({
  email,
  status: 'skipped',
  invitationCreated: false,
  reasonCode: 'user_already_exists',
  reason: 'This email already has a portal account',
})

const failed = (email: string): InviteResult => ({
  email,
  status: 'error',
  invitationCreated: false,
  reason: 'Request failed',
})

function run(state: ManualInviteState, ...actions: ManualInviteAction[]): ManualInviteState {
  return actions.reduce(manualInviteReducer, state)
}

/** A filled-in form ready to submit. */
function filled(email = 'ada@example.com'): ManualInviteState {
  return run(
    createManualInviteState(),
    { type: 'setField', field: 'email', value: email },
    { type: 'setField', field: 'displayName', value: 'Ada Lovelace' },
  )
}

describe('manualInviteReducer — submit lifecycle', () => {
  it('starts idle and submittable', () => {
    const state = createManualInviteState()
    expect(state.phase).toBe('form')
    expect(state.result).toBeNull()
    expect(canSubmitManualInvite(state)).toBe(true)
  })

  it('blocks submitting while a request is in flight', () => {
    const sending = run(filled(), { type: 'submitStarted' })
    expect(sending.phase).toBe('sending')
    expect(canSubmitManualInvite(sending)).toBe(false)
    // A second click must not restart the request.
    expect(run(sending, { type: 'submitStarted' })).toBe(sending)
  })

  it('is the regression case for issue #94: every terminal action leaves `sending`', () => {
    // The old dialog cleared `sending` only on the happy path, so a rejected request (401,
    // 403 or a transport error — `apiCall` THROWS for those) left the submit button disabled
    // forever and the next invite silently did nothing until the page was reloaded.
    for (const outcome of [sent, created, existingUser, failed]) {
      const settled = run(
        filled(),
        { type: 'submitStarted' },
        { type: 'submitSettled', result: outcome('ada@example.com') },
      )
      expect(settled.phase).toBe('result')
      expect(settled.result).not.toBeNull()
    }
  })

  it('keeps the outcome shape intact for the partial-success and existing-user views', () => {
    const partial = run(filled(), { type: 'submitStarted' }, { type: 'submitSettled', result: created('ada@example.com') })
    expect(partial.result).toEqual(created('ada@example.com'))

    const skipped = run(filled(), { type: 'submitStarted' }, { type: 'submitSettled', result: existingUser('ada@example.com') })
    expect(skipped.result?.status).toBe('skipped')
    expect(skipped.result?.reasonCode).toBe('user_already_exists')
  })
})

describe('manualInviteReducer — repeatability', () => {
  it('returns a blank, submittable form after an outcome is dismissed', () => {
    const settled = run(filled(), { type: 'submitStarted' }, { type: 'submitSettled', result: sent('ada@example.com') })
    const next = run(settled, { type: 'resetForNextInvite' })

    expect(next.phase).toBe('form')
    expect(next.result).toBeNull()
    expect(next.error).toBeNull()
    expect(next.email).toBe('')
    expect(next.displayName).toBe('')
    expect(canSubmitManualInvite(next)).toBe(true)
  })

  it('carries the role over to the next invite but never the previous outcome', () => {
    const settled = run(
      filled(),
      { type: 'setField', field: 'role', value: 'mentor' },
      { type: 'submitStarted' },
      { type: 'submitSettled', result: existingUser('ada@example.com') },
    )
    const next = run(settled, { type: 'resetForNextInvite' })

    expect(next.role).toBe('mentor')
    expect(next.result).toBeNull()
  })

  it('supports two invites in a row with no remount', () => {
    const first = run(filled('ada@example.com'), { type: 'submitStarted' }, { type: 'submitSettled', result: sent('ada@example.com') })
    const second = run(
      first,
      { type: 'resetForNextInvite' },
      { type: 'setField', field: 'email', value: 'grace@example.com' },
      { type: 'setField', field: 'displayName', value: 'Grace Hopper' },
      { type: 'submitStarted' },
      { type: 'submitSettled', result: sent('grace@example.com') },
    )

    expect(second.result?.email).toBe('grace@example.com')
  })

  it('discards a response that lands after the dialog was reset', () => {
    // Otherwise the previous person's outcome could pop up over a fresh form.
    const inFlight = run(filled(), { type: 'submitStarted' })
    const reset = run(inFlight, { type: 'resetForNextInvite' })
    const late = run(reset, { type: 'submitSettled', result: sent('ada@example.com') })

    expect(late).toBe(reset)
    expect(late.result).toBeNull()
  })
})

describe('manualInviteReducer — validation', () => {
  it('keeps the form visible and shows why, without inventing a result', () => {
    const invalid = run(createManualInviteState(), { type: 'validationFailed', message: 'Please enter a valid email address' })
    expect(invalid.phase).toBe('form')
    expect(invalid.error).toBe('Please enter a valid email address')
    expect(invalid.result).toBeNull()
  })

  it('clears a stale validation error when the next submit starts', () => {
    const retried = run(
      filled(),
      { type: 'validationFailed', message: 'Please select a competition' },
      { type: 'submitStarted' },
    )
    expect(retried.error).toBeNull()
  })

  it('ignores field edits while a request is in flight', () => {
    const sending = run(filled(), { type: 'submitStarted' })
    expect(run(sending, { type: 'setField', field: 'email', value: 'someone-else@example.com' })).toBe(sending)
  })
})
