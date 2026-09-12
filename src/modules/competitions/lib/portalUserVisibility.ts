/**
 * Who may a portal caller look up?
 *
 * The portal has no notion of an "organiser" session — every caller is a customer user whose
 * only relationship to other people is a shared `CompetitionParticipation`. So the rule this
 * module encodes is: **a portal caller may resolve a user only when the two of them share a
 * competition** (plus, trivially, themselves). Tenant membership is NOT a relationship — a
 * tenant hosts many competitions and their attendee lists are unrelated to one another.
 *
 * The SQL in the route already narrows candidates to the caller's competitions; this helper
 * re-applies the rule over the rows that came back so the response can never contain an id the
 * caller did not earn, whatever a future query change does.
 */

/** Hard cap on how many ids one `resolve-users` call may ask about. */
export const MAX_RESOLVE_USER_IDS = 50

/** The only two participation columns the visibility rule depends on. */
export type ParticipationScopeRow = {
  competitionId: string
  customerUserId: string
}

/**
 * Parse the `ids` query parameter: split, trim, drop blanks, de-duplicate (order preserved) and
 * cap at {@link MAX_RESOLVE_USER_IDS}. De-duplication happens *before* the cap so a caller cannot
 * pad the list with repeats to push ids past it.
 */
export function normalizeRequestedUserIds(raw: string | null | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    const id = part.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    if (seen.size >= MAX_RESOLVE_USER_IDS) break
  }
  return [...seen]
}

/**
 * Keep only the requested ids the caller is entitled to see: the caller themself, and users who
 * participate in at least one competition the caller also participates in.
 */
export function selectVisibleUserIds(params: {
  requestedIds: readonly string[]
  callerUserId: string
  callerCompetitionIds: readonly string[]
  candidateParticipations: readonly ParticipationScopeRow[]
}): string[] {
  const { requestedIds, callerUserId, callerCompetitionIds, candidateParticipations } = params
  const sharedCompetitions = new Set(callerCompetitionIds)
  const visible = new Set<string>()
  for (const row of candidateParticipations) {
    if (sharedCompetitions.has(row.competitionId)) visible.add(row.customerUserId)
  }
  return requestedIds.filter((id) => id === callerUserId || visible.has(id))
}
