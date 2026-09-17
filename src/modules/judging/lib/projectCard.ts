import type { JudgeProjectCard } from './judgeAssignments'

/**
 * Display derivations for the judge's project card side panel (SPEC-007).
 *
 * The panel hides every empty section, so "is there anything to show" is decided here and
 * asserted in tests rather than scattered through JSX conditions.
 */

export type ProjectCardLinkKind = 'demo' | 'repo' | 'video' | 'presentation'

export type ProjectCardLink = { kind: ProjectCardLinkKind; url: string }

/** Trimmed text, or `null` when the value is missing or blank. */
export function presentText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * An `http(s)` URL safe to put in an `href`, or `null`.
 *
 * Project links are typed in by participants, so anything that is not a plain web URL
 * (`javascript:`, `data:`, a bare word) is dropped instead of rendered as a clickable link.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  const text = presentText(value)
  if (!text) return null
  try {
    const parsed = new URL(text)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? text : null
  } catch {
    return null
  }
}

const LINK_ORDER: ReadonlyArray<{ kind: ProjectCardLinkKind; field: keyof Pick<JudgeProjectCard, 'demo_url' | 'repo_url' | 'video_url' | 'presentation_url'> }> = [
  { kind: 'demo', field: 'demo_url' },
  { kind: 'repo', field: 'repo_url' },
  { kind: 'video', field: 'video_url' },
  { kind: 'presentation', field: 'presentation_url' },
]

/** Link rows in a fixed order (demo, repo, video, presentation); missing or unsafe URLs omitted. */
export function resolveProjectCardLinks(
  project: Pick<JudgeProjectCard, 'demo_url' | 'repo_url' | 'video_url' | 'presentation_url'>,
): ProjectCardLink[] {
  const links: ProjectCardLink[] = []
  for (const { kind, field } of LINK_ORDER) {
    const url = safeExternalUrl(project[field])
    if (url) links.push({ kind, url })
  }
  return links
}

/** Tech stack chips: trimmed, blanks removed, case-insensitive duplicates collapsed. */
export function resolveTechStack(stack: ReadonlyArray<string> | null | undefined): string[] {
  if (!Array.isArray(stack)) return []
  const seen = new Set<string>()
  const chips: string[] = []
  for (const entry of stack) {
    const text = presentText(entry)
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    chips.push(text)
  }
  return chips
}

export type ProjectReuseWarnings = {
  flaggedForReuse: boolean
  /** `null` when the team did not declare pre-existing code. */
  preexistingCode: { description: string | null } | null
}

export function resolveReuseWarnings(
  project: Pick<JudgeProjectCard, 'flagged_for_reuse' | 'uses_preexisting_code' | 'preexisting_code_description'>,
): ProjectReuseWarnings {
  return {
    flaggedForReuse: project.flagged_for_reuse === true,
    preexistingCode: project.uses_preexisting_code === true
      ? { description: presentText(project.preexisting_code_description) }
      : null,
  }
}
