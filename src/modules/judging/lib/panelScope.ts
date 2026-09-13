/**
 * Which judge panel — if any — may file a score for a given project.
 *
 * Kept pure (no EntityManager, no request) so the rule can be unit-tested and so every call
 * site scores against the same predicate instead of re-deriving one. The caller is
 * responsible for loading the inputs already scoped to the caller's tenant and organisation;
 * this module only decides eligibility.
 */

/** The sentinel the portal client sends when it wants the server to pick the panel. */
export const AUTO_PANEL = 'auto'

export type ScoringPanelMembership = {
  panelId: string
  /** Competition the panel belongs to — a panel is always owned by exactly one competition. */
  competitionId: string
}

export type ScoringProject = {
  id: string
  competitionId: string
  trackId: string
}

export type ResolveScoringPanelInput = {
  /** Panels the caller sits on, already scoped to the caller's tenant + organisation. */
  memberships: ScoringPanelMembership[]
  /** The project being scored, already loaded inside the caller's tenant + organisation. */
  project: ScoringProject
  /** `judge_panel_id` from the request body: a panel id, or `AUTO_PANEL`. */
  requestedPanelId: string
}

export type ScoringPanelDenialReason =
  /** The caller sits on no panel of the competition that owns the project. */
  | 'not_assigned'
  /** The caller named a panel that is not one of theirs for this competition. */
  | 'panel_not_eligible'

export type ResolveScoringPanelResult =
  | { ok: true; panelId: string }
  | { ok: false; reason: ScoringPanelDenialReason }

/** Messages are deliberately non-specific: a rejected caller learns nothing about the panels. */
export const SCORING_PANEL_DENIAL_MESSAGE: Record<ScoringPanelDenialReason, string> = {
  not_assigned: 'You are not on a judging panel for this competition',
  panel_not_eligible: 'That judging panel cannot score this project',
}

/**
 * Panel ids the caller may score this project from, deduplicated and ordered by id so that
 * `AUTO_PANEL` resolution is deterministic rather than "whichever row the database returned
 * first" — the non-determinism that filed scores under an unrelated competition's panel.
 */
export function eligibleScoringPanelIds(input: ResolveScoringPanelInput): string[] {
  const ids = new Set<string>()
  for (const membership of input.memberships) {
    if (membership.competitionId !== input.project.competitionId) continue
    ids.add(membership.panelId)
  }
  return [...ids].sort()
}

export function resolveScoringPanel(input: ResolveScoringPanelInput): ResolveScoringPanelResult {
  const eligible = eligibleScoringPanelIds(input)
  if (!eligible.length) return { ok: false, reason: 'not_assigned' }
  if (input.requestedPanelId === AUTO_PANEL) return { ok: true, panelId: eligible[0] }
  if (eligible.includes(input.requestedPanelId)) return { ok: true, panelId: input.requestedPanelId }
  return { ok: false, reason: 'panel_not_eligible' }
}
