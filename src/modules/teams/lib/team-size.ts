/**
 * The configured team-size rules (`competitions_competition.min_team_size` /
 * `max_team_size`), applied as rules rather than as decoration on a progress bar.
 *
 * Pure: the caller loads the competition and counts the rows, this module decides.
 */

export type TeamSizeLimits = {
  minTeamSize?: number | null
  maxTeamSize?: number | null
}

export type TeamSizeDecision =
  | { allowed: true }
  | { allowed: false; reason: string }

/**
 * A limit is only a limit when it is a positive integer. `0`, a negative number,
 * `null` and `undefined` all mean "not configured" — the historical value of these
 * columns on competitions created before they were meaningful.
 */
function effectiveLimit(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const limit = Math.floor(value)
  return limit > 0 ? limit : null
}

export function maxTeamSize(limits: TeamSizeLimits): number | null {
  return effectiveLimit(limits.maxTeamSize)
}

export function minTeamSize(limits: TeamSizeLimits): number | null {
  return effectiveLimit(limits.minTeamSize)
}

/**
 * Seats left, counting pending invitations as taken. `null` means uncapped.
 *
 * Pending invitations count because an invitation is a promise of a seat: issuing
 * five of them against two free seats means three people accept and are turned away
 * afterwards, which is a worse outcome than refusing the invite up front.
 */
export function remainingTeamCapacity(
  limits: TeamSizeLimits,
  counts: { memberCount: number; pendingInvitationCount?: number },
): number | null {
  const max = maxTeamSize(limits)
  if (max === null) return null
  const taken = counts.memberCount + (counts.pendingInvitationCount ?? 0)
  return Math.max(0, max - taken)
}

/** Whether the team owner may issue another invitation. */
export function canInviteToTeam(
  limits: TeamSizeLimits,
  counts: { memberCount: number; pendingInvitationCount: number },
): TeamSizeDecision {
  const remaining = remainingTeamCapacity(limits, counts)
  if (remaining === null || remaining > 0) return { allowed: true }

  const max = maxTeamSize(limits) as number
  const pending = counts.pendingInvitationCount
  return {
    allowed: false,
    reason: pending > 0
      ? `This team is full (${counts.memberCount} member(s) plus ${pending} pending invitation(s), limit ${max}). Cancel a pending invitation first.`
      : `This team is full (${counts.memberCount} of ${max} members).`,
  }
}

/**
 * Whether one more person may actually join. Pending invitations are NOT counted
 * here: this call is the moment one of them is being converted into a member, and
 * counting it would make every accept fail by one.
 */
export function canJoinTeam(
  limits: TeamSizeLimits,
  counts: { memberCount: number },
): TeamSizeDecision {
  const max = maxTeamSize(limits)
  if (max === null || counts.memberCount < max) return { allowed: true }
  return {
    allowed: false,
    reason: `This team is already at its maximum size (${max} members).`,
  }
}

/** Whether a team is large enough to compete. */
export function meetsMinimumTeamSize(
  limits: TeamSizeLimits,
  counts: { memberCount: number },
): TeamSizeDecision {
  const min = minTeamSize(limits)
  if (min === null || counts.memberCount >= min) return { allowed: true }
  return {
    allowed: false,
    reason: `This competition requires at least ${min} team members; your team has ${counts.memberCount}.`,
  }
}
