import {
  applyEmailOutcomes,
  formatEmailError,
  summarizeInviteResults,
  INVITE_SKIP_REASONS,
  INVITE_SKIP_REASON_KEYS,
  type InviteResult,
} from '../inviteOutcome'

const sent = (email: string): InviteResult => ({ email, status: 'sent', invitationCreated: true })

const existingUser = (email: string): InviteResult => ({
  email,
  status: 'skipped',
  invitationCreated: false,
  reasonCode: 'user_already_exists',
  reason: INVITE_SKIP_REASONS.user_already_exists,
})

describe('formatEmailError', () => {
  it('unwraps an Error message', () => {
    expect(formatEmailError(new Error('RESEND_API_KEY is not set'))).toBe('RESEND_API_KEY is not set')
  })

  it('passes a plain string through', () => {
    expect(formatEmailError('boom')).toBe('boom')
  })

  it('reads a message property off a plain object', () => {
    expect(formatEmailError({ message: 'rate limited' })).toBe('rate limited')
  })

  it('never yields an empty string', () => {
    expect(formatEmailError(null)).toBe('Unknown email delivery error')
    expect(formatEmailError(new Error(''))).toBe('Unknown email delivery error')
  })
})

describe('applyEmailOutcomes', () => {
  it('is the regression case for issue #92: a failed email does NOT become an error', () => {
    const results = [sent('a@example.com')]
    const [row] = applyEmailOutcomes(results, [
      { email: 'a@example.com', ok: false, error: new Error('RESEND_API_KEY is not set') },
    ])

    expect(row.status).toBe('created')
    expect(row.status).not.toBe('error')
    // The row is committed, so the operator must be told the person IS invited.
    expect(row.invitationCreated).toBe(true)
    expect(row.emailError).toBe('RESEND_API_KEY is not set')
    // The email failure must not leak into `reason`, which describes creation only.
    expect(row.reason).toBeUndefined()
  })

  it('keeps successfully emailed rows as sent', () => {
    const [row] = applyEmailOutcomes([sent('a@example.com')], [{ email: 'a@example.com', ok: true }])
    expect(row.status).toBe('sent')
    expect(row.emailError).toBeUndefined()
  })

  it('does not mutate the input array', () => {
    const results = [sent('a@example.com')]
    applyEmailOutcomes(results, [{ email: 'a@example.com', ok: false, error: 'nope' }])
    expect(results[0].status).toBe('sent')
  })

  it('leaves skipped and errored rows untouched', () => {
    const results: InviteResult[] = [
      { email: 'skip@example.com', status: 'skipped', invitationCreated: false, reason: 'User already exists' },
      { email: 'bad@example.com', status: 'error', invitationCreated: false, reason: 'Role missing' },
    ]
    const out = applyEmailOutcomes(results, [
      { email: 'skip@example.com', ok: false, error: 'should be ignored' },
      { email: 'bad@example.com', ok: false, error: 'should be ignored' },
    ])
    expect(out.map((r) => r.status)).toEqual(['skipped', 'error'])
    expect(out.every((r) => r.emailError === undefined)).toBe(true)
  })

  it('downgrades only the rows whose email actually failed', () => {
    const out = applyEmailOutcomes(
      [sent('a@example.com'), sent('b@example.com')],
      [
        { email: 'a@example.com', ok: false, error: new Error('boom') },
        { email: 'b@example.com', ok: true },
      ],
    )
    expect(out.map((r) => r.status)).toEqual(['created', 'sent'])
  })
})

describe('summarizeInviteResults', () => {
  it('reports creation and delivery as two independent outcomes', () => {
    const results = applyEmailOutcomes(
      [
        sent('a@example.com'),
        sent('b@example.com'),
        { email: 'c@example.com', status: 'skipped', invitationCreated: false, reason: 'User already exists' },
        { email: 'd@example.com', status: 'error', invitationCreated: false, reason: 'Role missing' },
      ],
      [
        { email: 'a@example.com', ok: true },
        { email: 'b@example.com', ok: false, error: new Error('RESEND_API_KEY is not set') },
      ],
    )

    expect(summarizeInviteResults(results)).toEqual({
      total: 4,
      sent: 1,
      created: 1,
      skipped: 1,
      failed: 1,
      invitationsCreated: 2,
      existingUsers: [],
      errors: [{ email: 'd@example.com', reason: 'Role missing' }],
      emailFailures: [{ email: 'b@example.com', reason: 'RESEND_API_KEY is not set' }],
    })
  })

  it('does not count an email failure as an error', () => {
    const results = applyEmailOutcomes(
      [sent('a@example.com')],
      [{ email: 'a@example.com', ok: false, error: new Error('RESEND_API_KEY is not set') }],
    )
    const summary = summarizeInviteResults(results)
    expect(summary.failed).toBe(0)
    expect(summary.errors).toHaveLength(0)
    expect(summary.invitationsCreated).toBe(1)
  })
})

describe('issue #93: an email that already has a CustomerUser', () => {
  it('is a skip, never a created invitation', () => {
    const row = existingUser('alice.johnson@example.com')
    expect(row.status).toBe('skipped')
    expect(row.invitationCreated).toBe(false)
    expect(row.reasonCode).toBe('user_already_exists')
  })

  it('is bucketed by reasonCode, so the UI never matches on English prose', () => {
    const summary = summarizeInviteResults([
      sent('new@example.com'),
      existingUser('alice.johnson@example.com'),
      {
        email: 'pending@example.com',
        status: 'skipped',
        invitationCreated: false,
        reasonCode: 'invitation_already_pending',
        reason: INVITE_SKIP_REASONS.invitation_already_pending,
      },
    ])

    expect(summary.existingUsers).toEqual(['alice.johnson@example.com'])
    // A pending invitation is a different skip: that person IS invited already.
    expect(summary.skipped).toBe(2)
    expect(summary.invitationsCreated).toBe(1)
    expect(summary.errors).toHaveLength(0)
  })

  it('reports no existing users when nothing was skipped for that cause', () => {
    expect(summarizeInviteResults([sent('a@example.com')]).existingUsers).toEqual([])
  })

  it('survives applyEmailOutcomes unchanged — no row exists to email', () => {
    const [row] = applyEmailOutcomes(
      [existingUser('alice.johnson@example.com')],
      [{ email: 'alice.johnson@example.com', ok: false, error: new Error('RESEND_API_KEY is not set') }],
    )
    expect(row.status).toBe('skipped')
    expect(row.reasonCode).toBe('user_already_exists')
    expect(row.emailError).toBeUndefined()
  })

  it('has a translation key and an English default for every skip cause', () => {
    for (const code of Object.keys(INVITE_SKIP_REASONS) as Array<keyof typeof INVITE_SKIP_REASONS>) {
      expect(INVITE_SKIP_REASON_KEYS[code]).toMatch(/^competitions\.invite\.skip\./)
      expect(INVITE_SKIP_REASONS[code].length).toBeGreaterThan(0)
    }
  })
})
