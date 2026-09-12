/**
 * Outcome model for the invite flow (single "Invite" dialog and CSV bulk import).
 *
 * Creating an invitation and delivering its notification email are two INDEPENDENT
 * outcomes: the `customer_user_invitations` row is flushed (and therefore committed)
 * before any email is attempted. A failed email must not be reported as if the whole
 * operation failed — the invitee IS invited, only the link did not reach them.
 *
 * Statuses:
 *   sent    — invitation created AND the email went out.
 *   created — invitation created, email delivery failed. PARTIAL SUCCESS (warning).
 *   skipped — nothing created on purpose (user exists / invitation already pending).
 *   error   — the invitation could not be created at all. Nothing was committed.
 *
 * This module is deliberately dependency-free so it can be unit-tested in isolation.
 */

export type InviteStatus = 'sent' | 'created' | 'skipped' | 'error'

/**
 * Machine-readable cause of a `skipped` row. `reason` stays a human sentence; the UI
 * branches on this so it can render actionable guidance instead of matching on prose.
 *
 * `user_already_exists` is not a failure: the address already has a portal account, so
 * an invitation would be a dead link (accept-invite CREATES an account). The operator
 * should attach the existing account with Add Participant instead.
 */
export type InviteSkipReason = 'user_already_exists' | 'invitation_already_pending'

/** Default human text for each skip cause. Callers may override with a translated string. */
export const INVITE_SKIP_REASONS: Record<InviteSkipReason, string> = {
  user_already_exists: 'This email already has a portal account',
  invitation_already_pending: 'Invitation already pending',
}

/** Translation key per skip cause, so the UI never renders the server's English `reason`. */
export const INVITE_SKIP_REASON_KEYS: Record<InviteSkipReason, string> = {
  user_already_exists: 'competitions.invite.skip.userAlreadyExists',
  invitation_already_pending: 'competitions.invite.skip.invitationAlreadyPending',
}

export type InviteResult = {
  email: string
  status: InviteStatus
  /** True when the invitation row was created and committed, regardless of email delivery. */
  invitationCreated: boolean
  /** Set for `skipped`: why nothing was created, in a form the UI can branch on. */
  reasonCode?: InviteSkipReason
  /** Why the row was skipped, or why creating it failed. Never carries an email error. */
  reason?: string
  /** Set only for `created`: why the notification email could not be delivered. */
  emailError?: string
}

export type EmailOutcome = {
  email: string
  ok: boolean
  error?: unknown
}

export type InviteSummary = {
  total: number
  /** Created + emailed. */
  sent: number
  /** Created but the email failed — partial success. */
  created: number
  skipped: number
  /** Nothing was created for these. */
  failed: number
  /** sent + created — how many people are actually invited now. */
  invitationsCreated: number
  /**
   * Skipped because the address already has a portal account. These people cannot be
   * invited (the link would be un-acceptable) — they are added with Add Participant.
   */
  existingUsers: string[]
  /** Real failures only: no invitation exists for these. */
  errors: Array<{ email: string; reason: string }>
  /** Invited, but could not be notified. The operator must deliver the link another way. */
  emailFailures: Array<{ email: string; reason: string }>
}

const UNKNOWN_EMAIL_ERROR = 'Unknown email delivery error'

/** Flatten anything a rejected email promise can carry into one readable line. */
export function formatEmailError(error: unknown): string {
  if (error == null) return UNKNOWN_EMAIL_ERROR
  if (typeof error === 'string') return error.trim() || UNKNOWN_EMAIL_ERROR
  if (error instanceof Error) return error.message.trim() || UNKNOWN_EMAIL_ERROR
  if (typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return String(error).trim() || UNKNOWN_EMAIL_ERROR
}

/**
 * Fold email-delivery outcomes into the per-invitee results.
 *
 * A failed email downgrades `sent` -> `created` (warning). It NEVER turns a result into
 * `error`, because the invitation row is already committed by the time email is attempted.
 * Returns a new array; the input is not mutated.
 */
export function applyEmailOutcomes(results: InviteResult[], outcomes: EmailOutcome[]): InviteResult[] {
  const failures = new Map<string, string>()
  for (const outcome of outcomes) {
    if (outcome.ok) continue
    failures.set(outcome.email, formatEmailError(outcome.error))
  }
  if (failures.size === 0) return results.map((r) => ({ ...r }))

  return results.map((result) => {
    const failure = failures.get(result.email)
    // Only an invitation that actually got created can be downgraded to "created".
    if (failure === undefined || !result.invitationCreated) return { ...result }
    return { ...result, status: 'created' as const, emailError: failure }
  })
}

export function summarizeInviteResults(results: InviteResult[]): InviteSummary {
  const sent = results.filter((r) => r.status === 'sent')
  const created = results.filter((r) => r.status === 'created')
  const skipped = results.filter((r) => r.status === 'skipped')
  const failed = results.filter((r) => r.status === 'error')

  return {
    total: results.length,
    sent: sent.length,
    created: created.length,
    skipped: skipped.length,
    failed: failed.length,
    invitationsCreated: sent.length + created.length,
    existingUsers: skipped.filter((r) => r.reasonCode === 'user_already_exists').map((r) => r.email),
    errors: failed.map((r) => ({ email: r.email, reason: r.reason ?? 'Failed to create invitation' })),
    emailFailures: created.map((r) => ({ email: r.email, reason: r.emailError ?? UNKNOWN_EMAIL_ERROR })),
  }
}
