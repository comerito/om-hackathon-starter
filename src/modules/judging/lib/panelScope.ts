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
  /** `preliminary` | `final`. Used to *prefer* a panel, never to exclude one — see below. */
  round?: string
}

export type ScoringPanelTrack = {
  panelId: string
  trackId: string
}

export type ScoringProject = {
  id: string
  competitionId: string
  trackId: string
}

export type ResolveScoringPanelInput = {
  /** Panels the caller sits on, already scoped to the caller's tenant + organisation. */
  memberships: ScoringPanelMembership[]
  /** Track assignments of those panels (`judging_panel_track` rows). */
  panelTracks: ScoringPanelTrack[]
  /** The project being scored, already loaded inside the caller's tenant + organisation. */
  project: ScoringProject
  /** `judge_panel_id` from the request body: a panel id, or `AUTO_PANEL`. */
  requestedPanelId: string
  /** Round being scored. Only breaks ties between otherwise eligible panels. */
  round?: string
}

export type ScoringPanelDenialReason =
  /** The caller sits on no panel of the competition that owns the project. */
  | 'not_assigned'
  /** The caller has panels here, but none of them covers the project's track. */
  | 'track_not_covered'
  /** The caller named a panel that is not one of their eligible panels for this project. */
  | 'panel_not_eligible'

export type ResolveScoringPanelResult =
  | { ok: true; panelId: string }
  | { ok: false; reason: ScoringPanelDenialReason }

/** Messages are deliberately non-specific: a rejected caller learns nothing about the panels. */
export const SCORING_PANEL_DENIAL_MESSAGE: Record<ScoringPanelDenialReason, string> = {
  not_assigned: 'You are not on a judging panel for this competition',
  track_not_covered: 'Your judging panel does not cover this project',
  panel_not_eligible: 'That judging panel cannot score this project',
}

/** Panels of the caller's that belong to the competition owning the project. */
function panelsInProjectCompetition(input: ResolveScoringPanelInput): ScoringPanelMembership[] {
  const seen = new Set<string>()
  const panels: ScoringPanelMembership[] = []
  for (const membership of input.memberships) {
    if (membership.competitionId !== input.project.competitionId) continue
    if (seen.has(membership.panelId)) continue
    seen.add(membership.panelId)
    panels.push(membership)
  }
  return panels
}

/**
 * Panel ids the caller may score this project from: the panel must belong to the competition
 * that owns the project **and** its assigned tracks must cover the project's track. A panel
 * with no track assignments covers nothing — the same reading `my-assignments` uses when it
 * decides which projects to offer a judge, so a judge is never asked to score a project the
 * panel would not have listed.
 *
 * Ordered by id so `AUTO_PANEL` resolution is deterministic rather than "whichever row the
 * database returned first" — the non-determinism that filed scores under an unrelated
 * competition's panel.
 */
export function eligibleScoringPanelIds(input: ResolveScoringPanelInput): string[] {
  const eligible = panelsInProjectCompetition(input)
  if (!eligible.length) return []
  const eligibleIds = new Set(eligible.map(p => p.panelId))
  const covering = new Set<string>()
  for (const assignment of input.panelTracks) {
    if (!eligibleIds.has(assignment.panelId)) continue
    if (assignment.trackId !== input.project.trackId) continue
    covering.add(assignment.panelId)
  }
  return [...covering].sort()
}

/**
 * Pick the panel an `AUTO_PANEL` request is filed under: a panel whose round matches the round
 * being scored when there is one, otherwise the first eligible panel.
 *
 * The round is a *preference*, not a filter. The portal scoring page hardcodes
 * `round: 'preliminary'`, so excluding panels whose round differs would lock a judge out of a
 * competition whose only panel is configured as `final`.
 */
function pickAutoPanel(input: ResolveScoringPanelInput, eligible: string[]): string {
  if (!input.round) return eligible[0]
  const roundById = new Map(input.memberships.map(m => [m.panelId, m.round]))
  return eligible.find(id => roundById.get(id) === input.round) ?? eligible[0]
}

export function resolveScoringPanel(input: ResolveScoringPanelInput): ResolveScoringPanelResult {
  if (!panelsInProjectCompetition(input).length) return { ok: false, reason: 'not_assigned' }
  const eligible = eligibleScoringPanelIds(input)
  if (!eligible.length) return { ok: false, reason: 'track_not_covered' }
  if (input.requestedPanelId === AUTO_PANEL) return { ok: true, panelId: pickAutoPanel(input, eligible) }
  if (eligible.includes(input.requestedPanelId)) return { ok: true, panelId: input.requestedPanelId }
  return { ok: false, reason: 'panel_not_eligible' }
}
