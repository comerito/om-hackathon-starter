/**
 * The team side of team matching: a team says *"we are looking for someone with these skills"*,
 * participants say which skills they have (`competitions_participant_profile.skills`).
 *
 * Both lists are free text typed by humans — `React`, `react`, ` React ` are the same skill and
 * nobody wants to discover otherwise while the hackathon is running. This module owns the one
 * definition of "the same skill" so the API, the invite shortlist and the browse filter cannot
 * drift apart.
 *
 * Pure on purpose: the routes load the rows, this module decides.
 */

/** A posting is a shortlist, not a job board. Anything past this is noise for the reader. */
export const MAX_NEEDED_SKILLS = 12

/** Long enough for "Infrastructure as Code", short enough that nobody pastes a CV into a chip. */
export const MAX_SKILL_LENGTH = 60

/** The note is a sentence or two of context, not a second description field. */
export const MAX_RECRUITMENT_NOTE_LENGTH = 500

/** The comparison key — trimmed and case-folded, never shown to a user. */
export function skillKey(skill: string): string {
  return skill.trim().toLocaleLowerCase()
}

/**
 * Clean a submitted skill list: trim, drop empties, truncate over-long entries, de-duplicate
 * case-insensitively (first spelling wins, so the team's own capitalisation survives) and cap
 * the length.
 *
 * Accepts `unknown` because it also guards the stored jsonb column, which predates nothing but
 * is still a jsonb blob the database will hand back verbatim.
 */
export function normalizeNeededSkills(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim().slice(0, MAX_SKILL_LENGTH).trim()
    if (!trimmed) continue
    const key = skillKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= MAX_NEEDED_SKILLS) break
  }

  return out
}

/**
 * The skills a candidate has that the team asked for, in the team's spelling and the team's
 * order — the posting is what the reader is matching against, so it decides how the overlap
 * reads.
 */
export function skillOverlap(needed: unknown, candidateSkills: unknown): string[] {
  const wanted = normalizeNeededSkills(needed)
  if (wanted.length === 0) return []

  const have = new Set(
    (Array.isArray(candidateSkills) ? candidateSkills : [])
      .filter((s): s is string => typeof s === 'string')
      .map(skillKey)
      .filter(Boolean),
  )
  if (have.size === 0) return []

  return wanted.filter((skill) => have.has(skillKey(skill)))
}

/**
 * Whether a team posting is actually visible to somebody browsing.
 *
 * A team that flipped the toggle but listed nothing still counts: "we have room, talk to us" is
 * a real signal, and hiding it would make the toggle look broken.
 */
export function isRecruiting(team: { lookingForMembers?: boolean | null }): boolean {
  return team.lookingForMembers === true
}
