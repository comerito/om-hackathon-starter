/**
 * The matching and disclosure rules behind the portal participant search.
 *
 * The search exists for one job: letting a team owner find the person they want to invite. That
 * job needs a *lookup*, not a *listing* — so the rules here are deliberately narrow:
 *
 *  - a query shorter than {@link MIN_PARTICIPANT_SEARCH_LENGTH} matches nothing;
 *  - a query that looks like an address matches only an **exact** address;
 *  - any other query matches a **prefix** of a name token or of the address' local part.
 *
 * Substring matching is what made the roster enumerable: `%hackon%` matched every attendee
 * through their shared mail domain. A prefix never matches a domain fragment, and the exact-match
 * branch means a half-typed domain returns nothing instead of "everyone".
 *
 * Emails are never returned in full — see {@link maskEmail}.
 */

/** Shortest query that is allowed to match anything. */
export const MIN_PARTICIPANT_SEARCH_LENGTH = 3

/** Most results one search may return. */
export const PARTICIPANT_SEARCH_RESULT_LIMIT = 10

export type ParticipantSearchQuery =
  | { kind: 'too-short' }
  /** The caller typed an address; only an exact (case-insensitive) match counts. */
  | { kind: 'email'; email: string }
  /** The caller typed a name fragment; prefix matching applies. */
  | { kind: 'name'; prefix: string }

export type ParticipantSearchCandidate = {
  displayName?: string | null
  email?: string | null
}

export function parseParticipantSearchQuery(raw: string | null | undefined): ParticipantSearchQuery {
  const value = (raw ?? '').trim()
  if (value.length < MIN_PARTICIPANT_SEARCH_LENGTH) return { kind: 'too-short' }
  if (value.includes('@')) return { kind: 'email', email: value.toLowerCase() }
  return { kind: 'name', prefix: value.toLowerCase() }
}

function localPart(email: string | null | undefined): string {
  if (!email) return ''
  const at = email.indexOf('@')
  return (at === -1 ? email : email.slice(0, at)).toLowerCase()
}

/**
 * Does this candidate match a name-mode query? True when any whitespace- or punctuation-separated
 * token of the display name starts with the prefix, or the address' local part does.
 *
 * Matching the local part keeps "type the beginning of their email" working; matching only
 * *prefixes* is what stops a shared mail domain from returning the whole roster.
 */
export function matchesParticipantNamePrefix(
  candidate: ParticipantSearchCandidate,
  prefix: string,
): boolean {
  const needle = prefix.trim().toLowerCase()
  if (needle.length < MIN_PARTICIPANT_SEARCH_LENGTH) return false

  const name = (candidate.displayName ?? '').toLowerCase()
  const tokens = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (tokens.some((token) => token.startsWith(needle))) return true

  return localPart(candidate.email).startsWith(needle)
}

/**
 * Mask an address for display: first character of the local part, three asterisks, then the
 * domain — `alpha@hackon.test` → `a***@hackon.test`.
 *
 * The star count is fixed so the mask does not disclose the local part's length. The domain is
 * kept because that is what makes the mask useful: it distinguishes two people with the same name
 * without handing out a deliverable address. Anything that is not address-shaped is masked whole.
 */
export function maskEmail(email: string | null | undefined): string {
  const value = (email ?? '').trim()
  if (!value) return ''
  const at = value.lastIndexOf('@')
  if (at <= 0 || at === value.length - 1) return '***'
  return `${value.slice(0, 1)}***${value.slice(at)}`
}
