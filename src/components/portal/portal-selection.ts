/**
 * The portal's "which competition am I looking at" selection.
 *
 * `CompetitionProvider` owns the three `hackon:selected-competition*` localStorage keys; the
 * persistent chrome (sidebar, top bar, layout drawers) only reads them. Because the chrome lives
 * in the Next.js layout it is NOT remounted on client-side navigation, so a one-shot
 * `useEffect(…, [])` read of localStorage goes stale the moment the selection or the competition
 * stage changes — which is exactly what issue #115 reports for the stage-gated sidebar items.
 *
 * Everything in this file is framework-free so the gating rules can be unit-tested; the React
 * subscription lives in `usePortalSelection.ts`.
 */

export const PORTAL_SELECTION_KEYS = {
  competitionId: 'hackon:selected-competition',
  stage: 'hackon:selected-competition-stage',
  role: 'hackon:selected-competition-role',
} as const

/**
 * Same-tab notification that the selection changed. `storage` events only fire in *other* tabs,
 * so the writer has to announce same-tab writes itself.
 *
 * Kept under its historical name — `PortalTopBar` has always listened for it — but the detail now
 * carries the whole selection instead of just the role.
 */
export const PORTAL_SELECTION_EVENT = 'competition-role-changed'

export type PortalSelection = {
  competitionId: string | null
  stage: string | null
  role: string | null
}

export const EMPTY_PORTAL_SELECTION: PortalSelection = { competitionId: null, stage: null, role: null }

/** Stage ordering for visibility comparisons. */
export const STAGE_INDEX: Record<string, number> = {
  draft: 0, open: 1, team_formation: 2, track_selection: 3,
  hacking: 4, demos: 5, deliberation: 6, finished: 7, archived: 8,
}

/** Nav items hidden until the competition reaches a minimum stage.
 *  `roles`: restrict only these roles (omit to apply to all roles) */
export const MIN_STAGE_FOR_ITEM: Array<{ id: string; minStage: string; roles?: string[] }> = [
  { id: 'projects.portal-my-project', minStage: 'team_formation' },
  { id: 'judging.portal-presentations', minStage: 'demos', roles: ['participant'] },
  { id: 'judging.portal-results', minStage: 'deliberation', roles: ['participant'] },
  { id: 'sponsors.portal-voting', minStage: 'demos', roles: ['participant'] },
]

/**
 * Drop nav items whose competition stage has not been reached yet.
 *
 * Pure so the gating can be asserted directly: an unknown stage hides every gated item (we would
 * rather show nothing than link to a page that 403s), and a role-scoped rule is skipped entirely
 * for a role it does not name.
 */
export function filterNavItemsByStage<T extends { id: string }>(
  items: T[],
  stage: string | null,
  role: string | null,
): T[] {
  const currentStageIdx = stage ? (STAGE_INDEX[stage] ?? -1) : -1
  return items.filter((item) => {
    const rule = MIN_STAGE_FOR_ITEM.find((r) => r.id === item.id)
    if (!rule) return true
    // If the rule is role-scoped, skip it for non-matching roles
    if (rule.roles && role && !rule.roles.includes(role)) return true
    if (currentStageIdx < 0) return false // stage unknown — hide stage-gated items
    return currentStageIdx >= (STAGE_INDEX[rule.minStage] ?? 0)
  })
}

/** True when two selections are interchangeable — lets subscribers skip no-op re-renders. */
export function isSamePortalSelection(a: PortalSelection, b: PortalSelection): boolean {
  return a.competitionId === b.competitionId && a.stage === b.stage && a.role === b.role
}
